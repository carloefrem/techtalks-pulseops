import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CHECK_OUTCOMES,
  INCIDENT_SEVERITIES,
  severityForOutcome,
  type FailedCheckOutcome,
} from "../../src/incidents/severity.js";

describe("severityForOutcome (PULSE-112)", () => {
  it.each<FailedCheckOutcome>(["timeout", "connection_error", "dns_error", "blocked"])(
    "%s (no HTTP response) → critical",
    (outcome) => {
      expect(severityForOutcome(outcome)).toBe("critical");
    },
  );

  it("http_error (unexpected status code) → major", () => {
    expect(severityForOutcome("http_error")).toBe("major");
  });

  it("covers every failing outcome", () => {
    for (const outcome of CHECK_OUTCOMES.filter((o) => o !== "up")) {
      expect(INCIDENT_SEVERITIES).toContain(severityForOutcome(outcome as FailedCheckOutcome));
    }
  });
});

describe("severity values stay in sync with the database and the contract", () => {
  const migration = readFileSync(
    new URL("../../prisma/migrations/20261122000000_init/migration.sql", import.meta.url),
    "utf8",
  );
  const openapi = readFileSync(new URL("../../../docs/api/openapi.yaml", import.meta.url), "utf8");

  it("matches the incidents_severity CHECK constraint", () => {
    const check = migration.match(/incidents_severity CHECK \(severity IN \(([^)]*)\)\)/);
    expect(check, "incidents_severity constraint not found").not.toBeNull();
    const values = [...check![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(values).toEqual([...INCIDENT_SEVERITIES]);
  });

  it("matches the check_results_outcome CHECK constraint", () => {
    const check = migration.match(/check_results_outcome\s+CHECK \(outcome IN \(([^)]*)\)\)/);
    expect(check, "check_results_outcome constraint not found").not.toBeNull();
    const values = [...check![1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(values).toEqual([...CHECK_OUTCOMES]);
  });

  it("matches the severity enum in openapi.yaml", () => {
    const severity = openapi.match(/severity:\s*\n\s*type: string\s*\n\s*enum: \[([^\]]*)\]/);
    expect(severity, "severity enum not found in openapi.yaml").not.toBeNull();
    expect(severity![1].split(",").map((v) => v.trim())).toEqual([...INCIDENT_SEVERITIES]);
  });
});
