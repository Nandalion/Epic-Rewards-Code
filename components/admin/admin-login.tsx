"use client";

import type { FormEvent } from "react";
import { firebaseConfigured } from "@/lib/firebase";

type AdminLoginProps = {
  username: string;
  password: string;
  error: string;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function AdminLogin({
  username,
  password,
  error,
  onUsernameChange,
  onPasswordChange,
  onSubmit,
}: AdminLoginProps) {
  return (
    <form
      onSubmit={onSubmit}
      className="mt-8 max-w-md space-y-4 rounded-3xl border border-line bg-white p-6 shadow-sm"
    >
      <h2 className="text-xl font-semibold tracking-tight">Staff login</h2>

      <input
        type="text"
        autoComplete="username"
        required
        placeholder="Admin name"
        value={username}
        onChange={(event) => onUsernameChange(event.target.value)}
        className="w-full rounded-xl border border-line bg-white p-3 text-ink outline-none focus:border-gold focus:bg-white"
      />

      <input
        type="password"
        autoComplete="current-password"
        required
        placeholder="Firebase password"
        value={password}
        onChange={(event) => onPasswordChange(event.target.value)}
        className="w-full rounded-xl border border-line bg-white p-3 text-ink outline-none focus:border-gold focus:bg-white"
      />

      {error && (
        <p role="alert" className="rounded-xl border border-brand bg-white p-3 text-sm text-brand">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!firebaseConfigured}
        className="w-full rounded-full bg-brand p-3 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Sign in
      </button>
    </form>
  );
}
