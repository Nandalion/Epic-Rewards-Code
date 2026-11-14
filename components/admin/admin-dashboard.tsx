"use client";

import type { Customer } from "@/components/admin/types";

type AdminDashboardProps = {
  customers: Customer[];
  scannerOn: boolean;
  scanError: string;
  notice: string;
  selected: Customer | null;
  purchaseVerified: boolean;
  billNumber: string;
  billAmount: string;
  rewardText: string;
  busy: boolean;
  onToggleScanner: () => void;
  onLookup: (raw: string) => void;
  onBillNumberChange: (value: string) => void;
  onBillAmountChange: (value: string) => void;
  onPurchaseVerifiedChange: (value: boolean) => void;
  onRecordPurchase: () => void;
  onRewardTextChange: (value: string) => void;
  onOpenReward: (customer: Customer) => void;
  onMarkRewardSent: (customer: Customer) => void;
  onCreatePin: (customer: Customer) => void;
};

export function AdminDashboard({
  customers,
  scannerOn,
  scanError,
  notice,
  selected,
  purchaseVerified,
  billNumber,
  billAmount,
  rewardText,
  busy,
  onToggleScanner,
  onLookup,
  onBillNumberChange,
  onBillAmountChange,
  onPurchaseVerifiedChange,
  onRecordPurchase,
  onRewardTextChange,
  onOpenReward,
  onMarkRewardSent,
  onCreatePin,
}: AdminDashboardProps) {
  const unlockedCount = customers.filter(
    (customer) => customer.rewardStatus === "unlocked"
  ).length;
  const rewardsSent = customers.reduce(
    (total, customer) => total + Number(customer.rewardsSent || 0),
    0
  );

  return (
    <>
      <section className="mt-7 grid gap-3 sm:grid-cols-3">
        <StatCard label="Registered customers" value={customers.length} />
        <StatCard label="Rewards unlocked" value={unlockedCount} />
        <StatCard label="Rewards sent" value={rewardsSent} />
      </section>

      <PurchaseRecorder
        scannerOn={scannerOn}
        scanError={scanError}
        notice={notice}
        selected={selected}
        purchaseVerified={purchaseVerified}
        billNumber={billNumber}
        billAmount={billAmount}
        busy={busy}
        onToggleScanner={onToggleScanner}
        onLookup={onLookup}
        onBillNumberChange={onBillNumberChange}
        onBillAmountChange={onBillAmountChange}
        onPurchaseVerifiedChange={onPurchaseVerifiedChange}
        onRecordPurchase={onRecordPurchase}
      />

      <CustomerProgress
        customers={customers}
        rewardText={rewardText}
        busy={busy}
        onRewardTextChange={onRewardTextChange}
        onOpenReward={onOpenReward}
        onMarkRewardSent={onMarkRewardSent}
        onCreatePin={onCreatePin}
      />
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function PurchaseRecorder({
  scannerOn,
  scanError,
  notice,
  selected,
  purchaseVerified,
  billNumber,
  billAmount,
  busy,
  onToggleScanner,
  onLookup,
  onBillNumberChange,
  onBillAmountChange,
  onPurchaseVerifiedChange,
  onRecordPurchase,
}: Pick<
  AdminDashboardProps,
  | "scannerOn"
  | "scanError"
  | "notice"
  | "selected"
  | "purchaseVerified"
  | "billNumber"
  | "billAmount"
  | "busy"
  | "onToggleScanner"
  | "onLookup"
  | "onBillNumberChange"
  | "onBillAmountChange"
  | "onPurchaseVerifiedChange"
  | "onRecordPurchase"
>) {
  return (
    <section className="mt-7 rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Record customer purchase</h2>
          <p className="mt-1 text-sm text-muted">
            Scan the membership QR or enter a mobile number. One paid bill of at least ₹200 counts per calendar day.
          </p>
        </div>

        <button
          type="button"
          onClick={onToggleScanner}
          className="rounded-full bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.98]"
        >
          {scannerOn ? "Stop scanner" : "Open QR scanner"}
        </button>
      </div>

      {scannerOn && (
        <div id="epic-qr-reader" className="mt-4 max-w-sm overflow-hidden rounded-xl" />
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <input
          id="manual-qr"
                  placeholder="Membership QR ES0001 or 10-digit mobile"
          className="min-w-0 flex-1 rounded-xl border border-line bg-white p-3 text-sm text-ink"
        />
        <button
          type="button"
          onClick={() => {
            const element = document.getElementById("manual-qr") as HTMLInputElement | null;
            if (element) onLookup(element.value);
          }}
          className="rounded-xl border-2 border-brand bg-white px-4 py-3 text-sm font-semibold text-brand transition hover:bg-cream"
        >
          Find customer
        </button>
      </div>

      {scanError && (
        <p role="alert" className="mt-3 rounded-xl border border-brand bg-white p-3 text-sm text-brand">
          {scanError}
        </p>
      )}
      {notice && (
        <p className="mt-3 rounded-xl bg-gold p-3 text-sm font-medium text-ink">{notice}</p>
      )}

      {selected && (
        <SelectedCustomer
          customer={selected}
          billNumber={billNumber}
          billAmount={billAmount}
          purchaseVerified={purchaseVerified}
          busy={busy}
          onBillNumberChange={onBillNumberChange}
          onBillAmountChange={onBillAmountChange}
          onPurchaseVerifiedChange={onPurchaseVerifiedChange}
          onRecordPurchase={onRecordPurchase}
        />
      )}
    </section>
  );
}

function SelectedCustomer({
  customer,
  billNumber,
  billAmount,
  purchaseVerified,
  busy,
  onBillNumberChange,
  onBillAmountChange,
  onPurchaseVerifiedChange,
  onRecordPurchase,
}: {
  customer: Customer;
  billNumber: string;
  billAmount: string;
  purchaseVerified: boolean;
  busy: boolean;
  onBillNumberChange: (value: string) => void;
  onBillAmountChange: (value: string) => void;
  onPurchaseVerifiedChange: (value: boolean) => void;
  onRecordPurchase: () => void;
}) {
  return (
    <div className="mt-5 rounded-2xl bg-cream p-4">
      <h3 className="text-lg font-bold">{customer.name}</h3>
      <p className="text-sm font-medium text-ink">
        Customer ID: {customer.customerCode || "Legacy customer"}
      </p>
      <p className="text-sm text-muted">
        +91 {customer.phone} · {customer.visitCount || 0}/5 purchases completed
      </p>

      <PurchaseMeter count={customer.visitCount || 0} barClass="h-3" className="my-3" />

      <label className="mb-3 block text-sm font-medium">
        Unique bill number
        <input
          value={billNumber}
          onChange={(event) => onBillNumberChange(event.target.value)}
          placeholder="Example: EPIC-1025"
          maxLength={120}
          className="mt-1 w-full rounded-xl border border-line bg-white p-3 text-ink"
        />
      </label>
      <label className="mb-3 block text-sm font-medium">
        Bill amount after discount (₹)
        <input
          inputMode="decimal"
          value={billAmount}
          onChange={(event) => onBillAmountChange(event.target.value)}
          placeholder="250"
          className="mt-1 w-full rounded-xl border border-line bg-white p-3 text-ink"
        />
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={purchaseVerified}
          onChange={(event) => onPurchaseVerifiedChange(event.target.checked)}
          className="mt-1"
        />
        I verified that this is a genuine qualifying purchase and the bill number is correct.
      </label>

      <button
        type="button"
        disabled={!purchaseVerified || !billNumber.trim() || !billAmount.trim() || busy}
        onClick={onRecordPurchase}
        className="mt-4 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? "Recording…" : "Confirm & record purchase"}
      </button>
    </div>
  );
}

function CustomerProgress({
  customers,
  rewardText,
  busy,
  onRewardTextChange,
  onOpenReward,
  onMarkRewardSent,
  onCreatePin,
}: Pick<
  AdminDashboardProps,
  | "customers"
  | "rewardText"
  | "busy"
  | "onRewardTextChange"
  | "onOpenReward"
  | "onMarkRewardSent"
  | "onCreatePin"
>) {
  return (
    <section className="mt-7">
      <h2 className="text-xl font-bold">Customer progress</h2>
      <p className="mt-1 text-sm text-muted">
        One qualifying visit per customer per calendar day. The same bill cannot be used twice.
      </p>

      <div className="mt-4 space-y-3">
        {customers.map((customer) => (
          <CustomerCard
            key={customer.id}
            customer={customer}
            rewardText={rewardText}
            busy={busy}
            onRewardTextChange={onRewardTextChange}
            onOpenReward={onOpenReward}
            onMarkRewardSent={onMarkRewardSent}
            onCreatePin={onCreatePin}
          />
        ))}

        {customers.length === 0 && (
          <p className="rounded-xl border border-dashed border-line p-8 text-center text-muted">
            No customers registered yet.
          </p>
        )}
      </div>
    </section>
  );
}

function CustomerCard({
  customer,
  rewardText,
  busy,
  onRewardTextChange,
  onOpenReward,
  onMarkRewardSent,
  onCreatePin,
}: {
  customer: Customer;
  rewardText: string;
  busy: boolean;
  onRewardTextChange: (value: string) => void;
  onOpenReward: (customer: Customer) => void;
  onMarkRewardSent: (customer: Customer) => void;
  onCreatePin: (customer: Customer) => void;
}) {
  const unlocked = customer.rewardStatus === "unlocked";

  return (
    <article className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">{customer.name}</h3>
          <p className="text-sm font-medium text-ink">
            {customer.customerCode || "Legacy customer"}
          </p>
          <p className="text-sm text-muted">+91 {customer.phone}</p>
          <p className="text-sm font-semibold text-ink">
            Login PIN: {customer.loginPin || "Not created yet"}
          </p>
          {!customer.loginPin && customer.customerCode && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onCreatePin(customer)}
              className="mt-2 rounded-xl border border-line bg-white px-3 py-2 text-xs font-semibold text-muted"
            >
              Create PIN to share
            </button>
          )}
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            unlocked ? "bg-gold text-ink" : "bg-cream text-muted"
          }`}
        >
          {unlocked ? "Reward unlocked" : `${customer.visitCount || 0}/5 purchases`}
        </span>
      </div>

      <PurchaseMeter count={customer.visitCount || 0} barClass="h-2" className="mt-3" />

      {unlocked && (
        <div className="mt-4 space-y-2">
          <textarea
            value={rewardText}
            onChange={(event) => onRewardTextChange(event.target.value)}
            className="w-full rounded-xl border border-line bg-white p-3 text-sm text-ink"
            rows={3}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onOpenReward(customer)}
              className="rounded-full bg-gold px-4 py-2 text-sm font-semibold text-ink transition hover:brightness-95 active:scale-[0.98]"
            >
              Open WhatsApp reward
            </button>
                        </div>
                        <p className="text-xs text-muted">
                          The customer opens a separate redemption QR. Confirm it in Reward redemption. Visit counts cannot be edited here.
                        </p>
        </div>
      )}
    </article>
  );
}

function PurchaseMeter({
  count,
  barClass,
  className,
}: {
  count: number;
  barClass: string;
  className: string;
}) {
  return (
    <div className={`${className} flex gap-2`}>
      {[1, 2, 3, 4, 5].map((step) => (
        <div
          key={step}
          className={`${barClass} flex-1 rounded-full ${
            step <= count ? "bg-gold" : "bg-line"
          }`}
        />
      ))}
    </div>
  );
}
