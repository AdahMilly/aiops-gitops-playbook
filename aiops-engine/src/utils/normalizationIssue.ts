import { ISSUE_ALIASES } from "./aliases";

export function normalizeIssue(issue: string): string {
  return ISSUE_ALIASES[issue] ?? issue;
}
