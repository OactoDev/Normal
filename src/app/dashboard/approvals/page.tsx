import type { Metadata } from "next";
import { AppShell } from "@/components/normal/AppShell";
import { ApprovalsPage as ApprovalsContent } from "@/components/normal/DashboardSections";

export const metadata: Metadata = { title: "Approvals · Normal", description: "Approval handoff status and readiness for the selected simulation run." };

export default function ApprovalsRoute() {
  return <AppShell title="Approvals"><ApprovalsContent /></AppShell>;
}
