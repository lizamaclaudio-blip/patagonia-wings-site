"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { BrandLogo } from "@/components/ui/BrandLogo";

const navItems = [
  { href: "/dashboard", label: "Dashboard", tag: "OPS" },
  { href: "/dashboard?tab=dispatch", label: "Despacho", tag: "FLIGHT" },
  { href: "/profile", label: "Perfil piloto", tag: "DATA" },
  { href: "/certifications", label: "Habilitaciones", tag: "QUAL" },
  { href: "/login", label: "Login", tag: "AUTH" },
  { href: "/register", label: "Registro", tag: "AUTH" },
];

export function SidebarNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <aside className="glass-panel h-fit rounded-[32px] p-5 sm:p-6 lg:sticky lg:top-6">
      <div className="brand-hero rounded-[28px] p-5 sm:p-6">
        <BrandLogo compact />
        <div className="mt-5">
          <div className="panel-chip">SUR STYLE</div>
          <h2 className="mt-4 text-2xl font-semibold text-white">Web Operations Center</h2>
          <p className="mt-3 text-sm leading-6 text-white/78">
            Nuevo look Patagonia Wings en blanco, azul y verde, usando el mismo ADN visual de la aerolínea.
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
              <span className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold tracking-[0.22em] text-slate-500">
                {item.tag}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 rounded-[26px] border border-sky-100 bg-sky-50/80 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700">Visual stage</p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-slate-800">Sur Air inspired</span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            ACTIVE
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Base visual alineada con la identidad Patagonia Wings para luego enchufar auth, reserva y despacho real.
        </p>
      </div>
    </aside>
  );
}