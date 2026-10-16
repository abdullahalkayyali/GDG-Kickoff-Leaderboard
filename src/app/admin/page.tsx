import { Header } from "@/components/brand";
import { Admin } from "@/components/admin";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, validSession } from "@/lib/organizer-auth";
export const metadata = { title: "Organizer console · GDG HTU", robots: { index: false, follow: false } };
export default async function AdminPage() {
  if (!await validSession((await cookies()).get(SESSION_COOKIE)?.value)) redirect("/admin/sign-in");
  return <><Header current="admin"/><Admin/></>;
}
