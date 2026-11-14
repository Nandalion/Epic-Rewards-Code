"use client";

type RedemptionPanelProps = {
  busy: boolean;
  onRedeem: (token: string) => void;
};

export function RedemptionPanel({ busy, onRedeem }: RedemptionPanelProps) {
  return (
    <section className="mt-7 rounded-2xl border border-line bg-white p-5">
      <h2 className="text-xl font-bold">Reward redemption</h2>
      <p className="mt-1 text-sm text-muted">
        Scan the customer&apos;s reward QR, not the membership QR. The reward QR expires 15 minutes after the customer opens it and works once.
      </p>
      <form
        className="mt-4 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const input = event.currentTarget.elements.namedItem("reward-qr") as HTMLInputElement;
          onRedeem(input.value);
          input.value = "";
        }}
      >
        <input
          name="reward-qr"
          placeholder="Paste reward QR: EPICR:..."
          className="min-w-0 flex-1 rounded-xl border border-line bg-white p-3 text-sm text-ink"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Checking…" : "Confirm reward given"}
        </button>
      </form>
    </section>
  );
}
