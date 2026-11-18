import type { Metadata } from "next";
import "./globals.css";
import "./leaderboard.css";
export const metadata: Metadata = {
  title: "AI Open Day Leaderboards · GDG HTU × ELO",
  description: "Live GDG, GDVC, and overall booth leaderboards for AI Open Day."
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
