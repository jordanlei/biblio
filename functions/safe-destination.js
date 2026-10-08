// Egress policy for the PDF proxy: where the server may fetch on a user's behalf.
//
// A server-side fetch runs inside the owner's project, from the owner's IP, so an unrestricted
// proxy lets any signed-in caller reach the project's internal network and scan private hosts.
//
// Two things make this harder than it looks:
//  * 127.0.0.1 has many spellings — decimal (2130706433), hex (0x7f000001), octal (0177.0.0.1),
//    short form (127.1). WHATWG `new URL()` normalises all of these to dotted-quad, so parse
//    first and only ever inspect `url.hostname`, never the raw string.
//  * A hostname that looks public can still resolve to a private IP (DNS rebinding). The name
//    check cannot catch that, so callers resolve the host and check the addresses too.

const BLOCKED_NAMES = new Set(["localhost", "localhost.localdomain", "metadata", "metadata.google.internal"]);

/** True for loopback, private, link-local, CGNAT, multicast and reserved IPv4. */
function isPrivateIpv4(address) {
  const parts = address.split(".");
  if (parts.length !== 4) return false;
  const [a, b] = parts.map(Number);
  if (parts.some((p) => p === "" || !/^\d+$/.test(p) || Number(p) > 255)) return true; // malformed: refuse
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a >= 224) return true; // multicast and reserved
  return false;
}

/** True for IPv6 loopback, unique-local, link-local, and anything embedding a private IPv4. */
function isPrivateIpv6(address) {
  const host = address.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0]; // drop zone id
  const full = host.replace(/^::$/, "0:0:0:0:0:0:0:0");
  if (/^(0:)*0*:?:?1$/.test(full.replace(/:+/g, ":")) || full === "::1") return true;
  if (/^f[cd]/.test(full)) return true; // unique local fc00::/7
  if (/^fe[89ab]/.test(full)) return true; // link-local fe80::/10
  // IPv4-mapped (::ffff:127.0.0.1) and NAT64 (64:ff9b::7f00:1) can carry a private v4 inside.
  const mapped = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(full);
  if (mapped) return isPrivateIpv4(mapped[1]);
  const hex = /^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(full);
  if (hex) {
    const n = (parseInt(hex[1], 16) << 16) | parseInt(hex[2], 16);
    return isPrivateIpv4([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join("."));
  }
  if (full === "::" || /^0*:(0*:)*0*$/.test(full)) return true;
  return false;
}

/**
 * Is this host name or IP literal non-public? Pass a hostname from `new URL()`, which has already
 * normalised alternate IPv4 spellings, or a resolved IP address.
 */
function isPrivateAddress(hostname) {
  const host = String(hostname).toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, ""); // trailing-dot FQDN
  if (!host) return true;
  if (BLOCKED_NAMES.has(host)) return true;
  if (/\.(internal|local|localhost|home\.arpa)$/.test(host)) return true;
  if (host.includes(":")) return isPrivateIpv6(host);
  if (/^\d+$/.test(host) || /^0x/i.test(host)) return true; // bare decimal/hex the parser didn't fold
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return isPrivateIpv4(host);
  if (/^[\d.]+$/.test(host)) return true; // other all-numeric shapes: refuse rather than guess
  return false;
}

/**
 * Validate a user-supplied URL before fetching it. Returns the parsed URL (hostname already
 * canonicalised) or throws with a message that is safe to show the caller.
 */
function safeDestination(raw) {
  let url;
  try {
    url = new URL(String(raw || ""));
  } catch {
    throw new Error("A valid http(s) url is required");
  }
  if (!/^https?:$/.test(url.protocol)) throw new Error("A valid http(s) url is required");
  // Credentials in the URL (http://trusted.example@127.0.0.1/) mislead humans reading logs.
  if (url.username || url.password) throw new Error("That address isn't allowed");
  if (isPrivateAddress(url.hostname)) throw new Error("That address isn't allowed");
  return url;
}

module.exports = { isPrivateAddress, isPrivateIpv4, isPrivateIpv6, safeDestination };
