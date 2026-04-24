import { redirect } from "next/navigation";

import { LoginForm } from "@/components/admin/LoginForm";
import { resolveAdminContext } from "@/lib/auth/access";

export default async function LoginPage() {
  const context = await resolveAdminContext();

  if (context) {
    redirect("/dashboard");
  }

  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div className="auth-copy">
          <span className="panel-badge">Private Admin</span>
          <h1>PatagoniaWings.ControlCenter</h1>
          <p>
            Backoffice privado para administrar pilotos, hubs, flota,
            operaciones, scoring y auditoría sobre Supabase real.
          </p>
        </div>

        <LoginForm />
      </section>
    </main>
  );
}
