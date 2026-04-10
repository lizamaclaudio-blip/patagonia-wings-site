import type { ReactNode } from "react";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { BrandLogo } from "@/components/ui/BrandLogo";

export function WebShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="pw-container py-6 lg:py-8">
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <SidebarNav />

        <main className="min-w-0 space-y-6">
          <section className="brand-hero rounded-[34px] p-6 sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <BrandLogo compact />
                <div className="mt-5 panel-chip">PATAGONIA WINGS / WEB</div>
                <h1 className="mt-4 text-3xl font-semibold text-white sm:text-4xl">{title}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-white/82 sm:text-base">{subtitle}</p>
              </div>
              {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
            </div>
          </section>

          {children}
        </main>
      </div>
    </div>
  );
}
