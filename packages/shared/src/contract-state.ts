import type { ContractStatus } from "./constants";

/**
 * Contract state machine (plan section B3). The database functions enforce these transitions;
 * the UI uses this map to decide which actions to show.
 */
export const CONTRACT_TRANSITIONS: Record<ContractStatus, readonly ContractStatus[]> = {
  awaiting_funding: ["active", "cancelled"],
  active: ["in_review", "cancelled", "disputed"],
  in_review: ["revision_requested", "approved", "disputed"],
  revision_requested: ["in_review", "disputed"],
  approved: ["paid_out"],
  paid_out: ["closed"],
  closed: [],
  cancelled: [],
  disputed: ["approved", "cancelled", "closed"],
};

export function canTransition(from: ContractStatus, to: ContractStatus): boolean {
  return CONTRACT_TRANSITIONS[from].includes(to);
}

/** Statuses where the creator can upload work. */
export const CREATOR_CAN_SUBMIT: readonly ContractStatus[] = [
  "active",
  "in_review",
  "revision_requested",
];

/** Statuses where both sides can leave a review. */
export const REVIEWABLE: readonly ContractStatus[] = ["paid_out", "closed"];
