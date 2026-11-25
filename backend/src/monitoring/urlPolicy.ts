/**
 * Monitoring URL policy: SSRF protection for BR-02 (PULSE-90).
 *
 * Rules: docs/api/README.md section 6.4 (contract) and docs/backend/README.md section 8 (ranges).
 * One module, two callers:
 *
 * - **Monitor create/edit (PULSE-89):** `await assertSafeMonitorUrl(url)` before saving.
 *   It throws `UnsafeUrlError` (an ApiError, so the response is `400 UNSAFE_URL`).
 * - **Every check, manual or scheduled (PULSE-92):** `const target = await resolveSafeTarget(url)`
 *   right before the request, then pass `lookup: pinnedLookup(target)` to `http.request` /
 *   `https.request`. DNS can change after a monitor is saved, so it is checked again each time,
 *   and the request can only connect to an address that was just checked (no DNS rebinding).
 *   `UnsafeUrlError` → record the check as `blocked`; `HostLookupError` → a DNS failure.
 *
 * Redirects are **not followed** (contract 6.4): `http.request` never follows them, and the
 * checker must not add a redirect-following client. A 3xx is recorded as the response.
 */
import { BlockList, isIP, type LookupFunction } from "node:net";
import { lookup as dnsLookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import { ApiError } from "../lib/apiError.js";

export const MAX_URL_LENGTH = 2048;

/** Why a URL was rejected. Useful in logs and in a `blocked` check's error message. */
export type UnsafeUrlReason =
  | "INVALID_URL"
  | "URL_TOO_LONG"
  | "UNSUPPORTED_SCHEME"
  | "CREDENTIALS_IN_URL"
  | "BLOCKED_HOSTNAME"
  | "BLOCKED_ADDRESS"
  | "DNS_LOOKUP_FAILED";

/** The URL must not be saved or requested. Maps to `400 UNSAFE_URL`. */
export class UnsafeUrlError extends ApiError {
  readonly reason: UnsafeUrlReason;

  constructor(reason: UnsafeUrlReason, message: string) {
    super(400, "UNSAFE_URL", message, [{ field: "url", message }]);
    this.name = "UnsafeUrlError";
    this.reason = reason;
  }
}

/** The host name did not resolve. At check time this is a DNS failure, not a blocked URL. */
export class HostLookupError extends Error {
  readonly hostname: string;

  constructor(hostname: string, options?: { cause?: unknown }) {
    super(`Could not resolve host ${hostname}`, options);
    this.name = "HostLookupError";
    this.hostname = hostname;
  }
}

export interface ResolvedAddress {
  address: string;
  family: 4 | 6;
}

/** A URL that passed every rule, with the exact addresses that were checked. */
export interface SafeTarget {
  url: URL;
  /** Lowercase host name without brackets or a trailing dot. */
  hostname: string;
  addresses: ResolvedAddress[];
}

/** Resolves every A and AAAA record for a host name. Replaced in tests so they need no network. */
export type Resolver = (hostname: string) => Promise<ResolvedAddress[]>;

export const systemResolver: Resolver = async (hostname) => {
  // dns.lookup uses the same resolver as http.request (including the hosts file).
  const results = await dnsLookup(hostname, { all: true, order: "verbatim" });
  return results.map((r) => ({ address: r.address, family: r.family === 6 ? 6 : 4 }));
};

// ---------------------------------------------------------------------------
// Blocked address ranges
// ---------------------------------------------------------------------------

const IPV4_BLOCKED: Array<[string, number, string]> = [
  ["0.0.0.0", 8, "this network"],
  ["10.0.0.0", 8, "private"],
  ["100.64.0.0", 10, "carrier-grade NAT"],
  ["127.0.0.0", 8, "loopback"],
  ["169.254.0.0", 16, "link-local (includes cloud metadata 169.254.169.254)"],
  ["172.16.0.0", 12, "private"],
  ["192.0.0.0", 24, "IETF protocol assignments"],
  ["192.0.2.0", 24, "documentation"],
  ["192.168.0.0", 16, "private"],
  ["198.18.0.0", 15, "benchmarking"],
  ["198.51.100.0", 24, "documentation"],
  ["203.0.113.0", 24, "documentation"],
  ["224.0.0.0", 4, "multicast"],
  ["240.0.0.0", 4, "reserved (includes 255.255.255.255)"],
];

const IPV6_BLOCKED: Array<[string, number, string]> = [
  // ::/96 covers ::/128 (unspecified), ::1/128 (loopback) and the deprecated IPv4-compatible form.
  ["::", 96, "unspecified, loopback and IPv4-compatible"],
  ["100::", 64, "discard"],
  ["2001:db8::", 32, "documentation"],
  ["fc00::", 7, "unique-local"],
  ["fe80::", 10, "link-local"],
  ["fec0::", 10, "site-local (deprecated)"],
  ["ff00::", 8, "multicast"],
];

const blockList = new BlockList();
for (const [network, prefix] of IPV4_BLOCKED) blockList.addSubnet(network, prefix, "ipv4");
for (const [network, prefix] of IPV6_BLOCKED) blockList.addSubnet(network, prefix, "ipv6");

/** Parses an IPv6 address into its eight 16-bit groups, or returns null if it isn't one. */
function ipv6Groups(address: string): number[] | null {
  let text = address.split("%")[0] ?? ""; // drop a zone id such as %eth0
  if (isIP(text) !== 6) return null;

  // A dotted IPv4 tail (::ffff:127.0.0.1) becomes two hex groups.
  const lastColon = text.lastIndexOf(":");
  const tail = text.slice(lastColon + 1);
  if (tail.includes(".")) {
    const [a = 0, b = 0, c = 0, d = 0] = tail.split(".").map(Number);
    text = `${text.slice(0, lastColon + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }

  const [head = "", rest] = text.split("::");
  const headGroups = head ? head.split(":") : [];
  const restGroups = rest ? rest.split(":") : [];
  const zeros = rest === undefined ? [] : Array(8 - headGroups.length - restGroups.length).fill("0");
  const groups = [...headGroups, ...zeros, ...restGroups].map((g) => parseInt(g, 16));
  return groups.length === 8 && groups.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff) ? groups : null;
}

const ipv4FromGroups = (high: number, low: number) =>
  `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;

/**
 * The IPv4 address carried inside an IPv6 address, if any:
 * IPv4-mapped `::ffff:0:0/96`, NAT64 `64:ff9b::/96` and 6to4 `2002::/16`.
 */
export function embeddedIpv4(address: string): string | null {
  const g = ipv6Groups(address);
  if (!g) return null;
  const [g0, g1, g2, g3, g4, g5, g6, g7] = g as [number, number, number, number, number, number, number, number];
  if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) return ipv4FromGroups(g6, g7);
  if (g0 === 0x64 && g1 === 0xff9b && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0) return ipv4FromGroups(g6, g7);
  if (g0 === 0x2002) return ipv4FromGroups(g1, g2);
  return null;
}

/** True when the address must never be requested. Anything that isn't a valid IP is blocked too. */
export function isBlockedAddress(address: string): boolean {
  const bare = address.replace(/^\[|\]$/g, "");
  const family = isIP(bare.split("%")[0] ?? "");
  if (family === 4) return blockList.check(bare, "ipv4");
  if (family !== 6) return true;

  const withoutZone = bare.split("%")[0] ?? "";
  if (blockList.check(withoutZone, "ipv6")) return true;
  const inner = embeddedIpv4(withoutZone);
  return inner !== null && blockList.check(inner, "ipv4");
}

// ---------------------------------------------------------------------------
// URL rules
// ---------------------------------------------------------------------------

/** Lowercase, without IPv6 brackets or trailing dots (`LOCALHOST.` → `localhost`). */
export function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.+$/, "");
}

function isBlockedHostname(hostname: string): boolean {
  return (
    hostname === "" ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".internal")
  );
}

/**
 * Checks the URL itself, without DNS: scheme, credentials, length and host name.
 * Uses the WHATWG URL parser, which also turns odd IPv4 spellings
 * (`http://2130706433/`, `http://0x7f.1/`) into normal dotted addresses.
 */
export function parseMonitorUrl(raw: string): { url: URL; hostname: string } {
  if (raw.length > MAX_URL_LENGTH) {
    throw new UnsafeUrlError("URL_TOO_LONG", `URL must be at most ${MAX_URL_LENGTH} characters`);
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("INVALID_URL", "URL is not a valid absolute URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("UNSUPPORTED_SCHEME", "URL must start with http:// or https://");
  }
  if (url.username !== "" || url.password !== "") {
    throw new UnsafeUrlError("CREDENTIALS_IN_URL", "URL must not contain a username or password");
  }

  const hostname = normalizeHostname(url.hostname);
  if (isBlockedHostname(hostname)) {
    throw new UnsafeUrlError("BLOCKED_HOSTNAME", "URL points to a local or internal host name");
  }
  if (isIP(hostname) !== 0 && isBlockedAddress(hostname)) {
    throw new UnsafeUrlError("BLOCKED_ADDRESS", "URL points to a private, internal or reserved address");
  }
  return { url, hostname };
}

/**
 * Applies every rule, resolving DNS when the host is a name, and returns the checked addresses.
 * If **any** resolved address is blocked, the whole URL is blocked.
 *
 * @throws UnsafeUrlError when the URL or any of its addresses is not allowed.
 * @throws HostLookupError when the host name does not resolve.
 */
export async function resolveSafeTarget(raw: string, resolve: Resolver = systemResolver): Promise<SafeTarget> {
  const { url, hostname } = parseMonitorUrl(raw);

  const family = isIP(hostname);
  if (family !== 0) {
    return { url, hostname, addresses: [{ address: hostname, family: family === 6 ? 6 : 4 }] };
  }

  let addresses: ResolvedAddress[];
  try {
    addresses = await resolve(hostname);
  } catch (cause) {
    throw new HostLookupError(hostname, { cause });
  }
  if (addresses.length === 0) throw new HostLookupError(hostname);

  if (addresses.some((a) => isBlockedAddress(a.address))) {
    throw new UnsafeUrlError("BLOCKED_ADDRESS", "URL resolves to a private, internal or reserved address");
  }
  return { url, hostname, addresses };
}

/**
 * For monitor create/edit. Fails closed: a host name that can't be resolved can't be shown
 * to be safe, so it is rejected as `400 UNSAFE_URL` too.
 */
export async function assertSafeMonitorUrl(raw: string, resolve: Resolver = systemResolver): Promise<void> {
  try {
    await resolveSafeTarget(raw, resolve);
  } catch (err) {
    if (err instanceof HostLookupError) {
      throw new UnsafeUrlError("DNS_LOOKUP_FAILED", "URL host name could not be resolved");
    }
    throw err;
  }
}

/**
 * A `lookup` function for `http.request` / `https.request` that only ever returns the addresses
 * `resolveSafeTarget` already checked. No second DNS query happens, so a DNS change between
 * the check and the connection can't redirect the request to a private address.
 * The original host name is still used for the `Host` header and TLS server name.
 */
export function pinnedLookup(target: SafeTarget): LookupFunction {
  return (hostname, options, callback) => {
    if (normalizeHostname(hostname) !== target.hostname) {
      const err: NodeJS.ErrnoException = new Error(`Refusing to resolve unexpected host ${hostname}`);
      err.code = "ENOTFOUND";
      callback(err, "", 0);
      return;
    }

    const wanted = options.family === 4 || options.family === "IPv4" ? 4
      : options.family === 6 || options.family === "IPv6" ? 6
      : 0;
    const matches: LookupAddress[] = target.addresses
      .filter((a) => wanted === 0 || a.family === wanted)
      .map((a) => ({ address: a.address, family: a.family }));

    if (matches.length === 0) {
      const err: NodeJS.ErrnoException = new Error(`No checked IPv${wanted} address for ${hostname}`);
      err.code = "ENOTFOUND";
      callback(err, "", 0);
      return;
    }
    if (options.all) {
      callback(null, matches);
      return;
    }
    const [first] = matches as [LookupAddress];
    callback(null, first.address, first.family);
  };
}
