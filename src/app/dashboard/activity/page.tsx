import type { Metadata } from "next";
import { AppShell } from "@/components/normal/AppShell";
import { ActivityPage as ActivityContent } from "@/components/normal/DashboardSections";

export const metadata: Metadata = { title: "Activity · Normal", description: "Canonical business event activity for the selected simulation run." };

export default function ActivityRoute() {
  return <AppShell title="Activity"><ActivityContent /></AppShell>;
}
