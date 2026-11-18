/* eslint-disable @next/next/no-img-element -- plain <img> so logo files can be swapped for any format. */
import Link from "next/link";
import { EVENT_LOGOS } from "@/lib/config";

export function LogoLockup({ className = "" }: { className?: string }) {
  return <span className={`logo-lockup ${className}`.trim()}>
    <img src={EVENT_LOGOS.host} alt="GDG HTU"/>
    <span className="logo-x" aria-hidden="true">×</span>
    <img src={EVENT_LOGOS.partner} alt="ELO (Team Cassiopeia)"/>
  </span>;
}
export function Brand() {
  return <Link href="/" className="brand" aria-label="AI Open Day home">
    <LogoLockup/>
    <span><strong>AI Open Day</strong><small>Al Hussein Technical University</small></span>
  </Link>;
}
export function Header({ current = "leaderboard" }: { current?: "leaderboard" | "admin" }) {
  return <header className="header"><div className="header-inner"><Brand/><nav aria-label="Main navigation"><Link href="/" aria-current={current === "leaderboard" ? "page" : undefined}>Leaderboards</Link><Link href="/admin" aria-current={current === "admin" ? "page" : undefined} className="staff-link">Organizer <span aria-hidden="true">↗</span></Link></nav></div></header>;
}
