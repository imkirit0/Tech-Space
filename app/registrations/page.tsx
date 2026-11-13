import { redirect } from "next/navigation";

// Registrations moved onto My Activities (staff) and the Manager page; keep old links working.
export default function RegistrationsPage() {
  redirect("/activities");
}
