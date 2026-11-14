import { timingSafeEqual } from "crypto";
import { FieldValue, type DocumentData } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import {
  CAMPAIGN_ID,
  DEFAULT_CAMPAIGN,
  createLoginPin,
  createRedemptionToken,
  hashToken,
  kolkataDate,
  newCycle,
  normalizeBill,
  normalizePhone,
  planCampaignUpdate,
  planCreditVisit,
  planIssueToken,
  planRedeem,
  summarizeLoyalty,
  type Campaign,
  type CustomerRecord,
  type CycleRecord,
  type RewardRecord,
} from "@/lib/loyalty-engine";

export class LoyaltyError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function text(value: unknown) {
  return String(value ?? "");
}

function asCampaign(data: DocumentData | undefined): Campaign {
  return {
    id: CAMPAIGN_ID,
    name: text(data?.name) || DEFAULT_CAMPAIGN.name,
    requiredVisits: Number(data?.requiredVisits) || DEFAULT_CAMPAIGN.requiredVisits,
    minimumBillAmount: Number(data?.minimumBillAmount ?? DEFAULT_CAMPAIGN.minimumBillAmount),
    rewardType: text(data?.rewardType) || DEFAULT_CAMPAIGN.rewardType,
    rewardName: text(data?.rewardName) || DEFAULT_CAMPAIGN.rewardName,
    rewardItemId: text(data?.rewardItemId) || DEFAULT_CAMPAIGN.rewardItemId,
    validity: data?.validity ? text(data.validity) : null,
    status: data?.status === "inactive" ? "inactive" : "active",
  };
}

function asCustomer(id: string, data: DocumentData): CustomerRecord {
  const code = text(data.customerCode || data.membershipQrId).toUpperCase();
  return {
    id,
    name: text(data.name),
    phone: normalizePhone(text(data.phone || data.mobile)),
    authUid: text(data.authUid) || null,
    customerCode: code,
    membershipQrId: code,
    activeCycleId: text(data.activeCycleId) || null,
    visitCount: Number(data.visitCount) || 0,
    rewardStatus: text(data.rewardStatus || "locked"),
  };
}

function asCycle(id: string, data: DocumentData): CycleRecord {
  return {
    id,
    customerId: text(data.customerId),
    campaignId: text(data.campaignId),
    cycleNumber: Number(data.cycleNumber) || 1,
    visitCount: Number(data.visitCount) || 0,
    requiredVisits: Number(data.requiredVisits) || DEFAULT_CAMPAIGN.requiredVisits,
    minimumBillAmount: Number(data.minimumBillAmount ?? DEFAULT_CAMPAIGN.minimumBillAmount),
    rewardSnapshot: {
      campaignName: text(data.rewardSnapshot?.campaignName || DEFAULT_CAMPAIGN.name),
      rewardType: text(data.rewardSnapshot?.rewardType || DEFAULT_CAMPAIGN.rewardType),
      rewardName: text(data.rewardSnapshot?.rewardName || DEFAULT_CAMPAIGN.rewardName),
      rewardItemId: text(data.rewardSnapshot?.rewardItemId || DEFAULT_CAMPAIGN.rewardItemId),
    },
    status: data.status === "completed" || data.status === "redeemed" ? data.status : "active",
  };
}

function asReward(id: string, data: DocumentData): RewardRecord {
  return {
    id,
    customerId: text(data.customerId),
    campaignId: text(data.campaignId),
    cycleId: text(data.cycleId),
    rewardName: text(data.rewardName),
    rewardType: text(data.rewardType),
    status: data.status === "redeemed" ? "redeemed" : "available",
    redemptionTokenHash: text(data.redemptionTokenHash) || null,
    tokenExpiresAt: text(data.tokenExpiresAt) || null,
  };
}

const campaignRef = () => adminDb.collection("loyaltyCampaigns").doc(CAMPAIGN_ID);

export async function ensureCampaign() {
  const ref = campaignRef();
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set({
      ...DEFAULT_CAMPAIGN,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return DEFAULT_CAMPAIGN;
  }
  return asCampaign(snap.data());
}

export async function saveCampaign(patch: Partial<Campaign>) {
  const current = await ensureCampaign();
  const planned = planCampaignUpdate(current, patch);
  if (!planned.ok) throw new LoyaltyError(400, planned.error);
  await campaignRef().set(
    {
      ...planned.campaign,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );
  return planned.campaign;
}

async function findCustomer(input: { customerCode?: string; phone?: string }) {
  const code = input.customerCode?.trim().toUpperCase() || "";
  const phone = input.phone ? normalizePhone(input.phone) : "";

  if (code) {
    const snap = await adminDb.collection("customers").where("customerCode", "==", code).limit(5).get();
    const match = snap.docs.find((doc) => {
      if (!phone) return true;
      return normalizePhone(text(doc.data().phone || doc.data().mobile)) === phone;
    });
    if (!match) throw new LoyaltyError(404, "Customer not found.");
    return asCustomer(match.id, match.data());
  }

  if (!/^[6-9]\d{9}$/.test(phone)) throw new LoyaltyError(400, "Enter a valid mobile number.");
  const snap = await adminDb.collection("customers").where("phone", "==", phone).limit(2).get();
  if (snap.empty) throw new LoyaltyError(404, "Customer not found.");
  if (snap.size > 1) throw new LoyaltyError(409, "More than one customer uses this mobile number.");
  return asCustomer(snap.docs[0].id, snap.docs[0].data());
}

export async function registerCustomer(input: { name: string; phone: string; authUid?: string | null }) {
  const name = input.name.trim().replace(/\s+/g, " ");
  const phone = normalizePhone(input.phone);
  if (name.length < 2 || name.length > 60) throw new LoyaltyError(400, "Invalid name.");
  if (!/^[6-9]\d{9}$/.test(phone)) throw new LoyaltyError(400, "Invalid registration details.");

  const campaign = await ensureCampaign();
  const counterRef = adminDb.collection("counters").doc("customerSequence");
  const customerRef = adminDb.collection("customers").doc();
  const cycleRef = adminDb.collection("loyaltyCycles").doc();

  const customerCode = await adminDb.runTransaction(async (tx) => {
    const existing = await tx.get(adminDb.collection("customers").where("phone", "==", phone).limit(1));
    if (!existing.empty) return "";

    const counterSnap = await tx.get(counterRef);
    const nextNumber = Number(counterSnap.data()?.lastNumber || 0) + 1;
    const code = `ES${String(nextNumber).padStart(4, "0")}`;
    const loginPin = createLoginPin();
    const cycle = newCycle({
      id: cycleRef.id,
      customerId: customerRef.id,
      campaign,
      cycleNumber: 1,
    });

    tx.set(counterRef, { lastNumber: nextNumber });
    tx.set(customerRef, {
      name,
      phone,
      mobile: phone,
      phoneE164: `+91${phone}`,
      authUid: input.authUid || null,
      customerCode: code,
      membershipQrId: code,
      loginPin,
      activeCycleId: cycle.id,
      source: "qr",
      status: "active",
      visitCount: 0,
      rewardStatus: "locked",
      rewardsSent: 0,
      consent: true,
      registeredAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    tx.set(cycleRef, {
      ...cycle,
      startedAt: FieldValue.serverTimestamp(),
    });
    return { code, loginPin };
  });

  if (!customerCode) throw new LoyaltyError(409, "This mobile number is already registered.");
  return { customerId: customerRef.id, customerCode: customerCode.code, phone, loginPin: customerCode.loginPin };
}

export async function loginWithPin(phoneInput: string, pinInput: string) {
  const phone = normalizePhone(phoneInput);
  const pin = pinInput.replace(/\D/g, "");
  if (!/^[6-9]\d{9}$/.test(phone) || !/^\d{4}$/.test(pin)) {
    throw new LoyaltyError(400, "Enter your mobile number and 4-digit PIN.");
  }

  const customer = await findCustomer({ phone });
  const saved = text((await adminDb.collection("customers").doc(customer.id).get()).data()?.loginPin);
  const savedBytes = Buffer.from(saved);
  const pinBytes = Buffer.from(pin);
  const matches = savedBytes.length === pinBytes.length && timingSafeEqual(savedBytes, pinBytes);
  if (!saved || !matches) {
    throw new LoyaltyError(401, "That PIN does not match. Ask EPIC Snacks staff for your login PIN.");
  }

  return { customerCode: customer.customerCode, phone: customer.phone, name: customer.name, loginPin: saved };
}

export async function shareLoginPin(customerCode: string) {
  const customer = await findCustomer({ customerCode });
  const ref = adminDb.collection("customers").doc(customer.id);
  const snap = await ref.get();
  let loginPin = text(snap.data()?.loginPin);
  if (!/^\d{4}$/.test(loginPin)) {
    loginPin = createLoginPin();
    await ref.set({ loginPin, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  return { customerCode: customer.customerCode, name: customer.name, loginPin };
}

export async function linkCustomerAuth(input: { name?: string; phone: string; authUid: string }) {
  const phone = normalizePhone(input.phone);
  const existing = await adminDb.collection("customers").where("phone", "==", phone).limit(2).get();
  if (existing.size > 1) throw new LoyaltyError(409, "More than one customer uses this mobile number.");
  if (existing.size === 1) {
    const doc = existing.docs[0];
    const authUid = text(doc.data().authUid);
    if (authUid && authUid !== input.authUid) {
      throw new LoyaltyError(403, "This mobile number is linked to another login.");
    }
    await doc.ref.set({ authUid: input.authUid, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return {
      customerId: doc.id,
      customerCode: text(doc.data().customerCode),
      phone,
      name: text(doc.data().name),
    };
  }

  const name = input.name?.trim() || "EPIC member";
  const created = await registerCustomer({ name, phone, authUid: input.authUid });
  return { ...created, name };
}

export async function creditVisit(input: {
  customerCode?: string;
  phone?: string;
  billReference: string;
  billAmount: number;
  staffUid: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const customer = await findCustomer(input);
  const campaign = await ensureCampaign();
  const date = kolkataDate(now);
  const billKey = normalizeBill(input.billReference);
  const customerRef = adminDb.collection("customers").doc(customer.id);
  const billRef = adminDb.collection("loyaltyBills").doc(billKey || "missing");
  const visitRef = adminDb.collection("loyaltyVisits").doc(`${customer.id}_${date}`);
  const newCycleRef = adminDb.collection("loyaltyCycles").doc();

  const result = await adminDb.runTransaction(async (tx) => {
    const customerSnap = await tx.get(customerRef);
    if (!customerSnap.exists) return { error: "Customer record not found.", status: 404 as const };
    const freshCustomer = asCustomer(customerSnap.id, customerSnap.data() || {});
    const cycleRefToRead = freshCustomer.activeCycleId
      ? adminDb.collection("loyaltyCycles").doc(freshCustomer.activeCycleId)
      : null;
    const cycleSnap = cycleRefToRead ? await tx.get(cycleRefToRead) : null;
    const cycle = cycleSnap?.exists ? asCycle(cycleSnap.id, cycleSnap.data() || {}) : null;
    const rewardSnap = cycle ? await tx.get(adminDb.collection("loyaltyRewards").doc(cycle.id)) : null;
    const billSnap = billKey ? await tx.get(billRef) : null;
    const visitSnap = await tx.get(visitRef);
    const openReward =
      rewardSnap?.exists && rewardSnap.data()?.status === "available"
        ? asReward(rewardSnap.id, rewardSnap.data() || {})
        : null;

    if (!cycle && freshCustomer.visitCount >= campaign.requiredVisits) {
      const migrated = newCycle({
        id: newCycleRef.id,
        customerId: freshCustomer.id,
        campaign,
        cycleNumber: 1,
      });
      migrated.visitCount = freshCustomer.visitCount;
      migrated.status = "completed";
      tx.set(adminDb.collection("loyaltyCycles").doc(migrated.id), {
        ...migrated,
        startedAt: FieldValue.serverTimestamp(),
      });
      tx.set(adminDb.collection("loyaltyRewards").doc(migrated.id), {
        id: migrated.id,
        customerId: freshCustomer.id,
        campaignId: campaign.id,
        cycleId: migrated.id,
        rewardName: migrated.rewardSnapshot.rewardName,
        rewardType: migrated.rewardSnapshot.rewardType,
        status: "available",
        redemptionTokenHash: null,
        tokenExpiresAt: null,
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(customerRef, { activeCycleId: migrated.id, rewardStatus: "unlocked" }, { merge: true });
      return { error: "Redeem the current reward before the next visit can count.", status: 400 as const };
    }

    const planned = planCreditVisit({
      now,
      campaign,
      customer: freshCustomer,
      cycle,
      openReward,
      visitOnDate: visitSnap.exists,
      billAlreadyUsed: Boolean(billSnap?.exists),
      billReference: input.billReference,
      billAmount: Number(input.billAmount),
      staffUid: input.staffUid,
      nextCycleId: newCycleRef.id,
      nextVisitId: visitRef.id,
    });
    if (!planned.ok) return { error: planned.error, status: 400 as const };

    const cycleRef = adminDb.collection("loyaltyCycles").doc(planned.cycle.id);
    tx.set(
      cycleRef,
      {
        ...planned.cycle,
        ...(planned.cycleIsNew ? { startedAt: FieldValue.serverTimestamp() } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    tx.set(visitRef, { ...planned.visit, verifiedAt: FieldValue.serverTimestamp() });
    tx.set(billRef, {
      billReference: planned.visit.billReference,
      billAmount: planned.visit.billAmount,
      customerId: freshCustomer.id,
      visitId: planned.visit.id,
      usedAt: FieldValue.serverTimestamp(),
    });
    if (planned.reward) {
      tx.set(adminDb.collection("loyaltyRewards").doc(planned.reward.id), {
        ...planned.reward,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    tx.set(customerRef, { ...planned.customerPatch, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return {
      error: "",
      status: 200 as const,
      visitCount: planned.customerPatch.visitCount,
      requiredVisits: planned.cycle.requiredVisits,
      rewardStatus: planned.customerPatch.rewardStatus,
      reward: planned.reward,
      visitDate: planned.visit.visitDate,
    };
  });

  if (result.error) throw new LoyaltyError(result.status, result.error);
  return { customer, ...result };
}

export async function issueRewardToken(input: { customerCode: string; phone: string; authUid?: string | null }) {
  const customer = await findCustomer(input);
  if (customer.authUid && customer.authUid !== input.authUid) {
    throw new LoyaltyError(403, "Sign in with the mobile number on this membership.");
  }
  const rewardSnap = await adminDb
    .collection("loyaltyRewards")
    .where("customerId", "==", customer.id)
    .where("status", "==", "available")
    .limit(1)
    .get();
  const reward = rewardSnap.empty ? null : asReward(rewardSnap.docs[0].id, rewardSnap.docs[0].data());
  const token = createRedemptionToken();
  const planned = planIssueToken({ now: new Date(), reward, token });
  if (!planned.ok || !reward) throw new LoyaltyError(400, planned.ok ? "There is no reward available to redeem." : planned.error);

  await adminDb.collection("loyaltyRewards").doc(reward.id).set(
    {
      redemptionTokenHash: planned.reward.redemptionTokenHash,
      tokenExpiresAt: planned.expiresAt,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    qrValue: planned.qrValue,
    expiresAt: planned.expiresAt,
    rewardName: reward.rewardName,
  };
}

export async function redeemReward(input: { token: string; staffUid: string; now?: Date }) {
  const now = input.now ?? new Date();
  const rewardSnap = await adminDb
    .collection("loyaltyRewards")
    .where("redemptionTokenHash", "==", hashToken(input.token))
    .limit(1)
    .get();
  if (rewardSnap.empty) throw new LoyaltyError(400, "This redemption QR is not valid.");
  const rewardDoc = rewardSnap.docs[0];
  const campaign = await ensureCampaign();
  const nextCycleRef = adminDb.collection("loyaltyCycles").doc();

  return adminDb.runTransaction(async (tx) => {
    const freshRewardSnap = await tx.get(rewardDoc.ref);
    if (!freshRewardSnap.exists) throw new LoyaltyError(400, "This redemption QR is not valid.");
    const reward = asReward(freshRewardSnap.id, freshRewardSnap.data() || {});
    const customerSnap = await tx.get(adminDb.collection("customers").doc(reward.customerId));
    const cycleSnap = await tx.get(adminDb.collection("loyaltyCycles").doc(reward.cycleId));
    if (!customerSnap.exists || !cycleSnap.exists) throw new LoyaltyError(404, "Reward records are incomplete.");
    const customer = asCustomer(customerSnap.id, customerSnap.data() || {});
    const cycle = asCycle(cycleSnap.id, cycleSnap.data() || {});
    const planned = planRedeem({
      now,
      token: input.token,
      reward,
      customer,
      cycle,
      campaign,
      staffUid: input.staffUid,
      nextCycleId: nextCycleRef.id,
    });
    if (!planned.ok) throw new LoyaltyError(400, planned.error);

    tx.set(freshRewardSnap.ref, {
      status: "redeemed",
      redemptionTokenHash: FieldValue.delete(),
      tokenExpiresAt: FieldValue.delete(),
      redeemedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(cycleSnap.ref, { status: "redeemed", redeemedAt: FieldValue.serverTimestamp() }, { merge: true });
    tx.set(nextCycleRef, { ...planned.nextCycle, startedAt: FieldValue.serverTimestamp() });
    tx.set(adminDb.collection("rewardRedemptions").doc(planned.redemption.id), {
      ...planned.redemption,
      redeemedAt: FieldValue.serverTimestamp(),
    });
    tx.set(customerSnap.ref, {
      activeCycleId: planned.customerPatch.activeCycleId,
      visitCount: 0,
      rewardStatus: "locked",
      rewardsSent: FieldValue.increment(planned.customerPatch.rewardsSent),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return {
      customerCode: customer.customerCode,
      rewardName: reward.rewardName,
      nextCycleNumber: planned.nextCycle.cycleNumber,
    };
  });
}

export async function customerProgress(input: { customerCode: string; phone: string }) {
  const customer = await findCustomer(input);
  const [cyclesSnap, visitsSnap, rewardsSnap] = await Promise.all([
    adminDb.collection("loyaltyCycles").where("customerId", "==", customer.id).get(),
    adminDb.collection("loyaltyVisits").where("customerId", "==", customer.id).get(),
    adminDb.collection("loyaltyRewards").where("customerId", "==", customer.id).get(),
  ]);
  const cycles = cyclesSnap.docs.map((doc) => asCycle(doc.id, doc.data()));
  const active = cycles.find((cycle) => cycle.id === customer.activeCycleId) || cycles.find((cycle) => cycle.status === "active");
  const available = rewardsSnap.docs.map((doc) => asReward(doc.id, doc.data())).find((reward) => reward.status === "available");
  const visits = visitsSnap.docs
    .map((doc) => doc.data())
    .sort((a, b) => text(b.visitDate).localeCompare(text(a.visitDate)));

  return {
    customerCode: customer.customerCode,
    name: customer.name,
    phone: customer.phone,
    visitCount: active?.visitCount ?? customer.visitCount,
    requiredVisits: active?.requiredVisits ?? DEFAULT_CAMPAIGN.requiredVisits,
    minimumBillAmount: active?.minimumBillAmount ?? DEFAULT_CAMPAIGN.minimumBillAmount,
    rewardStatus: available ? "unlocked" : "locked",
    rewardName: available?.rewardName || active?.rewardSnapshot.rewardName || DEFAULT_CAMPAIGN.rewardName,
    rewardAvailable: Boolean(available),
    cycleNumber: active?.cycleNumber || 1,
    rewardsSent: rewardsSnap.docs.filter((doc) => doc.data().status === "redeemed").length,
    visits: visits.map((visit) => ({
      visitDate: text(visit.visitDate),
      billAmount: Number(visit.billAmount) || 0,
      billReference: text(visit.billReference),
    })),
    rewards: rewardsSnap.docs.map((doc) => ({
      rewardName: text(doc.data().rewardName),
      status: text(doc.data().status),
      cycleId: text(doc.data().cycleId),
    })),
  };
}

export async function adminOverview(search: string) {
  const campaign = await ensureCampaign();
  const [customersSnap, cyclesSnap, rewardsSnap, visitsSnap] = await Promise.all([
    adminDb.collection("customers").get(),
    adminDb.collection("loyaltyCycles").get(),
    adminDb.collection("loyaltyRewards").get(),
    adminDb.collection("loyaltyVisits").get(),
  ]);
  const needle = search.trim().toLowerCase();
  const customers = customersSnap.docs
    .map((doc) => ({ id: doc.id, ...(doc.data() as DocumentData) }) as DocumentData & { id: string })
    .filter((customer) => {
      if (!needle) return true;
      const name = text(customer.name).toLowerCase();
      const phone = text(customer.phone || customer.mobile);
      const code = text(customer.customerCode).toLowerCase();
      return name.includes(needle) || phone.includes(needle) || code.includes(needle);
    })
    .sort((a, b) => text(b.customerCode).localeCompare(text(a.customerCode)));

  const activeCycles = cyclesSnap.docs
    .map((doc) => doc.data())
    .filter((cycle) => cycle.status === "active")
    .map((cycle) => ({ visitCount: Number(cycle.visitCount) || 0 }));
  const analytics = summarizeLoyalty({
    customers: customersSnap.size,
    activeCycles,
    completedCycles: cyclesSnap.docs.filter((doc) => doc.data().status === "completed" || doc.data().status === "redeemed").length,
    rewardsAvailable: rewardsSnap.docs.filter((doc) => doc.data().status === "available").length,
    rewardsRedeemed: rewardsSnap.docs.filter((doc) => doc.data().status === "redeemed").length,
    qualifyingVisits: visitsSnap.size,
  });

  return { campaign, customers, analytics };
}
