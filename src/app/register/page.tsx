"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PublicHeader from "@/components/site/PublicHeader";
import { supabase } from "@/lib/supabase/browser";
import { ensurePilotProfile } from "@/lib/pilot-profile";

const COUNTRIES = [
  "Afganistán","Albania","Alemania","Algeria","Andorra","Angola","Antigua y Barbuda",
  "Arabia Saudita","Argentina","Armenia","Australia","Austria","Azerbaiyán",
  "Bahamas","Bahrein","Bangladesh","Barbados","Bélgica","Belice","Benín",
  "Bielorrusia","Bolivia","Bosnia y Herzegovina","Botsuana","Brasil","Brunéi",
  "Bulgaria","Burkina Faso","Burundi","Bután",
  "Cabo Verde","Camboya","Camerún","Canadá","Catar","Chad","Chile","China",
  "Chipre","Colombia","Comoras","Congo","Corea del Norte","Corea del Sur",
  "Costa de Marfil","Costa Rica","Croacia","Cuba",
  "Dinamarca","Dominica",
  "Ecuador","Egipto","El Salvador","Emiratos Árabes Unidos","Eritrea","Eslovaquia",
  "Eslovenia","España","Estados Unidos","Estonia","Esuatini","Etiopía",
  "Filipinas","Finlandia","Fiyi","Francia",
  "Gabón","Gambia","Georgia","Ghana","Granada","Grecia","Guatemala","Guinea",
  "Guinea Ecuatorial","Guinea-Bisáu","Guyana",
  "Haití","Honduras","Hungría",
  "India","Indonesia","Irak","Irán","Irlanda","Islandia","Islas Marshall",
  "Islas Salomón","Israel","Italia",
  "Jamaica","Japón","Jordania",
  "Kazajistán","Kenia","Kirguistán","Kiribati","Kuwait",
  "Laos","Lesoto","Letonia","Líbano","Liberia","Libia","Liechtenstein","Lituania",
  "Luxemburgo",
  "Madagascar","Malasia","Malaui","Maldivas","Mali","Malta","Marruecos","Mauritania",
  "Mauricio","México","Micronesia","Moldavia","Mónaco","Mongolia","Montenegro",
  "Mozambique","Myanmar",
  "Namibia","Nauru","Nepal","Nicaragua","Níger","Nigeria","Noruega","Nueva Zelanda",
  "Omán",
  "Países Bajos","Pakistán","Palaos","Panamá","Papúa Nueva Guinea","Paraguay","Perú",
  "Polonia","Portugal",
  "Reino Unido","República Centroafricana","República Checa","República Democrática del Congo",
  "República Dominicana","Ruanda","Rumanía","Rusia",
  "Samoa","San Cristóbal y Nieves","San Marino","San Vicente y las Granadinas",
  "Santa Lucía","Santo Tomé y Príncipe","Senegal","Serbia","Seychelles","Sierra Leona",
  "Singapur","Siria","Somalia","Sri Lanka","Sudáfrica","Sudán","Sudán del Sur","Suecia",
  "Suiza","Surinam",
  "Tailandia","Tanzania","Tayikistán","Timor Oriental","Togo","Tonga","Trinidad y Tobago",
  "Túnez","Turkmenistán","Turquía","Tuvalu",
  "Ucrania","Uganda","Uruguay","Uzbekistán",
  "Vanuatu","Venezuela","Vietnam",
  "Yemen","Yibuti",
  "Zambia","Zimbabue",
];

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
  // When true, show confirmation screen instead of form
  const [emailSent, setEmailSent] = useState(false);

  useEffect(() => {
    let isMounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!isMounted) return;
      if (data.session?.user) {
        await ensurePilotProfile(data.session.user);
        router.replace("/dashboard");
      }
    });
    return () => { isMounted = false; };
  }, [router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage("");

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          country,
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

    // Session available → email confirmation disabled in Supabase, log in directly
    if (data.session?.user) {
      await ensurePilotProfile(data.session.user);
      setSubmitting(false);
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    // No session → Supabase sent a confirmation email
    setSubmitting(false);
    setEmailSent(true);
  }

  // ── EMAIL SENT SCREEN ───────────────────────────────────────────────────────
  if (emailSent) {
    return (
      <main className="grid-overlay">
        <section className="parallax-hero relative isolate min-h-screen overflow-hidden">
          <div className="parallax-bg" />
          <div className="parallax-overlay" />
          <div className="relative z-10">
            <header className="pw-container pt-5">
              <PublicHeader />
            </header>
            <div className="pw-container flex min-h-[calc(100vh-108px)] items-center justify-center py-16">
              <div className="glass-panel w-full max-w-md rounded-[34px] p-9 text-center">
                {/* Icon */}
                <div
                  className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full"
                  style={{ background: "rgba(17,181,110,0.14)", border: "1px solid rgba(17,181,110,0.30)" }}
                >
                  <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#11b56e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="16" rx="3"/>
                    <polyline points="2,4 12,13 22,4"/>
                  </svg>
                </div>

                <h2 className="text-3xl font-bold text-white">¡Cuenta creada!</h2>

                <p className="mt-4 text-[15px] leading-7 text-white/70">
                  Te enviamos un correo de confirmación a{" "}
                  <span className="font-semibold text-cyan-300">{email}</span>.
                  <br />
                  Confirma tu dirección para activar tu perfil de piloto.
                </p>

                <div
                  className="mt-6 rounded-[16px] px-5 py-4 text-[13px] leading-6 text-white/60"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                >
                  Una vez confirmado tu correo, podrás iniciar sesión y tu
                  callsign <span className="font-semibold text-white/80">PWG</span> será
                  asignado automáticamente en el primer acceso.
                </div>

                <div className="mt-8 grid gap-3">
                  <Link
                    href="/login"
                    className="button-primary text-center"
                  >
                    Ir a Iniciar Sesión
                  </Link>
                  <button
                    type="button"
                    onClick={() => setEmailSent(false)}
                    className="button-ghost text-sm text-white/50"
                  >
                    Volver al registro
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    );
  }

  // ── REGISTER FORM ───────────────────────────────────────────────────────────
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

              {/* ── WELCOME PANEL ──────────────────────────────────── */}
              <section className="relative overflow-hidden rounded-[34px]">
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: "url('/branding/home-hero-4k.jpg')" }}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(4,18,40,0.72) 0%, rgba(4,18,40,0.34) 34%, rgba(4,18,40,0.52) 66%, rgba(4,18,40,0.90) 100%)",
                  }}
                />
                <div
                  className="absolute bottom-0 left-0 h-64 w-64 rounded-full opacity-20 blur-3xl"
                  style={{ background: "radial-gradient(circle, #11b56e 0%, transparent 70%)" }}
                />

                <div className="relative z-10 flex h-full flex-col justify-between p-7 sm:p-9" style={{ minHeight: "520px" }}>
                  <div>
                    <span
                      className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-white"
                      style={{ borderColor: "rgba(17,181,110,0.40)", background: "rgba(17,181,110,0.12)" }}
                    >
                      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "#11b56e", boxShadow: "0 0 6px #11b56e" }} />
                      Patagonia Wings — Virtual Airline
                    </span>
                  </div>

                  <div className="mt-auto pt-10">
                    <h1 className="text-4xl font-bold leading-[1.15] tracking-tight text-white sm:text-5xl">
                      Bienvenido a bordo,<br />
                      <span style={{ background: "linear-gradient(90deg, #67d7ff 0%, #11b56e 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                        comandante.
                      </span>
                    </h1>

                    <p className="mt-5 max-w-sm text-[15px] leading-7 text-white/75">
                      Únete a una aerolínea virtual que nace desde la Patagonia.
                      Vuelos reales, despacho operacional, ACARS integrado y una
                      comunidad de pilotos en pleno crecimiento.
                    </p>

                    <div className="mt-7 flex flex-wrap gap-2">
                      {[
                        { icon: "✦", label: "Callsign PWG oficial" },
                        { icon: "✈", label: "ACARS en tiempo real" },
                        { icon: "📋", label: "Despacho SimBrief" },
                        { icon: "🌍", label: "Comunidad naciente" },
                      ].map(({ icon, label }) => (
                        <span
                          key={label}
                          className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold text-white/80"
                          style={{ borderColor: "rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.07)", backdropFilter: "blur(6px)" }}
                        >
                          <span>{icon}</span>{label}
                        </span>
                      ))}
                    </div>

                    <div
                      className="mt-8 flex items-center gap-4 text-[11px] font-semibold uppercase tracking-[0.22em]"
                      style={{ color: "rgba(255,255,255,0.38)" }}
                    >
                      <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.12)" }} />
                      Experiencia de vuelo realista desde el sur del mundo
                      <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.12)" }} />
                    </div>
                  </div>
                </div>
              </section>

              {/* ── FORM PANEL ─────────────────────────────────────── */}
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
                        onChange={(e) => setFirstName(e.target.value)}
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
                        onChange={(e) => setLastName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="field-label">Callsign</label>
                      <input
                        className="input-premium opacity-60"
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
                        placeholder="piloto@correo.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
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
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        required
                      />
                    </div>
                    <div>
                      <label className="field-label">País</label>
                      <select
                        className="input-premium"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        required
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label className="field-label">Hub base inicial</label>
                      <select
                        className="input-premium"
                        value={baseHub}
                        onChange={(e) => setBaseHub(e.target.value)}
                      >
                        <option value="SCEL">SCEL — Santiago</option>
                        <option value="SCTE">SCTE — Puerto Montt</option>
                        <option value="SCFA">SCFA — Antofagasta</option>
                      </select>
                    </div>
                    <div>
                      <label className="field-label">Simulador principal</label>
                      <select
                        className="input-premium"
                        value={simulator}
                        onChange={(e) => setSimulator(e.target.value)}
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

                  <div className="grid gap-3 pt-2">
                    <button type="submit" className="button-primary" disabled={submitting}>
                      {submitting ? "Creando cuenta..." : "Crear cuenta"}
                    </button>
                    <Link href="/login" className="button-secondary text-center">
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
