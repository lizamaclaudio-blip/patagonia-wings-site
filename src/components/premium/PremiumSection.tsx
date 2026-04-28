import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { GreenDivider } from "./GreenDivider";

type PremiumSectionProps = HTMLAttributes<HTMLElement> & {
  eyebrow?: string;
  title?: string;
  description?: string;
  actions?: ReactNode;
  children?: ReactNode;
  withDivider?: boolean;
};

export function PremiumSection({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
  withDivider = true,
  ...props
}: PremiumSectionProps) {
  return (
    <section className={cn("pw-premium-section", className)} {...props}>
      {withDivider ? <GreenDivider /> : null}
      {(eyebrow || title || description || actions) ? (
        <div className="pw-premium-section__header">
          <div>
            {eyebrow ? <p className="pw-premium-eyebrow">{eyebrow}</p> : null}
            {title ? <h2 className="pw-premium-section__title">{title}</h2> : null}
            {description ? <p className="pw-premium-section__description">{description}</p> : null}
          </div>
          {actions ? <div className="pw-premium-section__actions">{actions}</div> : null}
        </div>
      ) : null}
      <div className="pw-premium-section__body">{children}</div>
    </section>
  );
}
