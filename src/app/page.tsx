import { Header } from "@/components/brand";
import { Leaderboard } from "@/components/leaderboard";
export default async function Home({ searchParams }: { searchParams: Promise<{ display?: string }> }) {
  const displayMode = (await searchParams).display === "1";
  return <>{displayMode ? null : <Header/>}<Leaderboard key={displayMode ? "display" : "standard"} displayMode={displayMode}/></>;
}
