"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { supabase } from "@/lib/supabase/browser";

const navItems = [
  { href: "/#inicio",          label: "Inicio" },
  { href: "/#nosotros",        label: "Nosotros" },
  { href: "/#servicios",       label: "Servicios" },
  { href: "/#flota",           label: "Flota" },
  { href: "/#certificaciones", label: "Certificaciones" },
  { href: "/#descargas",       label: "Descargas" },
  { href: "/routes",            label: "Rutas" },
  { href: "/dashboard#partners", label: "Partners" },
];

function isPublicNavActive(pathname: string, href: string) {
  if (href === "/#inicio") return pathname === "/";
  if (href.startsWith("/#")) return false;
  if (href.includes("#")) return pathname === href.split("#")[0];
  return pathname === href;
}

export default function PublicHeader() {
  const pathname = usePathname();
  const router   = useRouter();
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [menuOpen, setMenuOpen]               = useState(false);

  // Detect auth state
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

  // Close dropdown on navigation
  useEffect(() => { setMenuOpen(false); }, [pathname]);

  // Close dropdown on outside click
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
    <header className="parallax-nav flex items-center justify-between gap-5 overflow-visible rounded-[30px] px-5 py-5 lg:px-8 lg:py-6">

      {/* Logo */}
      <Link href={isAuthenticated ? "/dashboard" : "/"} className="relative z-10 -my-4 shrink-0 py-1">
        <BrandLogo />
      </Link>

      {/* Nav links */}
      <nav className="hidden items-center gap-7 text-sm font-semibold tracking-[0.01em] text-white/94 lg:flex xl:gap-9 xl:text-[15px]">
        {navItems.map((item) => {
          const active = isPublicNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`parallax-link transition ${active ? "active text-emerald-300" : "text-white/94"}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Right-side buttons */}
      <div className="hidden min-h-[48px] items-center justify-end lg:flex lg:min-w-[220px] lg:gap-3">

        {isAuthenticated ? (
          /* ── LOGGED IN: dropdown with direct "Dashboard" as primary action ── */
          <div className="relative flex items-center gap-2" ref={dropdownRef}>
            {/* Direct dashboard link */}
            <Link href="/dashboard" className="parallax-login-button px-6 py-3 text-sm">
              Dashboard
            </Link>

            {/* Chevron button for extra options */}
            <button
              type="button"
              aria-label="Más opciones"
              className="parallax-account-button px-3 py-3 text-sm"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className={`inline-block text-xs transition-transform duration-200 ${menuOpen ? "rotate-180" : ""}`}>▼</span>
            </button>

            {/* Dropdown */}
            {menuOpen && (
              <div className="absolute right-0 top-[calc(100%+12px)] z-50 w-60 rounded-[24px] border border-white/12 bg-[linear-gradient(180deg,rgba(8,23,46,0.97),rgba(5,17,33,0.98))] p-3 shadow-[0_18px_60px_rgba(0,0,0,0.36)] backdrop-blur-xl">
                <Link
                  href="/profile?view=perfil"
                  className="flex rounded-2xl px-4 py-3 text-sm font-semibold text-white/88 transition hover:bg-white/[0.07]"
                  onClick={() => setMenuOpen(false)}
                >
                  👤 Mi perfil
                </Link>
                <Link
                  href="/dashboard?tab=dispatch"
                  className="mt-1 flex rounded-2xl px-4 py-3 text-sm font-semibold text-white/88 transition hover:bg-white/[0.07]"
                  onClick={() => setMenuOpen(false)}
                >
                  ✈ Despacho
                </Link>
                <div className="my-2 border-t border-white/[0.07]" />
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="flex w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold text-rose-300 transition hover:bg-rose-400/10"
                >
                  ⏏ Cerrar sesión
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ── NOT LOGGED IN: always show both buttons ── */
          <>
            <Link href="/login" className="button-ghost px-5 py-3 text-sm">
              Iniciar sesión
            </Link>
            <Link href="/register" className="parallax-login-button px-6 py-3 text-sm">
              Crear cuenta
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
