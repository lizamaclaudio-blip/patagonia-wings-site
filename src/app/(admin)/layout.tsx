import { ReactNode } from "react";

import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminContext } from "@/lib/auth/access";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const context = await requireAdminContext();

  const pilotName =
    typeof context.profile?.display_name === "string" &&
    context.profile.display_name.trim().length
      ? context.profile.display_name
      : typeof context.pilotAccount?.full_name === "string" &&
          context.pilotAccount.full_name.trim().length
        ? context.pilotAccount.full_name
        : context.user.email;

  const callsign =
    typeof context.profile?.callsign === "string"
      ? context.profile.callsign
      : "PWG";

  return (
    <AdminShell
      title="Panel privado de administración"
      description="Operación interna Patagonia Wings conectada a Supabase real."
      role={context.role}
      pilotName={pilotName}
      callsign={callsign}
    >
      {children}
    </AdminShell>
  );
}
