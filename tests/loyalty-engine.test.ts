import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { firstCyclePrompt } from "../lib/first-cycle-prompt.ts";
import {
  DEFAULT_CAMPAIGN,
  hashToken,
  isStaffAccount,
  kolkataDate,
  newCycle,
  planCampaignUpdate,
  planCreditVisit,
  planIssueToken,
  planRedeem,
  readRewardQr,
  summarizeLoyalty,
  type Campaign,
  type CustomerRecord,
  type CycleRecord,
  type RewardRecord,
} from "../lib/loyalty-engine.ts";

const staff = "staff-1";
const customer: CustomerRecord = {
  id: "cust-1",
  name: "Meera",
  phone: "9876543210",
  authUid: "customer-auth",
  customerCode: "ES0006",
  membershipQrId: "ES0006",
  activeCycleId: "cycle-1",
  visitCount: 0,
  rewardStatus: "locked",
};

function credit(input: {
  cycle: CycleRecord | null;
  amount: number;
  bill: string;
  now: Date;
  visitOnDate?: boolean;
  billAlreadyUsed?: boolean;
  openReward?: RewardRecord | null;
  campaign?: Campaign;
}) {
  return planCreditVisit({
    now: input.now,
    campaign: input.campaign || DEFAULT_CAMPAIGN,
    customer,
    cycle: input.cycle,
    openReward: input.openReward || null,
    visitOnDate: Boolean(input.visitOnDate),
    billAlreadyUsed: Boolean(input.billAlreadyUsed),
    billReference: input.bill,
    billAmount: input.amount,
    staffUid: staff,
    nextCycleId: "cycle-1",
    nextVisitId: `visit-${input.bill}`,
  });
}

test("calendar day uses Asia/Kolkata", () => {
  assert.equal(kolkataDate(new Date("2026-11-14T18:29:00.000Z")), "2026-11-14");
  assert.equal(kolkataDate(new Date("2026-11-14T18:30:00.000Z")), "2026-11-15");
});

test("first qualifying bill of 250 starts a cycle at 1/5", () => {
  const result = credit({
    cycle: null,
    amount: 250,
    bill: "BILL-1",
    now: new Date("2026-11-10T05:00:00.000Z"),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.cycle.visitCount, 1);
  assert.equal(result.cycle.requiredVisits, 5);
  assert.equal(result.cycle.minimumBillAmount, 200);
  assert.equal(result.reward, null);
  assert.equal(result.customerPatch.rewardStatus, "locked");
});

test("bill below 200 is rejected and a bill of exactly 200 counts", () => {
  const cycle = newCycle({ id: "cycle-1", customerId: customer.id, campaign: DEFAULT_CAMPAIGN, cycleNumber: 1 });
  const low = credit({ cycle, amount: 199, bill: "LOW", now: new Date("2026-11-10T05:00:00.000Z") });
  assert.equal(low.ok, false);
  const exact = credit({ cycle, amount: 200, bill: "EXACT", now: new Date("2026-11-10T05:00:00.000Z") });
  assert.equal(exact.ok, true);
});

test("the same calendar day and the same bill cannot count twice", () => {
  const cycle = newCycle({ id: "cycle-1", customerId: customer.id, campaign: DEFAULT_CAMPAIGN, cycleNumber: 1 });
  cycle.visitCount = 1;
  const sameDay = credit({
    cycle,
    amount: 300,
    bill: "BILL-2",
    now: new Date("2026-11-10T08:00:00.000Z"),
    visitOnDate: true,
  });
  const sameBill = credit({
    cycle,
    amount: 300,
    bill: "BILL-1",
    now: new Date("2026-11-11T05:00:00.000Z"),
    billAlreadyUsed: true,
  });
  assert.equal(sameDay.ok, false);
  assert.equal(sameBill.ok, false);
});

test("ten different days unlock one reward and a eleventh visit is blocked", () => {
  let cycle = newCycle({ id: "cycle-1", customerId: customer.id, campaign: DEFAULT_CAMPAIGN, cycleNumber: 1 });
  let reward: RewardRecord | null = null;
  for (let day = 1; day <= 10; day += 1) {
    const result = credit({
      cycle,
      amount: 250,
      bill: `DAY-${day}`,
      now: new Date(`2026-11-${String(day).padStart(2, "0")}T05:00:00.000Z`),
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    cycle = result.cycle;
    reward = result.reward;
  }
  assert.equal(cycle.visitCount, 10);
  assert.equal(cycle.status, "completed");
  assert.equal(reward?.status, "available");
  assert.equal(reward?.rewardName, "Free Chicken Snack");
  const extra = credit({
    cycle,
    amount: 250,
    bill: "DAY-11",
    now: new Date("2026-11-06T05:00:00.000Z"),
    openReward: reward,
  });
  assert.equal(extra.ok, false);
});

test("redemption QR is single use, expires, and starts the next cycle at 0", () => {
  const cycle = newCycle({ id: "cycle-1", customerId: customer.id, campaign: DEFAULT_CAMPAIGN, cycleNumber: 1 });
  cycle.visitCount = 10;
  cycle.status = "completed";
  const reward: RewardRecord = {
    id: cycle.id,
    customerId: customer.id,
    campaignId: DEFAULT_CAMPAIGN.id,
    cycleId: cycle.id,
    rewardName: "Free Chicken Snack",
    rewardType: "free_item",
    status: "available",
    redemptionTokenHash: null,
    tokenExpiresAt: null,
  };
  const issued = planIssueToken({ now: new Date("2026-11-14T05:00:00.000Z"), reward, token: "token-one-use-value-123456" });
  assert.equal(issued.ok, true);
  if (!issued.ok) return;
  assert.notEqual(issued.reward.redemptionTokenHash, "token-one-use-value-123456");
  assert.equal(issued.reward.redemptionTokenHash, hashToken("token-one-use-value-123456"));
  assert.equal(readRewardQr("ES0006"), null);
  assert.equal(readRewardQr(issued.qrValue), "token-one-use-value-123456");

  const invalid = planRedeem({
    now: new Date("2026-11-14T05:01:00.000Z"),
    token: "wrong-token-value-123456789",
    reward: issued.reward,
    customer,
    cycle,
    campaign: DEFAULT_CAMPAIGN,
    staffUid: staff,
    nextCycleId: "cycle-2",
  });
  assert.equal(invalid.ok, false);

  const selfRedeem = planRedeem({
    now: new Date("2026-11-14T05:01:00.000Z"),
    token: "token-one-use-value-123456",
    reward: issued.reward,
    customer,
    cycle,
    campaign: DEFAULT_CAMPAIGN,
    staffUid: customer.authUid || "",
    nextCycleId: "cycle-2",
  });
  assert.equal(selfRedeem.ok, false);

  const redeemed = planRedeem({
    now: new Date("2026-11-14T05:01:00.000Z"),
    token: "token-one-use-value-123456",
    reward: issued.reward,
    customer,
    cycle,
    campaign: DEFAULT_CAMPAIGN,
    staffUid: staff,
    nextCycleId: "cycle-2",
  });
  assert.equal(redeemed.ok, true);
  if (!redeemed.ok) return;
  assert.equal(redeemed.nextCycle.visitCount, 0);
  assert.equal(redeemed.nextCycle.cycleNumber, 2);
  assert.equal(redeemed.cycle.status, "redeemed");
  assert.equal(cycle.requiredVisits, 10);

  const duplicate = planRedeem({
    now: new Date("2026-11-14T05:02:00.000Z"),
    token: "token-one-use-value-123456",
    reward: redeemed.reward,
    customer,
    cycle: redeemed.cycle,
    campaign: DEFAULT_CAMPAIGN,
    staffUid: staff,
    nextCycleId: "cycle-3",
  });
  assert.equal(duplicate.ok, false);

  const expired = planIssueToken({ now: new Date("2026-11-14T05:00:00.000Z"), reward, token: "another-token-value-123456" });
  if (!expired.ok) return;
  const tooLate = planRedeem({
    now: new Date("2026-11-14T05:20:00.000Z"),
    token: "another-token-value-123456",
    reward: expired.reward,
    customer,
    cycle,
    campaign: DEFAULT_CAMPAIGN,
    staffUid: staff,
    nextCycleId: "cycle-2",
  });
  assert.equal(tooLate.ok, false);
});

test("a changed campaign does not rewrite the current cycle", () => {
  const cycle = newCycle({ id: "cycle-1", customerId: customer.id, campaign: DEFAULT_CAMPAIGN, cycleNumber: 1 });
  const updated = planCampaignUpdate(DEFAULT_CAMPAIGN, { requiredVisits: 3, minimumBillAmount: 500, rewardName: "Free Juice" });
  assert.equal(updated.ok, true);
  if (!updated.ok) return;
  assert.equal(cycle.requiredVisits, 10);
  assert.equal(cycle.minimumBillAmount, 200);
  assert.equal(cycle.rewardSnapshot.rewardName, "Free Chicken Snack");
  const next = newCycle({ id: "cycle-2", customerId: customer.id, campaign: updated.campaign, cycleNumber: 2 });
  assert.equal(next.requiredVisits, 3);
  assert.equal(next.minimumBillAmount, 500);
  const second = credit({
    cycle: next,
    amount: 500,
    bill: "CYCLE-2",
    now: new Date("2026-11-16T05:00:00.000Z"),
    campaign: updated.campaign,
  });
  assert.equal(second.ok, true);
  if (second.ok) assert.equal(second.cycle.visitCount, 1);
});

test("staff claims and customer writes are separated", () => {
  assert.equal(isStaffAccount({ email: "guest@example.com", role: "customer" }, "admin@epic.test"), false);
  assert.equal(isStaffAccount({ email: "person@epic.test", role: "staff" }, ""), true);
  assert.equal(isStaffAccount({ email: "admin@epic.test" }, "admin@epic.test"), true);
  const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
  assert.match(rules, /allow read, write: if false/);
  assert.doesNotMatch(rules, /allow update: if request\.auth != null/);
});

test("google review and instagram follow only on the first cycle", () => {
  assert.equal(firstCyclePrompt(1, 1), null);
  assert.equal(firstCyclePrompt(1, 2), "google-review");
  assert.equal(firstCyclePrompt(1, 3), null);
  assert.equal(firstCyclePrompt(1, 4), "instagram-follow");
  assert.equal(firstCyclePrompt(1, 5), null);
  assert.equal(firstCyclePrompt(2, 2), null);
  assert.equal(firstCyclePrompt(2, 4), null);
  assert.equal(firstCyclePrompt(3, 2), null);
  assert.equal(firstCyclePrompt(3, 4), null);
});

test("analytics count visit buckets without dropping redeemed history", () => {
  const summary = summarizeLoyalty({
    customers: 8,
    activeCycles: [{ visitCount: 1 }, { visitCount: 1 }, { visitCount: 4 }],
    completedCycles: 2,
    rewardsAvailable: 1,
    rewardsRedeemed: 3,
    qualifyingVisits: 14,
  });
  assert.equal(summary.visitBuckets["1"], 2);
  assert.equal(summary.visitBuckets["4"], 1);
  assert.equal(summary.rewardsRedeemed, 3);
  assert.equal(summary.qualifyingVisits, 14);
});
