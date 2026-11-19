"use client";

import type { FormEvent } from "react";
import { firebaseConfigured } from "@/lib/firebase";
import { ReturnVisitLogin } from "@/components/customer/phone-login";
import { useRef } from "react";

type SignupScreenProps = {
  name: string;
  phone: string;
  consent: boolean;
  busy: boolean;
  error: string;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onConsentChange: (value: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRecognized: (customer: { customerCode: string; phone: string; name: string; loginPin?: string }) => void;
};

export function SignupScreen({
  name,
  phone,
  consent,
  busy,
  error,
  onNameChange,
  onPhoneChange,
  onConsentChange,
  onSubmit,
  onRecognized,
}: SignupScreenProps) {

  return (
    <main className="min-h-screen bg-cream px-4 py-8 sm:px-6 sm:py-16">
      <div className="mx-auto grid w-full max-w-5xl items-stretch gap-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-6">
        <SignupIntro />
        <section className="min-w-0 rounded-3xl bg-white p-5 shadow-md sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            Fried chicken rewards
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-brand">Join the Rewards club</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Register once and get the QR you show when you buy your fried chicken.
          </p>

          {!firebaseConfigured && (
            <div className="mt-5 rounded-xl bg-cream p-3 text-sm text-ink">
              Firebase setup is required before live registration.
            </div>
          )}

          <SignupForm
            name={name}
            phone={phone}
            consent={consent}
            busy={busy}
            error={error}
            onNameChange={onNameChange}
            onPhoneChange={onPhoneChange}
            onConsentChange={onConsentChange}
            onSubmit={onSubmit}
            onRecognized={onRecognized}
          />
          <ReturnVisitLogin onRecognized={onRecognized} />
        </section>
      </div>

      <p className="mt-8 text-center text-xs text-muted">
        EPIC Snacks · Fried chicken · Kolathur
      </p>
    </main>
  );
}

function SignupIntro() {
  return (
    <section className="min-w-0 rounded-3xl bg-brand p-6 text-white sm:p-10">
      <p className="text-sm font-semibold tracking-[0.22em] text-white">EPIC SNACKS</p>
      <h1 className="mt-4 max-w-sm text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl">
        Every Visit Brings You Closer to a Treat!.
        <span className="block text-gold">Rewards Are Waiting!.</span>
      </h1>
      <p className="mt-4 max-w-sm text-base leading-7 text-cream">
        Enjoy your favourite fried chicken on five different days.
        Spend ₹200 or more on each visit to earn a golden stamp.
        Your next treat is on us!
      </p>
      <ol className="mt-8 space-y-3 text-sm text-white">
        <li className="flex gap-3"><span className="font-semibold text-gold">01</span> Get your fried-chicken rewards QR.</li>
        <li className="flex gap-3"><span className="font-semibold text-gold">02</span> Show it at the counter with every chicken order.</li>
        <li className="flex gap-3"><span className="font-semibold text-gold">03</span> collect stamps to claim your free reward.</li>
      </ol>
    </section>
  );
}

function SignupForm({
  name,
  phone,
  consent,
  busy,
  error,
  onNameChange,
  onPhoneChange,
  onConsentChange,
  onSubmit,
}: SignupScreenProps) {
  return (
    <form onSubmit={onSubmit} className="mt-7 space-y-5">
      <div>
        <label htmlFor="name" className="mb-2 block text-sm font-medium text-ink">
          Your name
        </label>
        <input
          id="name"
          required
          minLength={2}
          maxLength={60}
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Enter your name"
          className="w-full rounded-xl border border-line bg-white px-4 py-3.5 text-ink outline-none focus:border-gold focus:bg-white"
        />
      </div>

      <div>
        <label htmlFor="phone" className="mb-2 block text-sm font-medium text-ink">
          WhatsApp number
        </label>
        <div className="flex overflow-hidden rounded-xl border border-line bg-white focus-within:border-gold focus-within:bg-white">
          <span className="border-r border-line px-3 py-3.5 text-sm font-medium text-muted">
            +91
          </span>
          <input
            id="phone"
            required
            inputMode="numeric"
            value={phone}
            onChange={(event) =>
              onPhoneChange(event.target.value.replace(/\D/g, "").slice(0, 10))
            }
            placeholder="10-digit mobile number"
            className="min-w-0 flex-1 bg-transparent px-3 py-3.5 text-ink outline-none"
          />
        </div>
      </div>

      <label className="flex items-start gap-3 text-xs leading-5 text-muted">
        <input
          type="checkbox"
          checked={consent}
          onChange={(event) => onConsentChange(event.target.checked)}
          className="mt-1 accent-brand"
        />
        I agree to join EPIC Snacks fried chicken rewards and receive reward messages on WhatsApp.
      </label>

      {error && (
        <p role="alert" className="rounded-xl border border-brand bg-white p-3 text-sm text-brand">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy || !firebaseConfigured}
        className="w-full rounded-full bg-brand px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Registering..." : "Get my chicken rewards QR →"}
      </button>
    </form>
  );
}
