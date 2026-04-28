import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type PremiumCardTone = "default" | "soft" | "strong" | "success" | "warning" | "danger";

type PremiumCardProps = HTMLAttributes<HTMLDivElement> & {
  title?: string;
  eyebrow?: string;
  description?: string;
  tone?: PremiumCardTone;
  actions?: ReactNode;
  children?: ReactNode;
};

export function PremiumCard({
  title,
  eyebrow,
  description,
  tone = "default",
  actions,
  className,
  children,
  ...props
}: PremiumCardProps) {
  return (
    <section className={cn("pw-premium-card", `pw-premium-card--${tone}`, className)} {...props}>
      {(eyebrow || title || description || actions) ? (
        <header className="pw-premium-card__header">
          <div>
            {eyebrow ? <p className="pw-premium-eyebrow">{eyebrow}</p> : null}
            {title ? <h3 className="pw-premium-card__title">{title}</h3> : null}
            {description ? <p className="pw-premium-card__description">{description}</p> : null}
          </div>
          {actions ? <div className="pw-premium-card__actions">{actions}</div> : null}
        </header>
      ) : null}

      {children ? <div className="pw-premium-card__body">{children}</div> : null}
    </section>
  );
}
