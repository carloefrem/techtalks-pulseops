/**
 * Incident severity (PULSE-112, docs/api/README.md §5.5). The values match the database CHECK
 * constraint `incidents_severity` (docs/database/schema.sql), so no migration is needed.
 *
 * Severity is set once, from the first failing check of an incident, and never changes afterwards:
 * - `critical`: no HTTP response at all (timeout, connection error, DNS error, or blocked by BR-02)
 * - `major`: the server answered, but with an unexpected status (`http_error`)
 */
export const INCIDENT_SEVERITIES = ["critical", "major"] as const;
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];

/** Check outcomes, matching the `check_results_outcome` CHECK constraint. */
export const CHECK_OUTCOMES = ["up", "http_error", "timeout", "connection_error", "dns_error", "blocked"] as const;
export type CheckOutcome = (typeof CHECK_OUTCOMES)[number];
export type FailedCheckOutcome = Exclude<CheckOutcome, "up">;

const SEVERITY_BY_OUTCOME: Record<FailedCheckOutcome, IncidentSeverity> = {
  timeout: "critical",
  connection_error: "critical",
  dns_error: "critical",
  blocked: "critical",
  http_error: "major",
};

/** The severity of a new incident, from the outcome of the check that opened it. */
export function severityForOutcome(outcome: FailedCheckOutcome): IncidentSeverity {
  return SEVERITY_BY_OUTCOME[outcome];
}
