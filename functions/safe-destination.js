// Egress policy for the PDF proxy: where the server is allowed to fetch on a user's behalf.
//
// A fetch made by the server runs inside the owner's project, from the owner's IP, so an
// unrestricted proxy lets any signed-in caller reach the project's internal network and scan
// private hosts. Block anything that isn't a public internet address.

const BLOCKED_HOSTNAMES = new Set(["localhost", "localhost.localdomain", "metadata", "metadata.google.internal"]);

/** Private, loopback, link-local, and other non-public address space. */
function isPrivateAddress(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (/\.(internal|local|localhost|home\.arpa)$/.test(host)) return true;

  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) {
    const [a, b] = v4.slice(1).map(Number);
    if (v4.slice(1).map(Number).some((n) => n > 255)) return true; // malformed: refuse
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local, incl. cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
    if (a >= 224) return true; // multicast / reserved
    return false;
  }

  if (host.includes(":")) {
    if (host === "::1" || host === "::") return true;
    if (/^f[cd]/.test(host)) return true; // unique local
    if (/^fe[89ab]/.test(host)) return true; // link-local
    return false;
  }
  return false;
}

/**
 * Validate a user-supplied URL before the server fetches it.
 * Returns the parsed URL, or throws with a message safe to show a caller.
 */
function safeDestination(raw) {
  let url;
  try {
    url = new URL(String(raw || ""));
  } catch {
    throw new Error("A valid http(s) url is required");
  }
  if (!/^https?:$/.test(url.protocol)) throw new Error("A valid http(s) url is required");
  if (isPrivateAddress(url.hostname)) throw new Error("That address isn't allowed");
  return url;
}

module.exports = { isPrivateAddress, safeDestination };
