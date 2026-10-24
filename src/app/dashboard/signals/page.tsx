import type { Metadata } from "next";
import { AppShell } from "@/components/normal/AppShell";
import { SignalsPage } from "@/components/normal/DashboardSections";

export const metadata: Metadata = {
  title: "Signals · Normal",
  description: "Explore persisted anomalies, source metric history, and detector baselines for the selected simulation run.",
};

export default function DashboardSignalsPage() {
  return <AppShell title="Signals" hidePageHeading><SignalsPage /></AppShell>;
}
