"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PublicHeader from "@/components/site/PublicHeader";
import { supabase } from "@/lib/supabase/browser";
import { ensurePilotProfile } from "@/lib/pilot-profile";

export default function RegisterPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("Chile");
  const [baseHub, setBaseHub] = useState("SCEL");
  const [simulator, setSimulator] = useState("MSFS 2020");

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) return;

      if (data.session?.user) {
        await ensurePilotProfile(data.session.user);
        router.replace("/dashboard");
      }
    });

    return () => {
      isMounted = false;
    };
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");
    setInfoMessage("");

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          country: country.trim(),
          base_hub: baseHub,
          simulator,
        },
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setSubmitting(false);
      return;
    }

    if (data.session?.user) {
      await ensurePilotProfile(data.session.user);
      setSubmitting(false);
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    setInfoMessage(
      "Cuenta creada. El sistema asignará automáticamente tu callsign PWG al primer ingreso."
    );
    setSubmitting(false);
  }

  return (
    <main className="grid-overlay">
      <section className="parallax-hero relative isolate min-h-screen overflow-hidden">
        <div className="parallax-bg" />
        <div className="parallax-overlay" />

        <div className="relative z-10">
          <header className="pw-container pt-5">
            <PublicHeader />
          </header>

          <div className="pw-container flex min-h-[calc(100vh-108px)] items-center py-12 sm:py-16 lg:py-20">
            <div className="grid w-full gap-6 lg:grid-cols-[1fr_1fr]">
              <section className="glass-panel rounded-[34px] p-7 sm:p-9">
                <span className="parallax-chip mb-6">REGISTRO PILOTO</span>

                <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
                  Crea tu cuenta Patagonia Wings
                </h1>

                <p className="mt-5 max-w-2xl text-base leading-8 text-white/82">
                  El registro crea al piloto dentro de Patagonia Wings y el
                  sistema asigna automáticamente su callsign oficial PWG.
                </p>

                <div className="mt-8 grid gap-4 sm:grid-cols-2">
                  {[
                    "Callsign PWG autoasignado",
                    "Hub base inicial fijo",
                    "Simulador principal",
                    "Perfil operacional",
                  ].map((item) => (
                    <div
                      key={item}
                      className="surface-outline rounded-[22px] px-5 py-5 text-sm leading-7 text-white/80"
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </section>

              <section className="glass-panel rounded-[34px] p-7 sm:p-9">
                <span className="section-chip">Registro</span>

                <h2 className="mt-4 text-3xl font-semibold text-white">
                  Crear cuenta
                </h2>

                <form className="mt-7 grid gap-5" onSubmit={handleSubmit}>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="field-label">Nombre</label>
                      <input
                        className="input-premium"
                        type="text"
                        placeholder="Claudio"
                        value={firstName}
                        onChange={(event) => setFirstName(event.target.value)}
                        required
                      />
                    </div>

                    <div>
                      <label className="field-label">Apellido</label>
                      <input
                        className="input-premium"
                        type="text"
                        placeholder="Lizama"
                        value={lastName}
                        onChange={(event) => setLastName(event.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="field-label">Callsign</label>
                      <input
                        className="input-premium opacity-80"
                        type="text"
                        value="Se asigna automáticamente"
                        readOnly
                      />
                    </div>

                    <div>
                      <label className="field-label">Email</label>
                      <input
                        className="input-premium"
                        type="email"
                        placeholder="pwg001@patagoniawings.app"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="field-label">Contraseña</label>
                      <input
                        className="input-premium"
                        type="password"
                        placeholder="••••••••••••"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="new-password"
                        required
                      />
                    </div>

                    <div>
                      <label className="field-label">País</label>
                      <input
                        className="input-premium"
                        type="text"
                        placeholder="Chile"
                        value={country}
                        onChange={(event) => setCountry(event.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="field-label">Hub base inicial</label>
                      <select
                        className="input-premium"
                        value={baseHub}
                        onChange={(event) => setBaseHub(event.target.value)}
                      >
                        <option value="SCEL">SCEL - Santiago</option>
                        <option value="SCTE">SCTE - Puerto Montt</option>
                        <option value="SCFA">SCFA - Antofagasta</option>
                      </select>
                    </div>

                    <div>
                      <label className="field-label">Simulador principal</label>
                      <select
                        className="input-premium"
                        value={simulator}
                        onChange={(event) => setSimulator(event.target.value)}
                      >
                        <option value="MSFS 2020">MSFS 2020</option>
                        <option value="MSFS 2024">MSFS 2024</option>
                        <option value="X-Plane">X-Plane</option>
                      </select>
                    </div>
                  </div>

                  {errorMessage ? (
                    <div className="rounded-[18px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                      {errorMessage}
                    </div>
                  ) : null}

                  {infoMessage ? (
                    <div className="rounded-[18px] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
                      {infoMessage}
                    </div>
                  ) : null}

                  <div className="grid gap-3 pt-2">
                    <button type="submit" className="button-primary" disabled={submitting}>
                      {submitting ? "Creando cuenta..." : "Crear cuenta"}
                    </button>

                    <Link href="/login" className="button-secondary">
                      Ya tengo cuenta
                    </Link>
                  </div>
                </form>
              </section>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}