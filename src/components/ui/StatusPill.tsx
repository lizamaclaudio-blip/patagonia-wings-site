import type { ReactNode } from "react";

type Variant = "success" | "warning" | "info" | "danger";

const styles: Record<Variant, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
};

export function StatusPill({
  children,
  variant = "info",
}: {
  children: ReactNode;
  variant?: Variant;
}) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${styles[variant]}`}>
      {children}
    </span>
  );
}
