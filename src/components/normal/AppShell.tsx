"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { RunProvider, useRun } from "./run-context";
import { RunSelector } from "./RunSelector";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/architecture", label: "Architecture" },
  { href: "/dev/simulator", label: "Control room", external: true },
  { href: "/dev/monitor", label: "Anomaly monitor", external: true },
  { href: "/demo-store", label: "Demo store", external: true },
];

function Shell({ children, title }: { children: ReactNode; title: string }) {
  const pathname = usePathname();
  const { withRun, unavailable, error } = useRun();
  return (
    <>
      <div className="notice"><div className="shell"><strong>Nike — Unaffiliated Simulation.</strong><span>Normal operations dashboard over a synthetic Nike-style business. Every figure is computed from persisted simulated records; nothing describes the real company.</span></div></div>
      <header className="topbar normal-topbar"><div className="shell topbar-inner">
        <Link href={withRun("/dashboard")} className="brand">Normal <small>· {title}</small></Link>
        <nav className="row" aria-label="Normal sections" data-testid="dashboard-nav">
          {NAV.map((n) => <Link key={n.href} href={n.external ? n.href : withRun(n.href)} className={`btn sm ${pathname === n.href ? "primary" : ""}`} aria-current={pathname === n.href ? "page" : undefined}>{n.label}</Link>)}
        </nav>
      </div></header>
      <main className="shell cr normal-dashboard">
        <div className="cr-head">
          <div><h1>{title}</h1><div className="muted">Observe → Detect → Retrieve → Investigate → Plan → Approve → Execute → Verify → Learn</div></div>
          <RunSelector />
        </div>
        {unavailable ? <div className="alert error">The dashboard uses development/demo endpoints; it is only available in development or a configured demo mode.</div> : null}
        {error ? <div className="alert error">{error}</div> : null}
        {children}
      </main>
    </>
  );
}

/** Unified app shell: notice, navigation, run selection (URL `?run=`) for every dashboard page. */
export function AppShell({ children, title }: { children: ReactNode; title: string }) {
  return (
    <Suspense fallback={<main className="shell cr normal-dashboard"><div className="muted">Loading…</div></main>}>
      <RunProvider><Shell title={title}>{children}</Shell></RunProvider>
    </Suspense>
  );
}
