export type RemediationExecutionMode = "observe" | "dry-run" | "execute";

export type RemediationActionStatus =
  | "Skipped"
  | "Validated"
  | "Executed"
  | "Failed"
  | "Blocked"
  | "AwaitingApproval";
