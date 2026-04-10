import type { ReactNode } from "react";
import PilotStatusRail from "@/components/site/PilotStatusRail";

export default function AuthPageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="pw-container py-8 sm:py-10 lg:py-12">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">{children}</div>
        <PilotStatusRail />
      </div>
    </div>
  );
}
