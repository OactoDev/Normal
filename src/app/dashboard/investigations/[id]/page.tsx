import type { Metadata } from "next";
import { AppShell } from "@/components/normal/AppShell";
import { InvestigationWorkspace } from "@/components/normal/InvestigationWorkspace";

export const metadata: Metadata = { title: "Investigation workspace · Normal", description: "Incident overview, autonomous evidence retrieval, evidence explorer, tool execution timeline and placeholders for future stages." };

/** The investigation id is read client-side (useParams) inside the shell's Suspense boundary; all data comes from the scoped APIs. */
export default function InvestigationPage() {
  return <AppShell title="Investigation workspace"><InvestigationWorkspace /></AppShell>;
}
