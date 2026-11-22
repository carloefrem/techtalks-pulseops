/**
 * Test-database guard (docs/backend/README.md section 5).
 * Runs BEFORE any test, migration or reset touches a database, and throws unless
 * TEST_DATABASE_URL is clearly a separate, local, *_test database.
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

function parse(url: string, label: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`${label} is not a valid URL`);
  }
  if (!/^postgres(ql)?:$/.test(parsed.protocol)) throw new Error(`${label} must start with postgresql://`);
  return parsed;
}

const dbName = (u: URL) => decodeURIComponent(u.pathname.replace(/^\//, ""));
const port = (u: URL) => u.port || "5432";

export function assertSafeTestDatabase(env: {
  TEST_DATABASE_URL?: string;
  DATABASE_URL?: string;
  NODE_ENV?: string;
}): string {
  if (env.NODE_ENV === "production") throw new Error("Refusing to run tests with NODE_ENV=production");
  if (!env.TEST_DATABASE_URL) throw new Error("TEST_DATABASE_URL is not set (see backend/.env.example)");

  const test = parse(env.TEST_DATABASE_URL, "TEST_DATABASE_URL");
  const name = dbName(test);
  if (!name.endsWith("_test")) throw new Error(`Test database name must end with _test (got "${name || "(none)"}")`);
  if (!LOCAL_HOSTS.has(test.hostname)) throw new Error(`Test database must be on this computer (got host "${test.hostname}")`);

  if (env.DATABASE_URL) {
    const dev = parse(env.DATABASE_URL, "DATABASE_URL");
    const same = dev.hostname === test.hostname && port(dev) === port(test) && dbName(dev) === name;
    if (same) throw new Error("TEST_DATABASE_URL points at the same database as DATABASE_URL");
  }
  return env.TEST_DATABASE_URL;
}

/** Second check, after connecting: the server must really be serving the *_test database. */
export function assertConnectedToTestDatabase(expectedUrl: string, currentDatabase: string): void {
  const expected = dbName(new URL(expectedUrl));
  if (currentDatabase !== expected) {
    throw new Error(`Connected to "${currentDatabase}" but TEST_DATABASE_URL names "${expected}"; refusing to continue`);
  }
}
