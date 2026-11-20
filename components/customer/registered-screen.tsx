"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { firstCyclePrompt, type FirstCyclePrompt } from "@/lib/first-cycle-prompt";
import { Download } from "lucide-react";


const googleReviewUrl =
  process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL ||
  "https://www.google.com/maps/search/?api=1&query=EPIC+Snacks+Kolathur";
const instagramUrl =
  process.env.NEXT_PUBLIC_INSTAGRAM_URL ||
  "https://www.instagram.com/epic_snacks_kolathur/";

const promptCopy: Record<FirstCyclePrompt, { leaving: string; storage: string; href: string }> = {
  "google-review": {
    leaving: "Visit 2: opening the EPIC Snacks Google review. Press Back in the browser to return to this card.",
    storage: "epic-google-review",
    href: googleReviewUrl,
  },
  "instagram-follow": {
    leaving: "Visit 5: opening the EPIC Snacks Instagram. Follow the profile, then press Back to return to this card.",
    storage: "epic-instagram-follow",
    href: instagramUrl,
  },
};

export type VisitRow = { visitDate: string; billAmount: number; billReference: string };
export type RewardRow = { rewardName: string; status: string; cycleId: string };

export type Progress = {
  customerCode: string;
  visitCount: number;
  requiredVisits: number;
  minimumBillAmount: number;
  rewardStatus: "locked" | "unlocked" | "sent" | string;
  rewardName?: string;
  rewardAvailable?: boolean;
  cycleNumber?: number;
  rewardsSent?: number;
  visits?: VisitRow[];
  rewards?: RewardRow[];
};

type RegisteredScreenProps = {
  customerCode: string;
  welcomeUrl: string;
  progress: Progress | null;
  progressError: string;
  refreshing: boolean;
  rewardQr: string;
  rewardQrNote: string;
  loginPin: string;
  onRefresh: () => Promise<void>;
  onShowReward: () => void;
};

export function RegisteredScreen({
  customerCode,
  welcomeUrl,
  progress,
  progressError,
  refreshing,
  rewardQr,
  rewardQrNote,
  loginPin,
  onRefresh,
  onShowReward,
}: RegisteredScreenProps) {
  const visitCount = progress?.visitCount ?? 0;
  const requiredVisits = progress?.requiredVisits || 10;
  const isUnlocked = progress?.rewardAvailable || progress?.rewardStatus === "unlocked";
  const [pull, setPull] = useState(0);
  const [returned, setReturned] = useState(false);
  const [leaving, setLeaving] = useState<FirstCyclePrompt | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const onRefreshRef = useRef(onRefresh);
  const prompt = firstCyclePrompt(progress?.cycleNumber || 1, progress ? visitCount : 0);
  const promptKey = prompt ? `${promptCopy[prompt].storage}:${customerCode}` : "";




  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    function markReturned() {
      for (const kind of Object.values(promptCopy)) {
        const key = `${kind.storage}:${customerCode}`;
        if (sessionStorage.getItem(key) === "sent") {
          sessionStorage.setItem(key, "done");
          setReturned(true);
          setLeaving(null);
        }
      }
    }

    markReturned();
    window.addEventListener("pageshow", markReturned);
    return () => window.removeEventListener("pageshow", markReturned);
  }, [customerCode]);

  useEffect(() => {
    if (!prompt || !promptKey || !progress) return;
    if ((progress.cycleNumber || 1) !== 1) return;
    if (sessionStorage.getItem(promptKey)) return;

    setLeaving(prompt);
    const timer = window.setTimeout(() => {
      sessionStorage.setItem(promptKey, "sent");
      window.location.assign(promptCopy[prompt].href);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [prompt, promptKey, progress]);

  useEffect(() => {
    const node = mainRef.current;
    if (!node) return;

    let startY = 0;
    let pulling = false;
    let distance = 0;

    function onStart(event: TouchEvent) {
      if (window.scrollY > 0) return;
      startY = event.touches[0]?.clientY ?? 0;
      pulling = true;
      distance = 0;
    }

    function onMove(event: TouchEvent) {
      if (!pulling) return;
      const delta = (event.touches[0]?.clientY ?? startY) - startY;
      if (delta <= 0 || window.scrollY > 0) {
        distance = 0;
        setPull(0);
        return;
      }
      distance = Math.min(delta, 140);
      setPull(distance);
      if (event.cancelable) event.preventDefault();
    }

    function onEnd() {
      if (pulling && distance >= 72) {
        void onRefreshRef.current();
      }
      pulling = false;
      distance = 0;
      setPull(0);
    }

    node.addEventListener("touchstart", onStart, { passive: true });
    node.addEventListener("touchmove", onMove, { passive: false });
    node.addEventListener("touchend", onEnd);
    node.addEventListener("touchcancel", onEnd);

    return () => {
      node.removeEventListener("touchstart", onStart);
      node.removeEventListener("touchmove", onMove);
      node.removeEventListener("touchend", onEnd);
      node.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  const pullLabel = refreshing
    ? "Refreshing…"
    : pull >= 72
      ? "Release to refresh"
      : "Pull down to refresh";

  return (
    <main
      ref={mainRef}
      className="min-h-screen bg-cream px-4 py-8 sm:py-12"
      style={{ overscrollBehaviorY: "contain", touchAction: "pan-y" }}
    >
      <div className="mx-auto max-w-lg space-y-5">
        {(pull > 0 || refreshing) && (
          <p className="text-center text-sm font-medium text-brand">{pullLabel}</p>
        )}
        {leaving && (
          <p className="rounded-2xl border border-line bg-white p-4 text-center text-sm text-ink">
            {promptCopy[leaving].leaving}
          </p>
        )}
        {returned && (
          <p className="rounded-2xl border border-line bg-white p-4 text-center text-sm text-ink">
            You are back on your loyalty card.
          </p>
        )}
        <QrPass customerCode={customerCode} loginPin={loginPin} />
        <LoyaltyCard
          customerCode={customerCode}
          visitCount={visitCount}
          requiredVisits={requiredVisits}
          rewardName={progress?.rewardName || "Free Chicken Snack"}
          isUnlocked={isUnlocked}
          progressError={progressError}
          rewardQr={rewardQr}
          rewardQrNote={rewardQrNote}
          onShowReward={onShowReward}
          visits={progress?.visits || []}
          rewards={progress?.rewards || []}
        />
        <button
          type="button"
          disabled={refreshing}
          onClick={() => void onRefresh()}
          className="w-full rounded-full border-2 border-brand bg-white px-5 py-3.5 text-center text-sm font-semibold text-brand transition hover:bg-white active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {refreshing ? "Refreshing…" : "Refresh chicken stamps"}
        </button>
        <a
          href={welcomeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-full bg-brand px-5 py-3.5 text-center text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.98]"
        >
          Send welcome WhatsApp message
        </a>
        <p className="text-center text-xs text-muted">
          On a phone, pull down from the top of this page. On a computer, press Refresh chicken stamps.
        </p>
      </div>
    </main>
  );
}

function QrPass({ customerCode, loginPin }: { customerCode: string; loginPin: string }) {
  const qrRef = useRef<HTMLDivElement>(null);

  const downloadQR = () => {
    const svg = qrRef.current?.querySelector("svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], {
      type: "image/svg+xml;charset=utf-8",
    });

    const url = URL.createObjectURL(svgBlob);
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 800;

      const context = canvas.getContext("2d");
      if (!context) {
        URL.revokeObjectURL(url);
        return;
      }

      context.fillStyle = "#FFFFFF";
      context.fillRect(0, 0, 800, 800);
      context.drawImage(image, 0, 0, 800, 800);

      const link = document.createElement("a");
      link.download = `EPIC-Snacks-${customerCode}-QR.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();

      URL.revokeObjectURL(url);
    };

    image.onerror = () => URL.revokeObjectURL(url);
    image.src = url;
  };
  return (
    <section className="overflow-hidden rounded-3xl bg-white text-center shadow-md">
      <div className="bg-brand px-6 py-5 text-white">
        <p className="text-xs font-semibold tracking-[0.18em]">EPIC SNACKS</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">You&apos;re in the club</h1>
      </div>
      <div className="p-6 sm:p-8">
        <p className="mt-1 text-sm text-muted">Customer ID {customerCode}</p>
        {loginPin && (
          <p className="mt-4 rounded-2xl bg-cream px-3 py-3 text-sm text-ink">
            Login PIN <span className="font-semibold tracking-[0.2em] text-gold-ink">{loginPin}</span>
            <span className="mt-1 block text-xs text-muted">
              Next visit, enter your mobile number and this PIN. Staff can tell you the PIN if you forget it.
            </span>
          </p>
        )}
        <p className="mt-4 text-sm text-muted">
          Show this QR when you buy fried chicken.
        </p>

        <div className="mx-auto my-6 w-full max-w-[220px] rounded-2xl border border-line bg-white p-2">
          <div ref={qrRef}>
            <QRCodeSVG
              value={customerCode}
              size={220}
              level="H"
              includeMargin
              className="h-auto w-full"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={downloadQR}
          className="mx-auto flex items-center justify-center gap-2 rounded-xl bg-[#A20000] px-6 py-3 font-semibold text-white transition hover:bg-[#800000]"
        >
          <Download size={18} />
          Download My QR Code
        </button>

        <p className="text-xs text-muted">
          Your personal QR contains only {customerCode}.
        </p>
      </div>
    </section>
  );
}

function LoyaltyCard({
  customerCode,
  visitCount,
  requiredVisits,
  rewardName,
  isUnlocked,
  progressError,
  rewardQr,
  rewardQrNote,
  onShowReward,
  visits,
  rewards,
}: {
  customerCode: string;
  visitCount: number;
  requiredVisits: number;
  rewardName: string;
  isUnlocked: boolean;
  progressError: string;
  rewardQr: string;
  rewardQrNote: string;
  onShowReward: () => void;
  visits: VisitRow[];
  rewards: RewardRow[];
}) {
  return (
    <section className="overflow-hidden rounded-3xl bg-white shadow-md">
      <div className="bg-brand px-5 py-4 text-white sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold tracking-[0.18em]">EPIC SNACKS</p>
          <span className="rounded-full bg-gold px-3 py-1 text-[10px] font-semibold tracking-widest text-ink">
            CHICKEN CLUB
          </span>
        </div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight">
          Ten visits. One free snack.
        </h2>
      </div>

      <div className="p-5 sm:p-6">
        <p className="text-sm text-muted">
          One stamp for each fried-chicken visit of ₹200 or more.
        </p>

        <div className="mt-6 grid grid-cols-5 gap-1 sm:gap-2">
          {Array.from({ length: requiredVisits }, (_, index) => index + 1).map((star) => (
            <VisitStar key={star} star={star} filled={star <= visitCount} />
          ))}
        </div>
        

        <div className="mt-5 h-2 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-gold transition-all duration-500"
            style={{ width: `${Math.min(100, (visitCount / requiredVisits) * 100)}%` }}
          />
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-ink">
            {visitCount} / {requiredVisits} Visits
          </p>
          <p className="text-xs text-muted">
            {isUnlocked ? "Reward unlocked" : `${Math.max(requiredVisits - visitCount, 0)} more to go`}
          </p>
        </div>

        {isUnlocked ? (
          <div className="mt-5 rounded-2xl bg-gold p-4 text-center text-ink">
            <p className="text-lg font-semibold">
              Reward unlocked. {rewardName} is ready.
            </p>
            <button
              type="button"
              onClick={onShowReward}
              className="mt-3 rounded-full bg-brand px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-dark active:scale-[0.98]"
            >
              Show redemption QR
            </button>
            {rewardQr && (
              <div className="mx-auto mt-4 w-full max-w-[180px] rounded-xl bg-white p-2">
                <QRCodeSVG value={rewardQr} size={180} level="H" includeMargin className="h-auto w-full" />
              </div>
            )}
            {rewardQrNote && <p className="mt-2 text-sm text-muted">{rewardQrNote}</p>}
          </div>
        ) : (
          <p className="mt-5 rounded-2xl bg-cream p-3 text-center text-sm text-muted">
            {visitCount === 0
              ? "Your first chicken stamp is waiting. Order fried chicken and start collecting!"
              : `Just ${Math.max(requiredVisits - visitCount, 0)} more ${requiredVisits - visitCount === 1 ? "visit" : "visits"
              } to unlock ${rewardName}.`}
          </p>
        )}

        {progressError && (
          <p className="mt-3 text-center text-xs text-brand">{progressError}</p>
        )}
        <p className="mt-4 text-center text-[10px] text-muted">
          Customer ID: {customerCode}
        </p>
        <History visits={visits} rewards={rewards} />
      </div>
    </section>
  );
}

function History({ visits, rewards }: { visits: VisitRow[]; rewards: RewardRow[] }) {
  if (visits.length === 0 && rewards.length === 0) return null;
  return (
    <div className="mt-4 space-y-2 border-t border-line pt-4 text-left text-sm text-muted">
      {visits.slice(0, 10).map((visit) => (
        <p key={`${visit.visitDate}-${visit.billReference}`}>
          {visit.visitDate}: ₹{visit.billAmount} · {visit.billReference}
        </p>
      ))}
      {rewards.map((reward) => (
        <p key={`${reward.cycleId}-${reward.status}`}>
          {reward.rewardName}: {reward.status}
        </p>
      ))}
    </div>
  );
}

function VisitStar({ star, filled }: { star: number; filled: boolean }) {
  return (
    <div
      className="flex min-w-0 flex-col items-center px-1 py-2"
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-10 w-10 transition-colors duration-500 sm:h-12 sm:w-12 ${filled ? "text-gold" : "text-brand"}`}
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        aria-label={filled ? "Earned star" : "Unfilled star"}
      >
        <path d="m12 2.4 2.9 5.88 6.49.94-4.7 4.58 1.11 6.47L12 17.22l-5.8 3.05 1.1-6.47-4.7-4.58 6.5-.94L12 2.4Z" />
      </svg>
      <span className="mt-1 text-[10px] font-medium text-muted">
        Visit {star}
      </span>
    </div>
  );
}
