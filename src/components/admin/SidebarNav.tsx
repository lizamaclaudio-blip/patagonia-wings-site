"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/pilots", label: "Usuarios / Pilotos" },
  { href: "/hubs", label: "Hubs" },
  { href: "/fleet", label: "Flota / Aeronaves" },
  { href: "/models", label: "Modelos / Tipos" },
  { href: "/operations", label: "Reservas / Despachos" },
  { href: "/rules", label: "Reglaje / Scoring" },
  { href: "/career", label: "Carrera / Licencias" },
  { href: "/requests", label: "Solicitudes" },
  { href: "/settings", label: "Configuración" },
  { href: "/audit", label: "Auditoría / Logs" },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="sidebar-nav">
      {navItems.map((item) => {
        const active = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`sidebar-link${active ? " is-active" : ""}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
