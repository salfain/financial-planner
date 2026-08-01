import { callAppsScript } from "./apps-script-client";

export type FinanceMember = {
  id: string;
  displayName: string;
  role: "owner" | "editor";
  active: boolean;
  mustChangePin: boolean;
  email?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type FinanceMemberOverview = {
  mode: "single" | "couple";
  currentMember: FinanceMember | null;
  members: FinanceMember[];
};

export type FinanceMemberMutation = {
  member: FinanceMember;
  duplicate?: boolean;
};

export type FinancePinChange = {
  member: FinanceMember;
  sessionToken: string;
  sessionsRevoked: boolean;
};

export const listFinanceMembers = () =>
  callAppsScript<FinanceMemberOverview>("listMembers");

export const createFinanceMember = (input: { displayName: string; email?: string; initialPin: string }) =>
  callAppsScript<FinanceMemberMutation>("createMember", input);

export const updateFinanceMember = (input: { memberId: string; displayName?: string; email?: string; active?: boolean }) =>
  callAppsScript<FinanceMemberMutation>("updateMember", input);

export const changeOwnFinancePin = (currentPin: string, newPin: string) =>
  callAppsScript<FinancePinChange>("changeOwnPin", { currentPin, newPin });
