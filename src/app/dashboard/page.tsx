import type { Metadata } from "next";
import { AppShell } from "@/components/normal/AppShell";
import { OperationsOverview } from "@/components/normal/OperationsOverview";

export const metadata: Metadata = { title: "Operations overview · Normal", description: "Selected Nike simulation run: live metrics, monitoring health, incidents, anomalies and investigations." };

export default function DashboardPage() {
  return <AppShell title="Operations overview"><OperationsOverview /></AppShell>;
}
