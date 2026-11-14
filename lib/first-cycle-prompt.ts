export type FirstCyclePrompt = "google-review" | "instagram-follow";

/** Google review and Instagram follow run once, on the first 5-visit cycle only. */
export function firstCyclePrompt(cycleNumber: number, visitCount: number): FirstCyclePrompt | null {
  if (cycleNumber !== 1) return null;
  if (visitCount === 2) return "google-review";
  if (visitCount === 4) return "instagram-follow";
  return null;
}
