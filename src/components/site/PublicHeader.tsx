"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { supabase } from "@/lib/supabase/browser";

const mainNavItems = [
  { href: "/#inicio", label: "Inicio" },
  { href: "/#nosotros", label: "Nosotros" },
  { href: "/#servicios", label: "Servicios" },
  { href: "/#flota", label: "Flota" },
  { href: "/#certificaciones", label: "Certificaciones" },
  { href: "/#contacto", label: "Contacto" },
];

export default function PublicHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

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

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="parallax-nav flex items-center justify-between gap-5 overflow-visible rounded-[30px] px-5 py-5 lg:px-8 lg:py-6">
      <Link href="/#inicio" className="relative z-10 -my-4 shrink-0 py-1">
        <BrandLogo />
      </Link>

      <nav className="hidden items-center gap-7 text-sm font-semibold tracking-[0.01em] text-white/94 lg:flex xl:gap-9 xl:text-[15px]">
        {mainNavItems.map((item) => {
          const isHomeAnchor = item.href.startsWith("/#");
          const active = pathname === "/" && isHomeAnchor;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`parallax-link transition ${active ? "text-emerald-300" : "text-white/94"}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="hidden lg:flex lg:items-center lg:gap-3">
        {pathname === "/login" ? (
          <Link href="/register" className="parallax-login-button px-7 py-3 text-sm">
            Crear cuenta
          </Link>
        ) : pathname === "/register" ? (
          <Link href="/login" className="parallax-login-button px-7 py-3 text-sm">
            Iniciar sesión
          </Link>
        ) : isAuthenticated ? (
          <>
            <Link href="/operations" className="button-ghost px-6 py-3 text-sm">
              Operaciones
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              className="parallax-login-button px-7 py-3 text-sm"
            >
              Cerrar sesión
            </button>
          </>
        ) : (
          <Link href="/login" className="parallax-login-button px-7 py-3 text-sm">
            Iniciar sesión
          </Link>
        )}
      </div>
    </header>
  );
}
