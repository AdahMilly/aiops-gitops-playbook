export function findRootCause(findings: any[]) {
  if (!findings.length) return "No anomalies detected.";

  return findings[0].issue;
}
