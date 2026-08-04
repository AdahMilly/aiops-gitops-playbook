export function correlate(data: any) {
  const findings = [];

  if (data.health.cpu > 80 && data.traces.length > 0) {
    findings.push({
      severity: "High",
      issue: "CPU spike accompanied by traces.",
    });
  }

  if (data.logs.length > 20 && data.traces.length === 0) {
    findings.push({
      severity: "Medium",
      issue: "Errors detected but no tracing.",
    });
  }

  return findings;
}
