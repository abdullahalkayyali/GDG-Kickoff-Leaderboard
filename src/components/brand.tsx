import Link from "next/link";
import Image from "next/image";

export function Brand() {
  return <Link href="/" className="brand" aria-label="GDG HTU kickoff home">
    <Image src="/gdg-logo.png" width={42} height={27} alt="GDG" priority />
    <span><strong>GDG <span className="muted">on Campus</span></strong><small>Al Hussein Technical University</small></span>
  </Link>;
}
export function Header({ current = "leaderboard" }: { current?: "leaderboard" | "admin" }) {
  return <header className="header"><div className="header-inner"><Brand/><nav aria-label="Main navigation"><Link href="/" aria-current={current === "leaderboard" ? "page" : undefined}>Leaderboards</Link><Link href="/admin" aria-current={current === "admin" ? "page" : undefined} className="staff-link">Organizer <span aria-hidden="true">↗</span></Link></nav></div></header>;
}
