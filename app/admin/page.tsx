"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { staffFetch } from "@/lib/staff-client";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { AdminLogin } from "@/components/admin/admin-login";
import { AdminShell } from "@/components/admin/admin-shell";
import { CampaignPanel, type CampaignForm } from "@/components/admin/campaign-panel";
import { RedemptionPanel } from "@/components/admin/redemption-panel";
import type { Customer } from "@/components/admin/types";
import type { Analytics } from "@/lib/loyalty-engine";

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [scannerOn, setScannerOn] = useState(false);
  const [scanError, setScanError] = useState("");
  const [purchaseVerified, setPurchaseVerified] = useState(false);
  const [billNumber, setBillNumber] = useState("");
  const [billAmount, setBillAmount] = useState("");
  const [search, setSearch] = useState("");
  const [campaign, setCampaign] = useState<CampaignForm | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [rewardText, setRewardText] = useState(
    "Congratulations! You have completed 5 qualifying purchases at EPIC Snacks. Enjoy your FREE reward!"
  );
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const scannerRef = useRef<any>(null);

  useEffect(() => {
    if (!auth) {
      setReady(true);
      return;
    }

    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setReady(true);
    });
  }, []);

  async function loadCustomers(nextSearch = search) {
    try {
      const result = await staffFetch(`/api/admin/overview?search=${encodeURIComponent(nextSearch)}`);
      setCustomers(result.customers as Customer[]);
      setCampaign(result.campaign);
      setAnalytics(result.analytics);
    } catch (error) {
      console.error("Load customers error:", error);
      setScanError(error instanceof Error ? error.message : "Could not load customers.");
    }
  }

  useEffect(() => {
    if (user) void loadCustomers();
  }, [user]);

  useEffect(() => {
    let active = true;

    async function startScanner() {
      if (!scannerOn || !user) return;

      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (!active) return;

        const scanner = new Html5Qrcode("epic-qr-reader");
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 230, height: 230 } },
          async (decodedText: string) => {
            await scanner.stop().catch(() => undefined);
            scannerRef.current = null;
            setScannerOn(false);
            await lookupQr(decodedText);
          },
          () => undefined
        );
      } catch (error) {
        console.error("QR scanner error:", error);
        setScanError(
          "Camera could not start. Allow camera permission and use HTTPS, or paste the customer's QR text instead."
        );
      }
    }

    void startScanner();

    return () => {
      active = false;
      if (scannerRef.current) {
        void scannerRef.current.stop().catch(() => undefined);
        scannerRef.current = null;
      }
    };
  }, [scannerOn, user]);

  async function lookupQr(raw: string) {
    const value = raw.trim();
    if (value.startsWith("EPICR:")) {
      await redeemReward(value);
      return;
    }

    const customerCode = value.toUpperCase();
    const phone = value.replace(/\D/g, "");
    const params = /^ES\d{4,}$/.test(customerCode)
      ? `customerCode=${customerCode}`
      : /^[6-9]\d{9}$/.test(phone)
        ? `phone=${phone}`
        : "";

    if (!params) {
      setScanError("Scan a membership QR (ES0001), a mobile number, or a reward QR.");
      return;
    }

    setScanError("");
    setNotice("");

    try {
      const result = await staffFetch(`/api/loyalty/lookup?${params}`);
      setSelected({
        id: result.customer.customerCode,
        name: result.customer.name,
        phone: result.customer.phone,
        customerCode: result.customer.customerCode,
        visitCount: result.customer.visitCount,
        rewardStatus: result.customer.rewardStatus,
        rewardsSent: result.customer.rewardsSent,
      });
      setPurchaseVerified(false);
      setBillNumber("");
      setBillAmount("");
    } catch (error) {
      console.error("Customer lookup error:", error);
      setScanError(error instanceof Error ? error.message : "Could not find this customer.");
    }
  }

  async function recordPurchase() {
    if (!selected || !user || !purchaseVerified) return;

    setBusy(true);
    setNotice("");
    setScanError("");

    try {
      const result = await staffFetch("/api/loyalty/visit", {
        method: "POST",
        body: JSON.stringify({
          customerCode: selected.customerCode,
          phone: selected.phone,
          billReference: billNumber,
          billAmount: Number(billAmount),
        }),
      });
      setNotice(
        result.rewardName
          ? `Visit ${result.visitCount}/${result.requiredVisits} recorded. ${result.rewardName} is ready.`
          : `Visit ${result.visitCount}/${result.requiredVisits} recorded for ${result.visitDate}.`
      );
      setSelected(null);
      setPurchaseVerified(false);
      setBillNumber("");
      setBillAmount("");
      await loadCustomers();
    } catch (error) {
      console.error("Record purchase error:", error);
      setScanError(error instanceof Error ? error.message : "Could not record this purchase.");
    } finally {
      setBusy(false);
    }
  }

  async function redeemReward(token: string) {
    setBusy(true);
    setNotice("");
    setScanError("");
    try {
      const result = await staffFetch("/api/loyalty/redeem", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      setNotice(`${result.rewardName} redeemed. ${result.customerCode} is now on cycle ${result.nextCycleNumber} at 0 visits.`);
      await loadCustomers();
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Could not redeem this reward.");
    } finally {
      setBusy(false);
    }
  }

  async function createCustomerPin(customer: Customer) {
    if (!customer.customerCode) return;
    setBusy(true);
    setScanError("");
    try {
      const result = await staffFetch("/api/admin/customer-pin", {
        method: "POST",
        body: JSON.stringify({ customerCode: customer.customerCode }),
      });
      setCustomers((current) =>
        current.map((item) =>
          item.customerCode === result.customerCode ? { ...item, loginPin: result.loginPin } : item
        )
      );
      setNotice(`Login PIN for ${result.name} is ${result.loginPin}. Tell them this PIN. It is not the admin password.`);
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Could not create a login PIN.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCampaign(next: CampaignForm) {
    setBusy(true);
    setScanError("");
    try {
      const result = await staffFetch("/api/admin/campaign", {
        method: "PUT",
        body: JSON.stringify(next),
      });
      setCampaign(result.campaign);
      setNotice("Campaign saved. Existing cycles keep the settings they started with.");
    } catch (error) {
      setScanError(error instanceof Error ? error.message : "Could not save the campaign.");
    } finally {
      setBusy(false);
    }
  }

  function openRewardWhatsApp(customer: Customer) {
    const phone = customer.phone.replace(/\D/g, "");
    const url = `https://wa.me/91${phone}?text=${encodeURIComponent(rewardText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setScanError("");

    if (!auth) {
      setScanError("Firebase Authentication is not configured.");
      return;
    }

    const expectedUsername = "adminepicsnacks@gmail.com";

    const configuredEmail = (
      process.env.NEXT_PUBLIC_ADMIN_EMAIL || "adminepicsnacks@gmail.com"
    )
      .trim()
      .toLowerCase();

    if (username.trim().toLowerCase() !== expectedUsername) {
      setScanError("Enter the correct admin email: adminepicSnacks@gmail.com");
      return;
    }

    if (configuredEmail !== expectedUsername) {
      setScanError("Admin email configuration does not match.");
      return;
    }

    if (!configuredEmail) {
      setScanError(
        "Admin email is missing. Add NEXT_PUBLIC_ADMIN_EMAIL to .env.local and restart the app."
      );
      return;
    }

    try {
      const credential = await signInWithEmailAndPassword(
        auth,
        configuredEmail,
        password
      );

      const token = await credential.user.getIdTokenResult(true);

      console.log("ADMIN CLAIMS:", token.claims);
      setPassword("");
      setScanError("");
    } catch (error: any) {
      console.error("Firebase Auth Error:", error);
      const errorCode = error?.code;

      switch (errorCode) {
        case "auth/invalid-credential":
        case "auth/wrong-password":
        case "auth/user-not-found":
          setScanError(
            "Firebase rejected the email or password. Check the email in .env.local and reset the password in Firebase Authentication if needed."
          );
          break;
        case "auth/invalid-email":
          setScanError("The admin email in .env.local is not a valid email address.");
          break;
        case "auth/operation-not-allowed":
          setScanError(
            "Email/Password sign-in is disabled. Enable it in Firebase Authentication → Sign-in method."
          );
          break;
        case "auth/user-disabled":
          setScanError(
            "This Firebase admin account is disabled. Enable it in Firebase Authentication → Users."
          );
          break;
        case "auth/too-many-requests":
          setScanError("Too many login attempts. Wait a while and try again.");
          break;
        case "auth/network-request-failed":
          setScanError(
            "Network error while contacting Firebase. Check your internet connection."
          );
          break;
        default:
          setScanError(
            `Firebase sign-in failed (${errorCode || "unknown error"}). Check the browser console for details.`
          );
      }
    }
  }

  if (!ready) {
    return <main className="bg-brand p-8 text-white">Loading…</main>;
  }

  return (
    <AdminShell
      user={user}
      onSignOut={() => {
        if (auth) void signOut(auth);
      }}
    >
      {!user ? (
        <AdminLogin
          username={username}
          password={password}
          error={scanError}
          onUsernameChange={setUsername}
          onPasswordChange={setPassword}
          onSubmit={login}
        />
      ) : (
        <>
          <form
            className="mt-6 flex flex-col gap-2 min-[420px]:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              void loadCustomers(search);
            }}
          >
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, mobile, or ES code"
              className="min-w-0 flex-1 rounded-xl border border-line bg-white p-3 text-ink"
            />
            <button type="submit" className="rounded-xl border-2 border-brand bg-white px-4 py-3 text-sm font-semibold text-brand transition hover:bg-cream">
              Search
            </button>
          </form>
          {analytics && (
            <section className="mt-4 grid gap-3 sm:grid-cols-4">
              <Mini label="Active cycles" value={analytics.activeParticipants} />
              <Mini label="1 visit" value={analytics.visitBuckets["1"]} />
              <Mini label="2 visits" value={analytics.visitBuckets["2"]} />
              <Mini label="3 visits" value={analytics.visitBuckets["3"]} />
              <Mini label="4 visits" value={analytics.visitBuckets["4"]} />
              <Mini label="Completed cycles" value={analytics.completedCycles} />
              <Mini label="Rewards ready" value={analytics.rewardsAvailable} />
              <Mini label="Qualifying visits" value={analytics.qualifyingVisits} />
            </section>
          )}
          <AdminDashboard
            customers={customers}
            scannerOn={scannerOn}
            scanError={scanError}
            notice={notice}
            selected={selected}
            purchaseVerified={purchaseVerified}
            billNumber={billNumber}
            billAmount={billAmount}
            rewardText={rewardText}
            busy={busy}
            onToggleScanner={() => {
              setScannerOn((value) => !value);
              setSelected(null);
              setScanError("");
              setNotice("");
            }}
            onLookup={(raw) => void lookupQr(raw)}
            onBillNumberChange={setBillNumber}
            onBillAmountChange={setBillAmount}
            onPurchaseVerifiedChange={setPurchaseVerified}
            onRecordPurchase={() => void recordPurchase()}
            onRewardTextChange={setRewardText}
            onOpenReward={openRewardWhatsApp}
            onMarkRewardSent={() =>
              setNotice("Scan the customer's redemption QR in Reward redemption.")
            }
            onCreatePin={(customer) => void createCustomerPin(customer)}
          />
          <RedemptionPanel busy={busy} onRedeem={(token) => void redeemReward(token)} />
          <CampaignPanel campaign={campaign} busy={busy} onSave={(next) => void saveCampaign(next)} />
        </>
      )}
    </AdminShell>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}
