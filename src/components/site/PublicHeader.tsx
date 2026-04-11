"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { supabase } from "@/lib/supabase/browser";

const navItems = [
  { href: "/#inicio", label: "Inicio" },
  { href: "/#nosotros", label: "Nosotros" },
  { href: "/#servicios", label: "Servicios" },
  { href: "/#flota", label: "Flota" },
  { href: "/#certificaciones", label: "Certificaciones" },
  { href: "/#descargas", label: "Descargas" },
  { href: "/#contacto", label: "Contacto" },
];

function isPublicNavActive(pathname: string, href: string) {
  if (pathname !== "/") {
    return false;
  }

  return href === "/#inicio";
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
      if (!isMounted) {
        return;
      }

      setIsAuthenticated(Boolean(data.session));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!isMounted) {
        return;
      }

      setIsAuthenticated(Boolean(session));
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
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

  const showLandingLogin = !isAuthenticated && pathname === "/";
  const showAccountMenu = isAuthenticated;

  return (
    <header className="parallax-nav flex items-center justify-between gap-5 overflow-visible rounded-[30px] px-5 py-5 lg:px-8 lg:py-6">
      <Link href={showAccountMenu ? "/dashboard" : "/"} className="relative z-10 -my-4 shrink-0 py-1">
        <BrandLogo />
      </Link>

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

      <div className="hidden min-h-[48px] items-center justify-end lg:flex lg:min-w-[192px] lg:gap-3">
        {showAccountMenu ? (
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              className="parallax-account-button px-6 py-3 text-sm"
              onClick={() => setMenuOpen((current) => !current)}
            >
              Mi cuenta
              <span className={`text-xs transition ${menuOpen ? "rotate-180" : ""}`}>▲</span>
            </button>

            {menuOpen ? (
              <div className="absolute right-0 top-[calc(100%+12px)] z-50 w-64 rounded-[24px] border border-white/12 bg-[linear-gradient(180deg,rgba(8,23,46,0.95),rgba(5,17,33,0.96))] p-3 shadow-[0_18px_60px_rgba(0,0,0,0.32)] backdrop-blur-xl">
                <Link
                  href="/profile?view=perfil"
                  className="flex rounded-2xl px-4 py-3 text-sm font-semibold text-white/88 transition hover:bg-white/[0.06]"
                  onClick={() => setMenuOpen(false)}
                >
                  Mi perfil
                </Link>
                <Link
                  href="/profile?view=datos"
                  className="mt-1 flex rounded-2xl px-4 py-3 text-sm font-semibold text-white/88 transition hover:bg-white/[0.06]"
                  onClick={() => setMenuOpen(false)}
                >
                  Mis datos
                </Link>
                <Link
                  href="/dashboard"
                  className="mt-1 flex rounded-2xl px-4 py-3 text-sm font-semibold text-white/88 transition hover:bg-white/[0.06]"
                  onClick={() => setMenuOpen(false)}
                >
                  Ir al dashboard
                </Link>
                <Link
                  href="/operations"
                  className="mt-1 flex rounded-2xl px-4 py-3 text-sm font-semibold text-white/88 transition hover:bg-white/[0.06]"
                  onClick={() => setMenuOpen(false)}
                >
                  Reserva / Dispatch
                </Link>
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="mt-2 flex w-full rounded-2xl px-4 py-3 text-left text-sm font-semibold text-rose-100 transition hover:bg-rose-400/10"
                >
                  Cerrar sesión
                </button>
              </div>
            ) : null}
          </div>
        ) : showLandingLogin ? (
          <Link href="/login" className="parallax-login-button px-7 py-3 text-sm">
            Iniciar sesión
          </Link>
        ) : null}
      </div>
    </header>
  );
}
