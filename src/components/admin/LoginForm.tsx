"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });

    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
    };

    if (!response.ok) {
      setError(payload.error ?? "No se pudo iniciar sesión.");
      setLoading(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <label className="field">
        <span className="field-label">Email</span>
        <input
          className="input"
          type="email"
          name="email"
          placeholder="correo@patagoniaw.com"
          autoComplete="email"
          required
        />
      </label>

      <label className="field">
        <span className="field-label">Contraseña</span>
        <input
          className="input"
          type="password"
          name="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
        />
      </label>

      {error ? <p className="form-error">{error}</p> : null}

      <button className="button button-primary auth-submit" disabled={loading}>
        {loading ? "Validando..." : "Ingresar al Control Center"}
      </button>
    </form>
  );
}
