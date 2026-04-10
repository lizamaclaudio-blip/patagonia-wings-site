import type { ReactNode } from "react";

export function MetricCard({
  label,
  value,
  help,
  badge,
}: {
  label: string;
  value: ReactNode;
  help: string;
  badge?: ReactNode;
}) {
  return (
    <div className="rounded-[26px] border border-slate-200 bg-white/85 p-4 shadow-[0_10px_30px_rgba(31,84,147,0.07)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">{label}</p>
        {badge}
      </div>
      <div className="mt-3">{typeof value === "string" || typeof value === "number" ? <p className="metric-value">{value}</p> : value}</div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{help}</p>
    </div>
  );
}
