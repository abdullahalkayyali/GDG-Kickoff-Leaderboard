import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Header } from "@/components/brand";
import { SignIn } from "@/components/sign-in";
import { SESSION_COOKIE, validSession } from "@/lib/organizer-auth";

export const metadata = { title: "Organizer sign-in · GDG HTU", robots: { index: false, follow: false } };
export default async function SignInPage() {
  if (await validSession((await cookies()).get(SESSION_COOKIE)?.value)) redirect("/admin");
  return <><Header current="admin"/><SignIn/></>;
}
