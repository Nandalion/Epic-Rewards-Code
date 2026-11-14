"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { firebaseConfigured } from "@/lib/firebase";
import { RegisteredScreen, type Progress } from "@/components/customer/registered-screen";
import { SignupScreen } from "@/components/customer/signup-screen";

const shopWhatsApp = (
  process.env.NEXT_PUBLIC_SHOP_WHATSAPP || "917305015074"
).replace(/\D/g, "");

const cardStorageKey = "epic-customer-card";

export default function Home() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [customerCode, setCustomerCode] = useState("");
  const [welcomeUrl, setWelcomeUrl] = useState("");
  const [registeredPhone, setRegisteredPhone] = useState("");
  const [loginPin, setLoginPin] = useState("");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [progressError, setProgressError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [rewardQr, setRewardQr] = useState("");
  const [rewardQrNote, setRewardQrNote] = useState("");
  const [cardReady, setCardReady] = useState(false);
  const refreshingRef = useRef(false);

  const refreshProgress = useCallback(async () => {
    if (!customerCode || !registeredPhone || refreshingRef.current) return;

    refreshingRef.current = true;
    setRefreshing(true);

    try {
      const params = new URLSearchParams({
        customerCode,
        phone: registeredPhone,
      });

      const response = await fetch(`/api/customer-progress?${params.toString()}`, {
        cache: "no-store",
      });
      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Could not refresh loyalty progress.");
      }

      setProgress({
        customerCode: result.customerCode,
        visitCount: Math.max(0, Number(result.visitCount) || 0),
        requiredVisits: Number(result.requiredVisits) || 5,
        minimumBillAmount: Number(result.minimumBillAmount) || 200,
        rewardStatus: result.rewardStatus || "locked",
        rewardName: result.rewardName,
        rewardAvailable: Boolean(result.rewardAvailable),
        cycleNumber: Number(result.cycleNumber) || 1,
        rewardsSent: Number(result.rewardsSent) || 0,
        visits: Array.isArray(result.visits) ? result.visits : [],
        rewards: Array.isArray(result.rewards) ? result.rewards : [],
      });
      setProgressError("");
    } catch (err) {
      console.error("Loyalty progress error:", err);
      setProgressError("Pull down to try again.");
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [customerCode, registeredPhone]);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(cardStorageKey);
      if (saved) {
        const card = JSON.parse(saved) as {
          customerCode?: string;
          phone?: string;
          welcomeUrl?: string;
          loginPin?: string;
        };
        if (card.customerCode && card.phone) {
          setCustomerCode(card.customerCode);
          setRegisteredPhone(card.phone);
          setWelcomeUrl(card.welcomeUrl || "");
          setLoginPin(card.loginPin || "");
        }
      }
    } catch (err) {
      console.error("Could not restore loyalty card:", err);
    }
    setCardReady(true);
  }, []);

  function openCard(code: string, cardPhone: string, cardName: string, pin = "") {
    const nextCode = code.toUpperCase();
    const message = `Hi EPIC Snacks! 👋

My name is ${cardName}.
My customer ID is ${nextCode}.
I joined EPIC Snacks Rewards!`;
    const nextWelcomeUrl = `https://wa.me/${shopWhatsApp}?text=${encodeURIComponent(message)}`;
    setCustomerCode(nextCode);
    setRegisteredPhone(cardPhone);
    setWelcomeUrl(nextWelcomeUrl);
    setRewardQr("");
    setLoginPin(pin);
    sessionStorage.setItem(
      cardStorageKey,
      JSON.stringify({ customerCode: nextCode, phone: cardPhone, welcomeUrl: nextWelcomeUrl, loginPin: pin })
    );
  }

  async function showRewardQr() {
    setRewardQrNote("");
    try {
      const response = await fetch("/api/loyalty/reward-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerCode, phone: registeredPhone }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || "Could not open the reward QR.");
      setRewardQr(result.qrValue);
      setRewardQrNote(`Show this to staff before ${new Date(result.expiresAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })}.`);
    } catch (err) {
      setRewardQr("");
      setRewardQrNote(err instanceof Error ? err.message : "Could not open the reward QR.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const cleanName = name.trim().replace(/\s+/g, " ");
    const cleanPhone = phone.replace(/\D/g, "");

    if (cleanName.length < 2) {
      setError("Please enter your name.");
      return;
    }

    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setError("Enter a valid 10-digit Indian WhatsApp number.");
      return;
    }

    if (!consent) {
      setError("Please agree to join the rewards programme.");
      return;
    }

    if (!firebaseConfigured) {
      setError("Registration is not available yet. Please ask the shop staff.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanName,
          phone: cleanPhone,
          consent: true,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Registration failed.");
      }

      if (!result.customerId || !result.customerCode) {
        throw new Error(
          "Registration was saved, but the customer QR details were not returned. Please contact shop staff."
        );
      }

      openCard(String(result.customerCode), cleanPhone, cleanName, String(result.loginPin || ""));
    } catch (err) {
      console.error("Registration error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't save your registration. Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  if (!cardReady) {
    return <main className="bg-brand p-8 text-white">Loading…</main>;
  }

  if (customerCode) {
    return (
      <RegisteredScreen
        customerCode={customerCode}
        welcomeUrl={welcomeUrl}
        progress={progress}
        progressError={progressError}
        refreshing={refreshing}
        rewardQr={rewardQr}
        rewardQrNote={rewardQrNote}
        onRefresh={refreshProgress}
        loginPin={loginPin}
        onShowReward={() => void showRewardQr()}
      />
    );
  }

  return (
    <SignupScreen
      name={name}
      phone={phone}
      consent={consent}
      busy={busy}
      error={error}
      onNameChange={setName}
      onPhoneChange={setPhone}
      onConsentChange={setConsent}
      onSubmit={handleSubmit}
      onRecognized={(customer) => openCard(customer.customerCode, customer.phone, customer.name, customer.loginPin)}
    />
  );
}
