import { redirect } from "next/navigation";

export default function StaticsPortalPage() {
  redirect("/app/wallet?modal=portal");
}
