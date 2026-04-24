import Link from "next/link";

import { SignOutButton } from "@/components/admin/SignOutButton";

export default function AccessDeniedPage() {
  return (
    <main className="auth-screen">
      <section className="auth-panel">
        <div className="auth-copy">
          <span className="panel-badge">Acceso restringido</span>
          <h1>Sin permisos para el Control Center</h1>
          <p>
            La cuenta autenticada no tiene rol owner/admin/staff habilitado para
            este panel privado.
          </p>
        </div>

        <div className="stack">
          <Link className="button button-primary" href="/login">
            Volver al login
          </Link>
          <SignOutButton />
        </div>
      </section>
    </main>
  );
}
