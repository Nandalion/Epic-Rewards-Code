"use client";

import { useEffect, useState } from "react";

export type CampaignForm = {
  name: string;
  requiredVisits: number;
  minimumBillAmount: number;
  rewardType: string;
  rewardName: string;
  rewardItemId: string;
  validity: string | null;
  status: "active" | "inactive";
};

type CampaignPanelProps = {
  campaign: CampaignForm | null;
  busy: boolean;
  onSave: (campaign: CampaignForm) => void;
};

export function CampaignPanel({ campaign, busy, onSave }: CampaignPanelProps) {
  const [form, setForm] = useState<CampaignForm | null>(campaign);

  useEffect(() => {
    setForm(campaign);
  }, [campaign]);

  if (!form) return null;

  return (
    <section className="mt-7 rounded-2xl border border-line bg-white p-5">
      <h2 className="text-xl font-bold">Rewards campaign</h2>
      <p className="mt-1 text-sm text-muted">
        Changes apply to new loyalty cycles. Visits and rewards already earned keep their original settings.
      </p>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(form);
        }}
      >
        <label className="text-sm font-medium">
          Campaign name
          <input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            className="mt-1 w-full rounded-xl border border-line bg-white p-3 text-ink"
          />
        </label>
        <label className="text-sm font-medium">
          Reward name
          <input
            value={form.rewardName}
            onChange={(event) => setForm({ ...form, rewardName: event.target.value })}
            className="mt-1 w-full rounded-xl border border-line bg-white p-3 text-ink"
          />
        </label>
        <label className="text-sm font-medium">
          Required visits
          <input
            type="number"
            min={1}
            max={20}
            value={form.requiredVisits}
            onChange={(event) => setForm({ ...form, requiredVisits: Number(event.target.value) })}
            className="mt-1 w-full rounded-xl border border-line bg-white p-3 text-ink"
          />
        </label>
        <label className="text-sm font-medium">
          Minimum bill (₹)
          <input
            type="number"
            min={0}
            value={form.minimumBillAmount}
            onChange={(event) => setForm({ ...form, minimumBillAmount: Number(event.target.value) })}
            className="mt-1 w-full rounded-xl border border-line bg-white p-3 text-ink"
          />
        </label>
        <label className="text-sm font-medium">
          Reward type
          <input
            value={form.rewardType}
            onChange={(event) => setForm({ ...form, rewardType: event.target.value })}
            className="mt-1 w-full rounded-xl border border-line bg-white p-3 text-ink"
          />
        </label>
        <label className="text-sm font-medium">
          Status
          <select
            value={form.status}
            onChange={(event) =>
              setForm({ ...form, status: event.target.value === "inactive" ? "inactive" : "active" })
            }
            className="mt-1 w-full rounded-xl border border-line bg-white p-3 text-ink"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save campaign"}
          </button>
        </div>
      </form>
    </section>
  );
}
