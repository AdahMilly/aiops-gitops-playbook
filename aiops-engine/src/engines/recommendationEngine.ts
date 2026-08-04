export function recommend(causes: any[]) {
  return causes.map((cause) => ({
    issue: cause.title,
    action: cause.recommendation,
  }));
}
