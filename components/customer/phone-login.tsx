"use client";

import { useState, type FormEvent } from "react";

type ReturnVisitLoginProps = {
  onRecognized: (customer: { customerCode: string; phone: string; name: string; loginPin: string }) => void;
};

export function ReturnVisitLogin({ onRecognized }: ReturnVisitLoginProps) {
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/customer/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, pin }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || "Could not open your loyalty card.");
      }
      onRecognized({
        customerCode: result.customerCode,
        phone: result.phone,
        name: result.name,
        loginPin: result.loginPin,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open your loyalty card.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 border-t border-line pt-6">
      <p className="text-sm font-medium text-brand">Already registered? Open your card</p>
      <p className="mt-1 text-xs leading-5 text-muted">
        Enter the mobile number and 4-digit PIN from your first visit. Ask the shop if you do not have the PIN.
      </p>
      <div className="mt-3 flex flex-col gap-2 min-[380px]:flex-row">
        <input
          inputMode="numeric"
          value={phone}
          onChange={(event) => setPhone(event.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="10-digit mobile"
          className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-3 text-ink outline-none focus:border-gold focus:bg-white"
        />
        <input
          inputMode="numeric"
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
          placeholder="PIN"
          className="w-full rounded-xl border border-line bg-white px-3 py-3 text-ink outline-none focus:border-gold focus:bg-white min-[380px]:w-24"
        />
      </div>
      {error && <p className="mt-3 text-sm text-brand">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="mt-3 w-full rounded-full border-2 border-brand bg-white px-3 py-3 text-sm font-semibold text-brand transition hover:bg-cream active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Opening..." : "Open my card"}
      </button>
    </form>
  );
}
