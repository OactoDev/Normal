import type { Metadata } from "next";
import { AppShell } from "@/components/normal/AppShell";
import { CampaignWorkspace } from "@/components/normal/CampaignWorkspace";

export const metadata: Metadata = {
  title: "Campaign workspace · Normal",
  description: "Campaign status, budget, delivery and recorded agent actions for the selected simulation run.",
};

export default async function CampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppShell title="Campaign workspace"><CampaignWorkspace campaignId={id} /></AppShell>;
}
