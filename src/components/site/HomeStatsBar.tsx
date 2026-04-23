"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/browser";
import {
  FALLBACK_HOME_STATS,
  loadHomeStatsFromSupabase,
  type HomeStatItem,
} from "@/lib/home-stats";

const integerFormatter = new Intl.NumberFormat("es-CL");

function AnimatedStatValue({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousTargetRef = useRef(value);

  useEffect(() => {
    const from = previousTargetRef.current;
    const to = value;

    if (from === to) {
      setDisplayValue(to);
      return;
    }

    const duration = 900;
    const startedAt = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(from + (to - from) * eased);
      setDisplayValue(nextValue);

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      }
    };

    frame = window.requestAnimationFrame(tick);
    previousTargetRef.current = to;

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [value]);

  return <>{integerFormatter.format(displayValue)}</>;
}

type HomeStatsBarProps = {
  initialStats?: HomeStatItem[];
};

export default function HomeStatsBar({ initialStats = FALLBACK_HOME_STATS }: HomeStatsBarProps) {
  const [stats, setStats] = useState<HomeStatItem[]>(initialStats);

  useEffect(() => {
    let isMounted = true;
    let refreshTimer: number | null = null;

    const refreshStats = async () => {
      try {
        const nextStats = await loadHomeStatsFromSupabase(supabase);
        if (isMounted) {
          setStats(nextStats);
        }
      } catch {
        if (isMounted) {
          setStats((current) => (current.length ? current : FALLBACK_HOME_STATS));
        }
      }
    };

    const scheduleRefresh = () => {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }

      refreshTimer = window.setTimeout(() => {
        void refreshStats();
      }, 180);
    };

    const visibilityRefresh = () => {
      if (document.visibilityState === "visible") {
        void refreshStats();
      }
    };

    void refreshStats();

    const channel = supabase
      .channel("home-stats-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "network_routes" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "aircraft_fleet" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "aircraft_models" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flight_reservations" },
        scheduleRefresh,
      )
      .subscribe();

    const intervalId = window.setInterval(() => {
      void refreshStats();
    }, 120000);

    document.addEventListener("visibilitychange", visibilityRefresh);

    return () => {
      isMounted = false;
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", visibilityRefresh);
      void supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="parallax-stats grid gap-0 overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(4,21,44,0.78)] backdrop-blur-md md:grid-cols-5">
      {stats.map((item, index) => (
        <div
          key={item.key}
          className={`flex min-h-[132px] flex-col items-center justify-center px-6 py-7 text-center ${
            index !== stats.length - 1 ? "md:border-r md:border-r-white/16" : ""
          }`}
        >
          <span className="text-[52px] font-semibold leading-none tracking-[-0.04em] text-emerald-300 sm:text-[58px]">
            <AnimatedStatValue value={item.value} />
          </span>
          <span className="mt-2 text-[26px] font-medium text-white/90">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
