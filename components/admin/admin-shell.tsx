"use client";

import type { ReactNode } from "react";
import type { User } from "firebase/auth";
import { firebaseConfigured } from "@/lib/firebase";

type AdminShellProps = {
  user: User | null;
  onSignOut: () => void;
  children: ReactNode;
};

export function AdminShell({ user, onSignOut, children }: AdminShellProps) {
  return (
    <main className="min-h-screen bg-cream px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand px-5 py-4 text-white">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] text-gold">
              EPIC SNACKS
            </p>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Fried chicken rewards</h1>
          </div>

          {user && (
            <button
              type="button"
              onClick={onSignOut}
              className="rounded-full border-2 border-white bg-white px-4 py-2 text-sm font-medium text-brand transition hover:bg-gold"
            >
              Sign out
            </button>
          )}
        </header>

        {!firebaseConfigured && (
          <p className="mt-6 rounded-2xl bg-cream p-4 text-sm text-ink">
            Configure Firebase before using the admin dashboard.
          </p>
        )}

        {children}
      </div>
    </main>
  );
}
