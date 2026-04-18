"use client";

import type { Session } from "@supabase/supabase-js";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/lib/supabase/browser";

const ProtectedSessionContext = createContext<Session | null>(null);
const OptionalSessionContext = createContext<Session | null | undefined>(undefined);

export function useProtectedSession() {
  const session = useContext(ProtectedSessionContext);

  if (!session) {
    throw new Error("useProtectedSession must be used inside ProtectedPage.");
  }

  return session;
}

/** Returns the session (or null) without requiring auth. undefined = still loading. */
export function useOptionalSession(): Session | null | undefined {
  return useContext(OptionalSessionContext);
}

type ProtectedPageProps = {
  children: ReactNode;
};

export default function ProtectedPage({ children }: ProtectedPageProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function validateSession() {
      const { data } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (!data.session) {
        router.replace(`/login?next=${encodeURIComponent(pathname || "/dashboard")}`);
        setLoading(false);
        return;
      }

      setSession(data.session);
      setLoading(false);
    }

    void validateSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!isMounted) return;

        if (!nextSession) {
          setSession(null);
          router.replace(`/login?next=${encodeURIComponent(pathname || "/dashboard")}`);
          return;
        }

        setSession(nextSession);
      }
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (loading || !session) {
    return (
      <div className="pw-container py-12 sm:py-16 lg:py-20">
        <section className="glass-panel rounded-[34px] p-7 sm:p-9">
          <span className="parallax-chip mb-6">Validando sesión</span>
          <h1 className="text-3xl font-semibold text-white sm:text-4xl">
            Cargando portal Patagonia Wings
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-white/78">
            Estamos comprobando tu sesión antes de mostrar la página.
          </p>
        </section>
      </div>
    );
  }

  return (
    <ProtectedSessionContext.Provider value={session}>
      {children}
    </ProtectedSessionContext.Provider>
  );
}

type OptionalAuthPageProps = {
  children: ReactNode;
};

/** Renders children regardless of auth state. useOptionalSession() returns the session or null. */
export function OptionalAuthPage({ children }: OptionalAuthPageProps) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (isMounted) setSession(data.session ?? null);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) setSession(nextSession ?? null);
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  return (
    <OptionalSessionContext.Provider value={session}>
      {children}
    </OptionalSessionContext.Provider>
  );
}