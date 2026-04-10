import Image from "next/image";
import { cn } from "@/lib/utils";

export function BrandLogo({
  compact = false,
  dark = false,
  stacked = false,
}: {
  compact?: boolean;
  dark?: boolean;
  stacked?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-3", stacked && "flex-col items-start gap-2")}>
      <Image
        src="/branding/patagonia-logo.png"
        alt="Patagonia Wings"
        width={compact ? 52 : 92}
        height={compact ? 52 : 92}
        className={compact ? "h-[52px] w-[52px] object-contain" : "h-20 w-20 object-contain lg:h-24 lg:w-24"}
        priority
      />

      <div>
        <p
          className={cn(
            "text-xs font-semibold uppercase tracking-[0.28em]",
            compact ? "sm:text-[11px]" : "text-sm sm:text-base",
            dark ? "text-sky-900" : "text-white/92"
          )}
        >
          Patagonia Wings
        </p>
        <p className={cn(compact ? "text-sm" : "text-base sm:text-lg", dark ? "text-slate-600" : "text-white/74")}>
          Virtual Airline Operations
        </p>
      </div>
    </div>
  );
}
