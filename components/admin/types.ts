import type { Timestamp } from "firebase/firestore";

export type Customer = {
  id: string;
  customerCode?: string;
  name: string;
  phone: string;
  loginPin?: string;
  visitCount?: number;
  rewardStatus?: "locked" | "unlocked" | "sent" | string;
  rewardsSent?: number;
  registeredAt?: Timestamp;
};
