import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type PremiumPageShellProps = {
  children: ReactNode;
  className?: string;
  size?: "default" | "wide" | "full";
};

export function PremiumPageShell({ children, className, size = "wide" }: PremiumPageShellProps) {
  return (
    <div className={cn("pw-premium-page-shell", `pw-premium-page-shell--${size}`, className)}>
      {children}
    </div>
  );
}
