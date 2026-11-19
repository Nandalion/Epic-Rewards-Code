import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "EPIC Snacks | Customer Rewards",
  description: "EPIC Snacks fried chicken rewards. Ten visits, one free chicken snack.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale:1,
  themeColor: "#a20000",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
