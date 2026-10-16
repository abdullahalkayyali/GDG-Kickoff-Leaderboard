import type { Metadata } from "next";
import "./globals.css";
import "./leaderboard.css";
export const metadata: Metadata = {
  title: "Kickoff Leaderboards · GDG HTU",
  description: "Live CS, AI, CYS, and overall leaderboards for the GDG on Campus HTU kickoff."
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
