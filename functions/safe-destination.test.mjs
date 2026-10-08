// Run with: node functions/safe-destination.test.mjs
// Pins the egress policy. 127.0.0.1 has many spellings; each one that reaches loopback must fail.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const { safeDestination, isPrivateAddress } = createRequire(import.meta.url)("./safe-destination.js");

const mustBlock = [
  "http://127.0.0.1/", "http://2130706433/", "http://0x7f000001/", "http://0177.0.0.1/", "http://127.1/",
  "http://localhost/", "http://localhost./", "http://LOCALHOST/", "http://localhost.localdomain/",
  "http://169.254.169.254/computeMetadata/v1/", "http://metadata.google.internal/", "http://anything.internal/",
  "http://10.0.0.1/", "http://10.255.255.255/", "http://172.16.0.1/", "http://172.31.255.255/", "http://192.168.1.1/",
  "http://100.64.0.1/", "http://0.0.0.0/", "http://0/", "http://224.0.0.1/", "http://255.255.255.255/",
  "http://[::1]/", "http://[::]/", "http://[fd00::1]/", "http://[fe80::1]/", "http://[::ffff:127.0.0.1]/",
  "http://[::ffff:10.0.0.1]/", "http://[64:ff9b::7f00:1]/", "http://user:pw@127.0.0.1/", "http://trusted.example@169.254.169.254/",
  "ftp://arxiv.org/x", "file:///etc/passwd", "javascript:alert(1)", "", "not a url"
];
const mustAllow = [
  "https://arxiv.org/pdf/2301.00001", "https://api.openalex.org/works", "http://example.com/a.pdf",
  "https://8.8.8.8/x", "https://1.1.1.1/", "https://172.32.0.1/x", "https://11.0.0.1/x", "https://[2606:4700::1111]/"
];

let failures = 0;
for (const url of mustBlock) {
  let blocked = false;
  try { safeDestination(url); } catch { blocked = true; }
  if (!blocked) { console.error(`LEAK: ${url} was allowed`); failures++; }
}
for (const url of mustAllow) {
  try { safeDestination(url); } catch (error) { console.error(`FALSE POSITIVE: ${url} — ${error.message}`); failures++; }
}
// The URL parser must do the canonicalising; raw strings are not safe to test directly.
assert.equal(new URL("http://2130706433/").hostname, "127.0.0.1");
assert.equal(isPrivateAddress("127.0.0.1"), true);
assert.equal(isPrivateAddress("arxiv.org"), false);

console.log(failures ? `${failures} FAILURES` : `safe-destination: all ${mustBlock.length + mustAllow.length} cases correct`);
process.exit(failures ? 1 : 0);
