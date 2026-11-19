import { createHash, randomBytes, randomInt } from "crypto";

export const CAMPAIGN_ID = "epic-snacks-rewards-club";
export const REWARD_TOKEN_PREFIX = "EPICR:";
export const TOKEN_TTL_MS = 15 * 60 * 1000;

export const DEFAULT_CAMPAIGN: Campaign = {
  id: CAMPAIGN_ID,
  name: "EPIC Snacks Rewards Club",
  requiredVisits: 10,
  minimumBillAmount: 200,
  rewardType: "free_item",
  rewardName: "Free Chicken Snack",
  rewardItemId: "free-chicken-snack",
  validity: null,
  status: "active",
};

export type Campaign = {
  id: string;
  name: string;
  requiredVisits: number;
  minimumBillAmount: number;
  rewardType: string;
  rewardName: string;
  rewardItemId: string;
  validity: string | null;
  status: "active" | "inactive";
};

export type RewardSnapshot = {
  campaignName: string;
  rewardType: string;
  rewardName: string;
  rewardItemId: string;
};

export type CycleStatus = "active" | "completed" | "redeemed";
export type RewardStatus = "available" | "redeemed";

export type CustomerRecord = {
  id: string;
  name: string;
  phone: string;
  authUid?: string | null;
  customerCode: string;
  membershipQrId: string;
  activeCycleId?: string | null;
  visitCount: number;
  rewardStatus: string;
};

export type CycleRecord = {
  id: string;
  customerId: string;
  campaignId: string;
  cycleNumber: number;
  visitCount: number;
  requiredVisits: number;
  minimumBillAmount: number;
  rewardSnapshot: RewardSnapshot;
  status: CycleStatus;
};

export type VisitRecord = {
  id: string;
  customerId: string;
  campaignId: string;
  cycleId: string;
  billReference: string;
  billAmount: number;
  visitDate: string;
  verifiedBy: string;
  status: "qualified";
};

export type RewardRecord = {
  id: string;
  customerId: string;
  campaignId: string;
  cycleId: string;
  rewardName: string;
  rewardType: string;
  status: RewardStatus;
  redemptionTokenHash: string | null;
  tokenExpiresAt: string | null;
};

export type RedemptionRecord = {
  id: string;
  rewardId: string;
  customerId: string;
  cycleId: string;
  redeemedBy: string;
  status: "redeemed";
};

export type PlanFailure = { ok: false; error: string };
export type PlanSuccess<T> = { ok: true } & T;

export function kolkataDate(now: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function normalizeBill(raw: string) {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "-").replace(/-+/g, "-").slice(0, 120);
}

export function normalizePhone(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createRedemptionToken() {
  return randomBytes(32).toString("base64url");
}

export function createLoginPin() {
  return String(randomInt(0, 10000)).padStart(4, "0");
}

export function isStaffAccount(
  account: { email?: string | null; role?: unknown },
  adminEmail: string
) {
  if (account.role === "admin" || account.role === "staff") return true;
  const expected = adminEmail.trim().toLowerCase();
  return Boolean(expected) && account.email?.trim().toLowerCase() === expected;
}

function snapshot(campaign: Campaign): RewardSnapshot {
  return {
    campaignName: campaign.name,
    rewardType: campaign.rewardType,
    rewardName: campaign.rewardName,
    rewardItemId: campaign.rewardItemId,
  };
}

export function newCycle(input: {
  id: string;
  customerId: string;
  campaign: Campaign;
  cycleNumber: number;
}): CycleRecord {
  return {
    id: input.id,
    customerId: input.customerId,
    campaignId: input.campaign.id,
    cycleNumber: input.cycleNumber,
    visitCount: 0,
    requiredVisits: input.campaign.requiredVisits,
    minimumBillAmount: input.campaign.minimumBillAmount,
    rewardSnapshot: snapshot(input.campaign),
    status: "active",
  };
}

export function planCreditVisit(
  input: {
    now: Date;
    campaign: Campaign;
    customer: CustomerRecord;
    cycle: CycleRecord | null;
    openReward: RewardRecord | null;
    visitOnDate: boolean;
    billAlreadyUsed: boolean;
    billReference: string;
    billAmount: number;
    staffUid: string;
    nextCycleId: string;
    nextVisitId: string;
  }
): PlanFailure | PlanSuccess<{
  cycle: CycleRecord;
  cycleIsNew: boolean;
  visit: VisitRecord;
  reward: RewardRecord | null;
  billKey: string;
  customerPatch: { activeCycleId: string; visitCount: number; rewardStatus: string };
}> {
  if (input.campaign.status !== "active") {
    return { ok: false, error: "The rewards campaign is not active." };
  }
  if (input.campaign.validity && input.campaign.validity < kolkataDate(input.now)) {
    return { ok: false, error: "The rewards campaign has expired." };
  }
  if (!Number.isFinite(input.billAmount)) {
    return { ok: false, error: "Enter a valid bill amount." };
  }

  const cycleIsNew = !input.cycle;
  const cycle = input.cycle ?? {
    ...newCycle({
      id: input.nextCycleId,
      customerId: input.customer.id,
      campaign: input.campaign,
      cycleNumber: 1,
    }),
    visitCount: input.customer.visitCount,
  };

  if (input.billAmount < cycle.minimumBillAmount) {
    return {
      ok: false,
      error: `Bill must be at least ₹${cycle.minimumBillAmount} after discounts.`,
    };
  }

  const billKey = normalizeBill(input.billReference);
  if (!billKey) return { ok: false, error: "Enter the bill number." };
  if (input.billAlreadyUsed) {
    return { ok: false, error: "This bill number has already been used." };
  }
  if (input.openReward || cycle.status === "completed") {
    return { ok: false, error: "Redeem the current reward before the next visit can count." };
  }
  if (cycle.status !== "active") {
    return { ok: false, error: "This loyalty cycle is no longer active." };
  }
  if (input.visitOnDate) {
    return { ok: false, error: "This customer already has a qualifying visit today." };
  }

  const visitDate = kolkataDate(input.now);
  const visitCount = cycle.visitCount + 1;
  const completed = visitCount >= cycle.requiredVisits;
  const next: CycleRecord = {
    ...cycle,
    visitCount,
    status: completed ? "completed" : "active",
  };
  const visit: VisitRecord = {
    id: input.nextVisitId,
    customerId: input.customer.id,
    campaignId: input.campaign.id,
    cycleId: cycle.id,
    billReference: input.billReference.trim(),
    billAmount: input.billAmount,
    visitDate,
    verifiedBy: input.staffUid,
    status: "qualified",
  };
  const reward: RewardRecord | null = completed
    ? {
        id: cycle.id,
        customerId: input.customer.id,
        campaignId: input.campaign.id,
        cycleId: cycle.id,
        rewardName: cycle.rewardSnapshot.rewardName,
        rewardType: cycle.rewardSnapshot.rewardType,
        status: "available",
        redemptionTokenHash: null,
        tokenExpiresAt: null,
      }
    : null;

  return {
    ok: true,
    cycle: next,
    cycleIsNew,
    visit,
    reward,
    billKey,
    customerPatch: {
      activeCycleId: cycle.id,
      visitCount,
      rewardStatus: completed ? "unlocked" : "locked",
    },
  };
}

export function planIssueToken(input: {
  now: Date;
  reward: RewardRecord | null;
  token: string;
}): PlanFailure | PlanSuccess<{ reward: RewardRecord; qrValue: string; expiresAt: string }> {
  if (!input.reward || input.reward.status !== "available") {
    return { ok: false, error: "There is no reward available to redeem." };
  }
  const expiresAt = new Date(input.now.getTime() + TOKEN_TTL_MS).toISOString();
  return {
    ok: true,
    qrValue: `${REWARD_TOKEN_PREFIX}${input.token}`,
    expiresAt,
    reward: {
      ...input.reward,
      redemptionTokenHash: hashToken(input.token),
      tokenExpiresAt: expiresAt,
    },
  };
}

export function readRewardQr(raw: string) {
  const text = raw.trim();
  if (!text.startsWith(REWARD_TOKEN_PREFIX)) return null;
  const token = text.slice(REWARD_TOKEN_PREFIX.length).trim();
  if (token.length < 20) return null;
  return token;
}

export function planRedeem(input: {
  now: Date;
  token: string;
  reward: RewardRecord | null;
  customer: CustomerRecord;
  cycle: CycleRecord;
  campaign: Campaign;
  staffUid: string;
  nextCycleId: string;
}): PlanFailure | PlanSuccess<{
  reward: RewardRecord;
  cycle: CycleRecord;
  redemption: RedemptionRecord;
  nextCycle: CycleRecord;
  customerPatch: { activeCycleId: string; visitCount: number; rewardStatus: string; rewardsSent: number };
}> {
  if (!input.reward) return { ok: false, error: "This redemption QR is not valid." };
  if (input.staffUid && input.customer.authUid && input.staffUid === input.customer.authUid) {
    return { ok: false, error: "Customers cannot redeem their own rewards." };
  }
  if (input.reward.status !== "available") {
    return { ok: false, error: "This reward has already been redeemed." };
  }
  if (!input.reward.redemptionTokenHash || hashToken(input.token) !== input.reward.redemptionTokenHash) {
    return { ok: false, error: "This redemption QR is not valid." };
  }
  if (!input.reward.tokenExpiresAt || input.reward.tokenExpiresAt <= input.now.toISOString()) {
    return { ok: false, error: "This redemption QR has expired. Ask the customer to open it again." };
  }
  if (input.cycle.status !== "completed") {
    return { ok: false, error: "This reward is not ready to redeem." };
  }

  const nextCycle = newCycle({
    id: input.nextCycleId,
    customerId: input.customer.id,
    campaign: input.campaign,
    cycleNumber: input.cycle.cycleNumber + 1,
  });

  return {
    ok: true,
    reward: { ...input.reward, status: "redeemed", redemptionTokenHash: null, tokenExpiresAt: null },
    cycle: { ...input.cycle, status: "redeemed" },
    nextCycle,
    redemption: {
      id: input.reward.id,
      rewardId: input.reward.id,
      customerId: input.customer.id,
      cycleId: input.cycle.id,
      redeemedBy: input.staffUid,
      status: "redeemed",
    },
    customerPatch: {
      activeCycleId: nextCycle.id,
      visitCount: 0,
      rewardStatus: "locked",
      rewardsSent: 1,
    },
  };
}

export function planCampaignUpdate(current: Campaign, patch: Partial<Campaign>): PlanFailure | PlanSuccess<{ campaign: Campaign }> {
  const next: Campaign = {
    ...current,
    name: patch.name?.trim() || current.name,
    requiredVisits: patch.requiredVisits ?? current.requiredVisits,
    minimumBillAmount: patch.minimumBillAmount ?? current.minimumBillAmount,
    rewardType: patch.rewardType?.trim() || current.rewardType,
    rewardName: patch.rewardName?.trim() || current.rewardName,
    rewardItemId: patch.rewardItemId?.trim() || current.rewardItemId,
    validity: patch.validity === undefined ? current.validity : patch.validity,
    status: patch.status ?? current.status,
  };

  if (next.requiredVisits < 1 || next.requiredVisits > 20 || !Number.isInteger(next.requiredVisits)) {
    return { ok: false, error: "Required visits must be a whole number from 1 to 20." };
  }
  if (!Number.isFinite(next.minimumBillAmount) || next.minimumBillAmount < 0) {
    return { ok: false, error: "Enter a valid minimum bill amount." };
  }
  if (!next.name || !next.rewardName) {
    return { ok: false, error: "Campaign name and reward name are required." };
  }
  return { ok: true, campaign: next };
}

export type Analytics = {
  registeredCustomers: number;
  activeParticipants: number;
  visitBuckets: Record<"1" | "2" | "3" | "4", number>;
  completedCycles: number;
  rewardsAvailable: number;
  rewardsRedeemed: number;
  qualifyingVisits: number;
};

export function summarizeLoyalty(input: {
  customers: number;
  activeCycles: Array<{ visitCount: number }>;
  completedCycles: number;
  rewardsAvailable: number;
  rewardsRedeemed: number;
  qualifyingVisits: number;
}): Analytics {
  const visitBuckets = { "1": 0, "2": 0, "3": 0, "4": 0 };
  for (const cycle of input.activeCycles) {
    const key = String(cycle.visitCount) as "1" | "2" | "3" | "4";
    if (key in visitBuckets) visitBuckets[key] += 1;
  }
  return {
    registeredCustomers: input.customers,
    activeParticipants: input.activeCycles.length,
    visitBuckets,
    completedCycles: input.completedCycles,
    rewardsAvailable: input.rewardsAvailable,
    rewardsRedeemed: input.rewardsRedeemed,
    qualifyingVisits: input.qualifyingVisits,
  };
}
