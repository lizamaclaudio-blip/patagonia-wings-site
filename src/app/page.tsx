import { redirect } from "next/navigation";

import { resolveAdminContext } from "@/lib/auth/access";

export default async function HomePage() {
  const context = await resolveAdminContext();

  if (context) {
    redirect("/dashboard");
  }

  redirect("/login");
}
