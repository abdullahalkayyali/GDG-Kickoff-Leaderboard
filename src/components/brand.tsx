import Link from "next/link";

export function Brand() {
  return <Link href="/" className="brand" aria-label="GDG HTU kickoff home">
    <svg width="42" height="27" viewBox="0 0 48 30" fill="none" aria-hidden="true"><path d="m19 4-14 8" stroke="#EA4335" strokeWidth="7" strokeLinecap="round"/><path d="m5 18 14 8" stroke="#4285F4" strokeWidth="7" strokeLinecap="round"/><path d="m29 4 14 8" stroke="#34A853" strokeWidth="7" strokeLinecap="round"/><path d="m43 18-14 8" stroke="#FBBC04" strokeWidth="7" strokeLinecap="round"/></svg>
    <span><strong>GDG <span className="muted">on Campus</span></strong><small>Al Hussein Technical University</small></span>
  </Link>;
}
export function Header({ current = "leaderboard" }: { current?: "leaderboard" | "guide" | "admin" }) {
  return <header className="header"><div className="header-inner"><Brand/><nav aria-label="Main navigation"><Link href="/" aria-current={current === "leaderboard" ? "page" : undefined}>Leaderboards</Link><Link href="/guide" aria-current={current === "guide" ? "page" : undefined}>How it works</Link><Link href="/admin" aria-current={current === "admin" ? "page" : undefined} className="staff-link">Organizer <span aria-hidden="true">↗</span></Link></nav></div></header>;
}
