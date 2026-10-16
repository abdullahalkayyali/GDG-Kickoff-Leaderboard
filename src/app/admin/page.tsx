import { Header } from "@/components/brand";
import { Admin } from "@/components/admin";
export const metadata = { title: "Organizer console · GDG HTU", robots: { index: false, follow: false } };
export default function AdminPage() { return <><Header current="admin"/><Admin/></>; }
