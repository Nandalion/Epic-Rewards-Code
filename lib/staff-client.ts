import { auth } from "@/lib/firebase";

export async function staffFetch(path: string, init?: RequestInit) {
  const user = auth?.currentUser;
  if (!user) throw new Error("Sign in again.");
  const token = await user.getIdToken();
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || body?.success === false) {
    throw new Error(body?.error || "Request failed.");
  }
  return body;
}
