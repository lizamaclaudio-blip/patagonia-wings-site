import { ReactNode } from "react";

import { SidebarNav } from "@/components/admin/SidebarNav";
import { SignOutButton } from "@/components/admin/SignOutButton";
import type { AdminRole } from "@/lib/auth/access";

type AdminShellProps = {
  title: string;
  description: string;
  role: AdminRole;
  pilotName: string;
  callsign: string;
  children: ReactNode;
};

export function AdminShell({
  title,
  description,
  role,
  pilotName,
  callsign,
  children,
}: AdminShellProps) {
  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <span className="brand-kicker">Patagonia Wings</span>
          <h1>Control Center</h1>
          <p>Backoffice privado</p>
        </div>

        <SidebarNav />

        <div className="sidebar-footer">
          <div className="operator-card">
            <span className="operator-role">{role.toUpperCase()}</span>
            <strong>{pilotName}</strong>
            <span>{callsign}</span>
          </div>

          <SignOutButton />
        </div>
      </aside>

      <main className="main-panel">
        <header className="page-header">
          <div>
            <span className="page-kicker">PatagoniaWings.ControlCenter</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </div>
        </header>

        <section className="page-content">{children}</section>
      </main>
    </div>
  );
}
