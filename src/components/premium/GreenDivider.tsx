import { cn } from "@/lib/utils";

type GreenDividerProps = {
  className?: string;
  label?: string;
};

export function GreenDivider({ className, label }: GreenDividerProps) {
  return (
    <div className={cn("pw-green-divider", className)} aria-hidden={!label}>
      {label ? <span>{label}</span> : null}
    </div>
  );
}
