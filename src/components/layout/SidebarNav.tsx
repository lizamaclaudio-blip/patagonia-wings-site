"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/ui/BrandLogo";

const navItems = [
  { href: "/dashboard", label: "Dashboard", tag: "OPS" },
  { href: "/dashboard?tab=dispatch", label: "Despacho", tag: "OFP" },
  { href: "/profile", label: "Perfil piloto", tag: "DATA" },
  { href: "/certifications", label: "Habilitaciones", tag: "QUAL" },
  { href: "/economia", label: "Economía", tag: "FIN" },
  { href: "/routes", label: "Rutas", tag: "NET" },
];

export function SidebarNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <aside className="glass-panel h-fit rounded-[28px] p-5 sm:p-6 lg:sticky lg:top-24">
      <div className="brand-hero rounded-[22px] p-5 sm:p-6">
        <BrandLogo compact dark />
        <div className="mt-5">
          <div className="panel-chip">Patagonia Sky Premium</div>
          <h2 className="header-strip mt-4 text-2xl font-semibold">Operations Center</h2>
          <p className="mt-3 text-sm leading-6">
            Oficina clara para despacho, rutas, perfil, economía y progreso operacional.
          </p>
        </div>
      </div>

      <nav className="mt-6 space-y-2">
        {navItems.map((item) => {
          const isDispatchItem = item.href.includes("tab=dispatch");
          const active = isDispatchItem
            ? pathname === "/dashboard" && searchParams.get("tab") === "dispatch"
            : pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between rounded-2xl border px-4 py-3 transition ${
                active
                  ? "border-sky-500/18 bg-sky-50 text-sky-900"
                  : "border-slate-200/80 bg-white/70 text-slate-700 hover:border-sky-300/30 hover:bg-white"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-green-500" : "bg-sky-500/60"}`} />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              <span className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold tracking-[0.12em] text-slate-500">
                {item.tag}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 rounded-[22px] border border-sky-100 bg-sky-50/80 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">Estado operacional</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-slate-800">Sistema premium</span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Activo
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Navegación unificada para la operación diaria de Patagonia Wings.
        </p>
      </div>
    </aside>
  );
}
