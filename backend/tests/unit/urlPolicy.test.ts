import { describe, expect, it } from "vitest";
import { createServer, request, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
  HostLookupError,
  UnsafeUrlError,
  assertSafeMonitorUrl,
  embeddedIpv4,
  isBlockedAddress,
  parseMonitorUrl,
  pinnedLookup,
  resolveSafeTarget,
  type ResolvedAddress,
  type Resolver,
  type SafeTarget,
} from "../../src/monitoring/urlPolicy.js";

/** Fake DNS so these tests never touch the network. */
function fakeResolver(records: Record<string, ResolvedAddress[]>): Resolver {
  return async (hostname) => {
    const found = records[hostname];
    if (!found) throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), { code: "ENOTFOUND" });
    return found;
  };
}

const v4 = (address: string): ResolvedAddress => ({ address, family: 4 });
const v6 = (address: string): ResolvedAddress => ({ address, family: 6 });

async function reasonFor(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof UnsafeUrlError) return err.reason;
    throw err;
  }
  return "ALLOWED";
}

describe("isBlockedAddress: IPv4 ranges", () => {
  it.each([
    ["0.0.0.0", "this network"],
    ["0.255.255.255", "this network (end)"],
    ["10.0.0.1", "private 10/8"],
    ["10.255.255.255", "private 10/8 (end)"],
    ["100.64.0.1", "CGNAT"],
    ["100.127.255.255", "CGNAT (end)"],
    ["127.0.0.1", "loopback"],
    ["127.255.255.254", "loopback (end)"],
    ["169.254.169.254", "cloud metadata"],
    ["172.16.0.1", "private 172.16/12"],
    ["172.31.255.255", "private 172.16/12 (end)"],
    ["192.0.0.8", "IETF assignments"],
    ["192.0.2.10", "documentation"],
    ["192.88.99.1", "6to4 relay anycast (deprecated)"],
    ["192.168.1.1", "private 192.168/16"],
    ["198.18.0.1", "benchmarking"],
    ["198.19.255.255", "benchmarking (end)"],
    ["198.51.100.7", "documentation"],
    ["203.0.113.9", "documentation"],
    ["224.0.0.1", "multicast"],
    ["239.255.255.255", "multicast (end)"],
    ["240.0.0.1", "reserved"],
    ["255.255.255.255", "broadcast"],
  ])("blocks %s (%s)", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each(["8.8.8.8", "1.1.1.1", "93.184.215.14", "172.15.255.255", "172.32.0.0", "100.63.255.255", "100.128.0.0", "11.0.0.1"])(
    "allows public address %s",
    (address) => {
      expect(isBlockedAddress(address)).toBe(false);
    },
  );
});

describe("isBlockedAddress: IPv6 ranges", () => {
  it.each([
    ["::", "unspecified"],
    ["::1", "loopback"],
    ["[::1]", "loopback in brackets"],
    ["::7f00:1", "IPv4-compatible"],
    ["100::1", "discard"],
    ["2001:db8::1", "documentation"],
    ["fc00::1", "unique-local"],
    ["fd12:3456::1", "unique-local"],
    ["fe80::1", "link-local"],
    ["fe80::1%eth0", "link-local with zone id"],
    ["fec0::1", "site-local"],
    ["ff02::1", "multicast"],
    ["2001:0:4136:e378:8000:63bf:3fff:fdd2", "Teredo (Carlo's PR #11 review)"],
    ["2001::1", "Teredo"],
    ["64:ff9b:1::a00:1", "local-use NAT64 with private 10.0.0.1"],
    ["64:ff9b:1:ffff::1", "local-use NAT64"],
  ])("blocks %s (%s)", (address) => {
    expect(isBlockedAddress(address)).toBe(true);
  });

  it.each([
    "2606:4700:4700::1111",
    "2001:4860:4860::8888",
    "2001:1::1",
    "::ffff:8.8.8.8",
    "64:ff9b::808:808",
    "64:ff9b:2::1",
    "2002:808:808::1",
  ])(
    "allows public address %s",
    (address) => {
      expect(isBlockedAddress(address)).toBe(false);
    },
  );
});

describe("IPv6 addresses that carry an IPv4 address", () => {
  it.each([
    ["::ffff:127.0.0.1", "127.0.0.1"],
    ["::ffff:7f00:1", "127.0.0.1"],
    ["::FFFF:10.0.0.1", "10.0.0.1"],
    ["::ffff:a9fe:a9fe", "169.254.169.254"],
    ["64:ff9b::7f00:1", "127.0.0.1"],
    ["64:ff9b::192.168.0.1", "192.168.0.1"],
    ["2002:c0a8:101::1", "192.168.1.1"],
    ["2002:7f00:1::", "127.0.0.1"],
  ])("%s carries %s and is blocked", (address, inner) => {
    expect(embeddedIpv4(address)).toBe(inner);
    expect(isBlockedAddress(address)).toBe(true);
  });

  it("returns null for a normal IPv6 address", () => {
    expect(embeddedIpv4("2606:4700:4700::1111")).toBeNull();
  });
});

describe("isBlockedAddress: anything that is not an IP", () => {
  it.each(["", "example.com", "999.1.1.1", "1.2.3", ":::"])("blocks %j", (value) => {
    expect(isBlockedAddress(value)).toBe(true);
  });
});

describe("parseMonitorUrl: URL shape", () => {
  it("accepts a normal public URL and keeps it as typed", () => {
    const { url, hostname } = parseMonitorUrl("https://API.example.com:443/health?x=1");
    expect(hostname).toBe("api.example.com");
    expect(url.pathname).toBe("/health");
  });

  it.each([
    ["ftp://example.com/", "UNSUPPORTED_SCHEME"],
    ["file:///etc/passwd", "UNSUPPORTED_SCHEME"],
    ["javascript:alert(1)", "UNSUPPORTED_SCHEME"],
    ["gopher://example.com/", "UNSUPPORTED_SCHEME"],
    ["example.com/health", "INVALID_URL"],
    ["not a url", "INVALID_URL"],
    ["https://user:pass@example.com/", "CREDENTIALS_IN_URL"],
    ["https://user@example.com/", "CREDENTIALS_IN_URL"],
    ["http://localhost:3001/api/health", "BLOCKED_HOSTNAME"],
    ["http://LOCALHOST./", "BLOCKED_HOSTNAME"],
    ["http://app.localhost/", "BLOCKED_HOSTNAME"],
    ["http://metadata.google.internal/", "BLOCKED_HOSTNAME"],
    ["http://db.corp.internal./", "BLOCKED_HOSTNAME"],
    [`https://example.com/${"a".repeat(2048)}`, "URL_TOO_LONG"],
  ])("rejects %s (%s)", (raw, reason) => {
    expect(() => parseMonitorUrl(raw)).toThrow(UnsafeUrlError);
    try {
      parseMonitorUrl(raw);
    } catch (err) {
      expect((err as UnsafeUrlError).reason).toBe(reason);
    }
  });

  it.each([
    "http://127.0.0.1/",
    "http://2130706433/", // decimal 127.0.0.1
    "http://0x7f.1/", // hex
    "http://0177.0.0.1/", // octal
    "http://127.1/", // short form
    "http://0/", // 0.0.0.0
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[64:ff9b::a00:1]/",
    "http://169.254.169.254/latest/meta-data/",
  ])("rejects IP literal %s without any DNS lookup", (raw) => {
    expect(() => parseMonitorUrl(raw)).toThrow(/private, internal or reserved/);
  });

  it("does not treat names that merely contain 'localhost' or 'internal' as blocked", () => {
    expect(() => parseMonitorUrl("https://localhost-status.example.com/")).not.toThrow();
    expect(() => parseMonitorUrl("https://internal.example.com/")).not.toThrow();
  });
});

describe("resolveSafeTarget: DNS", () => {
  const dns = fakeResolver({
    "api.example.com": [v4("93.184.215.14"), v6("2606:2800:21f:cb07:6820:80da:af6b:8b2c")],
    "evil.example.com": [v4("127.0.0.1")],
    "mixed.example.com": [v4("93.184.215.14"), v4("10.0.0.5")],
    "mapped.example.com": [v6("::ffff:169.254.169.254")],
    "nat64.example.com": [v6("64:ff9b::c0a8:1")],
    "empty.example.com": [],
  });

  it("returns every checked address for a public host", async () => {
    const target = await resolveSafeTarget("https://api.example.com/health", dns);
    expect(target.hostname).toBe("api.example.com");
    expect(target.addresses).toHaveLength(2);
  });

  it("skips DNS for a public IP literal", async () => {
    const target = await resolveSafeTarget("http://93.184.215.14/", async () => {
      throw new Error("DNS should not be called");
    });
    expect(target.addresses).toEqual([{ address: "93.184.215.14", family: 4 }]);
  });

  it("blocks a public name that resolves to a private address", async () => {
    expect(await reasonFor(resolveSafeTarget("https://evil.example.com/", dns))).toBe("BLOCKED_ADDRESS");
  });

  it("blocks a host when any one of its addresses is private", async () => {
    expect(await reasonFor(resolveSafeTarget("https://mixed.example.com/", dns))).toBe("BLOCKED_ADDRESS");
  });

  it("blocks IPv4-mapped and NAT64 answers that hide a private address", async () => {
    expect(await reasonFor(resolveSafeTarget("https://mapped.example.com/", dns))).toBe("BLOCKED_ADDRESS");
    expect(await reasonFor(resolveSafeTarget("https://nat64.example.com/", dns))).toBe("BLOCKED_ADDRESS");
  });

  it("reports a name that doesn't resolve as HostLookupError (a DNS failure, not 'blocked')", async () => {
    await expect(resolveSafeTarget("https://missing.example.com/", dns)).rejects.toBeInstanceOf(HostLookupError);
    await expect(resolveSafeTarget("https://empty.example.com/", dns)).rejects.toBeInstanceOf(HostLookupError);
  });

  it("checks the URL shape before resolving", async () => {
    let called = false;
    const spy: Resolver = async () => {
      called = true;
      return [];
    };
    expect(await reasonFor(resolveSafeTarget("http://localhost/", spy))).toBe("BLOCKED_HOSTNAME");
    expect(called).toBe(false);
  });

  it("checks again on every call, so a DNS change after saving is caught", async () => {
    let answer = [v4("93.184.215.14")];
    const changing: Resolver = async () => answer;
    await expect(resolveSafeTarget("https://rebind.example.com/", changing)).resolves.toBeDefined();
    answer = [v4("192.168.0.10")];
    expect(await reasonFor(resolveSafeTarget("https://rebind.example.com/", changing))).toBe("BLOCKED_ADDRESS");
  });
});

describe("assertSafeMonitorUrl (monitor create/edit)", () => {
  const dns = fakeResolver({ "api.example.com": [v4("93.184.215.14")], "evil.example.com": [v4("10.1.2.3")] });

  it("allows a public URL", async () => {
    await expect(assertSafeMonitorUrl("https://api.example.com/health", dns)).resolves.toBeUndefined();
  });

  it("rejects an unsafe URL as 400 UNSAFE_URL in the shared error shape", async () => {
    const err = await assertSafeMonitorUrl("https://evil.example.com/", dns).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(UnsafeUrlError);
    expect(err).toMatchObject({
      status: 400,
      code: "UNSAFE_URL",
      details: [{ field: "url", message: expect.any(String) }],
    });
  });

  it("fails closed when the host name doesn't resolve", async () => {
    expect(await reasonFor(assertSafeMonitorUrl("https://missing.example.com/", dns))).toBe("DNS_LOOKUP_FAILED");
  });
});

describe("pinnedLookup", () => {
  const target: SafeTarget = {
    url: new URL("https://api.example.com/"),
    hostname: "api.example.com",
    addresses: [v4("93.184.215.14"), v6("2606:2800:21f:cb07:6820:80da:af6b:8b2c")],
  };
  const lookup = pinnedLookup(target);

  function call(hostname: string, options: Parameters<typeof lookup>[1]) {
    return new Promise<{ err: NodeJS.ErrnoException | null; address: unknown; family?: number }>((resolve) => {
      lookup(hostname, options, (err, address, family) => resolve({ err, address, family }));
    });
  }

  it("returns the first checked address", async () => {
    expect(await call("api.example.com", {})).toEqual({ err: null, address: "93.184.215.14", family: 4 });
  });

  it("respects the requested family", async () => {
    const res = await call("api.example.com", { family: 6 });
    expect(res.address).toBe("2606:2800:21f:cb07:6820:80da:af6b:8b2c");
  });

  it("returns every checked address when asked for all", async () => {
    const res = await call("api.example.com", { all: true });
    expect(res.address).toHaveLength(2);
  });

  it("refuses any other host name", async () => {
    const res = await call("other.example.com", {});
    expect(res.err?.code).toBe("ENOTFOUND");
  });

  it("is used by http.request instead of a fresh DNS query", async () => {
    // A local server stands in for "the address that was checked". The policy would block
    // 127.0.0.1, so this target is built by hand: the test only shows that the hook is honoured.
    const server: Server = createServer((_req, res) => res.end("pinned"));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const { port } = server.address() as AddressInfo;
    const local: SafeTarget = {
      url: new URL(`http://pinned.test:${port}/`),
      hostname: "pinned.test",
      addresses: [v4("127.0.0.1")],
    };

    try {
      const body = await new Promise<string>((resolve, reject) => {
        const req = request(local.url, { lookup: pinnedLookup(local) }, (res) => {
          let data = "";
          res.on("data", (chunk) => (data += chunk));
          res.on("end", () => resolve(data));
        });
        req.on("error", reject);
        req.end();
      });
      expect(body).toBe("pinned");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
