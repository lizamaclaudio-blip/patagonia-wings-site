import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PremiumStatItem = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: "default" | "green" | "cyan" | "amber" | "rose";
};

type PremiumStatsStripProps = {
  title?: string;
  eyebrow?: string;
  items: PremiumStatItem[];
  className?: string;
};

export function PremiumStatsStrip({ title, eyebrow, items, className }: PremiumStatsStripProps) {
  return (
    <section className={cn("pw-premium-stats", className)}>
      {(eyebrow || title) ? (
        <div className="pw-premium-stats__intro">
          {eyebrow ? <p className="pw-premium-eyebrow">{eyebrow}</p> : null}
          {title ? <h3>{title}</h3> : null}
        </div>
      ) : null}

      <div className="pw-premium-stats__grid">
        {items.map((item) => (
          <article key={item.label} className={cn("pw-premium-stat", item.accent && `pw-premium-stat--${item.accent}`)}>
            <p className="pw-premium-stat__label">{item.label}</p>
            <div className="pw-premium-stat__value">{item.value}</div>
            {item.hint ? <p className="pw-premium-stat__hint">{item.hint}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}
