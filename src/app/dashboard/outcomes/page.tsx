import type { Metadata } from "next";
import { AppShell } from "@/components/normal/AppShell";
import { OutcomesPage as OutcomesContent } from "@/components/normal/DashboardSections";

export const metadata: Metadata = { title: "Outcomes · Normal", description: "Revenue, demand, advertising, delivery and review metrics for the selected simulation run." };

export default function OutcomesRoute() {
  return <AppShell title="Outcomes"><OutcomesContent /></AppShell>;
}
