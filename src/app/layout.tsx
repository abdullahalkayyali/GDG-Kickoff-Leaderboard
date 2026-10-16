import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Kickoff Arena · GDG HTU",
  description: "Three booths. One champion. Follow the GDG on Campus HTU kickoff leaderboards."
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
