/** Which members of a node a list shows: the node's own, or those of the branches below it. */
export const MEMBER_SCOPES = ["direct", "descendants"] as const;
export type MemberScope = (typeof MEMBER_SCOPES)[number];
