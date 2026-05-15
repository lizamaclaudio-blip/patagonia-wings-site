"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/browser";

type NavItem = {
  href?: string;
  label: string;
  items?: Array<{ href: string; label: string }>;
};

const navItems: NavItem[] = [
  { href: "/#inicio", label: "Inicio" },
  { href: "/#vuela", label: "Vuela con nosotros" },
  {
    label: "Operaciones",
    items: [
      { href: "/dashboard?tab=dispatch", label: "Despacho" },
      { href: "/dashboard", label: "Vuelos en curso" },
      { href: "/profile?view=economia", label: "Historial" },
      { href: "/#descargas", label: "ACARS" },
    ],
  },
  { href: "/#flota", label: "Flota" },
  { href: "/routes", label: "Rutas" },
  {
    label: "Recursos",
    items: [
      { href: "/dashboard?tab=dispatch", label: "SimBrief" },
      { href: "/profile?view=perfil", label: "Navigraph" },
      { href: "/dashboard?tab=dispatch", label: "Route Finder" },
      { href: "/#descargas", label: "Descargas" },
      { href: "/#servicios", label: "Estado de servicios" },
    ],
  },
  {
    label: "Comunidad",
    items: [
      { href: "/profile", label: "Pilotos" },
      { href: "/dashboard?tab=training", label: "Eventos" },
      { href: "/#aliados", label: "Aliados" },
    ],
  },
  { href: "/#nosotros", label: "Acerca de" },
];

function isPublicNavActive(pathname: string, item: NavItem) {
  if (item.href === "/#inicio") return pathname === "/";
  if (!item.href || item.href.startsWith("/#")) return false;
  return pathname === item.href.split("?")[0];
}

export default function PublicHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (isMounted) setIsAuthenticated(Boolean(data.session));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) setIsAuthenticated(Boolean(session));
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMenuOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setMenuOpen(false);
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="pw-navbar">
      <div className="pw-navbar-inner">
        <Link href={isAuthenticated ? "/dashboard" : "/"} className="pw-navbar-brand" aria-label="Patagonia Wings">
          <Image
            src="/branding/patagonia-logo.png"
            alt="Patagonia Wings"
            width={52}
            height={52}
            className="pw-navbar-logo"
            priority
          />
          <span className="pw-navbar-wordmark">
            <strong>Patagonia</strong>
            <span>Wings</span>
          </span>
        </Link>

        <nav className="pw-navbar-nav" aria-label="Navegacion principal">
          {navItems.map((item) => {
            const active = isPublicNavActive(pathname, item);
            if (item.items?.length) {
              return (
                <div key={item.label} className="pw-navbar-menu">
                  <button type="button" className="pw-navbar-link" aria-haspopup="true">
                    {item.label}
                    <span aria-hidden>v</span>
                  </button>
                  <div className="pw-navbar-dropdown">
                    {item.items.map((subitem) => (
                      <Link key={`${item.label}-${subitem.href}-${subitem.label}`} href={subitem.href}>
                        {subitem.label}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href ?? "/"}
                className={`pw-navbar-link ${active ? "is-active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="pw-navbar-actions" ref={dropdownRef}>
          {isAuthenticated ? (
            <>
              <Link href="/dashboard" className="pw-btn-primary pw-navbar-action">
                Dashboard
              </Link>
              <button
                type="button"
                aria-label="Mas opciones"
                className="pw-btn-secondary pw-navbar-more"
                onClick={() => setMenuOpen((value) => !value)}
              >
                <span className={menuOpen ? "rotate-180" : ""} aria-hidden>
                  v
                </span>
              </button>
              {menuOpen ? (
                <div className="pw-account-menu">
                  <Link href="/profile?view=perfil" onClick={() => setMenuOpen(false)}>
                    Mi perfil
                  </Link>
                  <Link href="/dashboard?tab=dispatch" onClick={() => setMenuOpen(false)}>
                    Despacho
                  </Link>
                  <Link href="/economia" onClick={() => setMenuOpen(false)}>
                    Economia
                  </Link>
                  <button type="button" onClick={() => void handleSignOut()}>
                    Cerrar sesion
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <Link href="/login" className="pw-btn-secondary pw-navbar-action">
                Iniciar sesion
              </Link>
              <Link href="/register" className="pw-btn-primary pw-navbar-action">
                Crear cuenta
              </Link>
            </>
          )}
        </div>

        <div className="pw-navbar-mobile-actions">
          <Link href={isAuthenticated ? "/dashboard" : "/login"} className="pw-btn-secondary">
            {isAuthenticated ? "Dashboard" : "Sesion"}
          </Link>
          {!isAuthenticated ? (
            <Link href="/register" className="pw-btn-primary">
              Cuenta
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
