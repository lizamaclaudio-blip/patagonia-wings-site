import Link from "next/link";
import HomeFleetShowcase from "@/components/site/HomeFleetShowcase";
import HomeStatsBar from "@/components/site/HomeStatsBar";
import PublicHeader from "@/components/site/PublicHeader";
import { ACARS_VERSION, ACARS_BACKEND, ACARS_SIZE_MB, ACARS_RELEASE_NOTES, ACARS_DOWNLOAD_URL } from "@/lib/acars-version";

const services = [
  {
    title: "Reserva y despacho web",
    text: "Prepara tu operación antes del vuelo, desde la reserva hasta el briefing final listo para ACARS.",
  },
  {
    title: "Operación regional",
    text: "Una experiencia centrada en la Patagonia, conectando rutas, hubs y aeronaves con identidad propia.",
  },
  {
    title: "Perfil y habilitaciones",
    text: "Gestiona certificaciones, flota habilitada, datos del piloto y estado operacional desde un solo lugar.",
  },
];

export default function HomePage() {
  return (
    <main className="bg-[#03162f] text-white">
      <section className="parallax-hero relative min-h-screen overflow-hidden">
        <div className="parallax-bg" />
        <div className="parallax-wing" />
        <div className="parallax-overlay" />

        <div className="relative z-20 flex min-h-screen flex-col">
          <header className="pw-container pt-5">
            <PublicHeader />
          </header>

          <div id="inicio" className="pw-container relative flex flex-1 items-center py-12 sm:py-16 lg:py-20">
            <div className="max-w-[560px] pt-10 sm:pt-16 lg:pt-10">
              <h1 className="text-[62px] font-semibold leading-[0.94] tracking-[-0.04em] text-white drop-shadow-[0_8px_28px_rgba(0,0,0,0.35)] sm:text-[84px] lg:text-[104px]">
                Patagonia
                <br />
                Wings
              </h1>

              <p className="mt-8 max-w-[520px] text-[22px] font-medium text-white/90 sm:text-[28px]">
                Tu conexión aérea en la Patagonia
              </p>

              <div className="mt-6 h-[3px] w-28 rounded-full bg-gradient-to-r from-emerald-400 via-cyan-300 to-transparent" />

              <div className="mt-8 flex flex-wrap gap-4">
                <a href="#nosotros" className="parallax-outline-button">
                  Descubrir más
                  <span aria-hidden>→</span>
                </a>
              </div>
            </div>
          </div>

          <div className="pw-container relative z-20 pb-6 sm:pb-8">
            <HomeStatsBar />
          </div>
        </div>
      </section>

      <section id="nosotros" className="pw-container py-20 sm:py-24">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="parallax-chip">Nosotros</div>
            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
              Una comunidad que crece con objetivos, inmersión y rol real
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200/88">
              En Patagonia Wings queremos construir una comunidad viva, cercana y ambiciosa: un lugar donde cada
              piloto tenga un objetivo, una ruta por seguir y una razón real para volver a cabina. Diseñamos
              operaciones realistas para darte inmersión completa en simuladores de vuelo, desde la planificación
              hasta el cierre de cada operación.
            </p>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-200/78">
              Aquí puedes tomar el rol que quieras vivir dentro de la aerolínea y sentirte piloto de verdad. En
              Patagonia Wings asumimos el role play de simulación completa incluso en conversaciones y operaciones,
              y muy pronto habilitaremos Discord para nuestros canales operativos e informativos.
            </p>
            <div className="mt-8 inline-flex rounded-full border border-emerald-300/20 bg-emerald-400/10 px-5 py-2 text-sm font-semibold text-emerald-100">
              Sé el piloto que quieres ser en Patagonia Wings
            </div>
          </div>

          <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-3 shadow-[0_20px_80px_rgba(0,0,0,0.25)] backdrop-blur-sm">
            <div className="relative overflow-hidden rounded-[24px]">
              <img
                src="/branding/nosotros-ops-room.svg"
                alt="Sala de operaciones de Patagonia Wings con pilotos reunidos frente a una pantalla de trafico y briefing"
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#03162f] via-[#03162f]/72 to-transparent px-6 pb-5 pt-12">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-200/78">
                  Comunidad Patagonia Wings
                </p>
                <p className="mt-2 text-lg font-semibold text-white">
                  Briefing, inmersión y operación compartida
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="servicios" className="border-y border-white/8 bg-[rgba(6,24,48,0.78)] py-20 backdrop-blur-sm">
        <div className="pw-container">
          <div className="parallax-chip">Servicios</div>
          <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <h2 className="max-w-3xl text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
              Una portada mucho más web, más comercial y más Patagonia Wings
            </h2>
            <Link href="/dashboard" className="button-primary w-fit">
              Ver dashboard demo
            </Link>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {services.map((item) => (
              <article key={item.title} className="rounded-[28px] border border-white/10 bg-white/[0.06] p-7 backdrop-blur-md">
                <div className="mb-5 h-1.5 w-16 rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300" />
                <h3 className="text-2xl font-semibold text-white">{item.title}</h3>
                <p className="mt-4 text-base leading-7 text-slate-200/82">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="flota" className="pw-container py-20 sm:py-24">
        <div className="parallax-chip">Flota</div>
        <div className="mt-5 grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div className="overflow-hidden rounded-[34px] border border-white/10 bg-white/4 p-3 shadow-[0_20px_80px_rgba(0,0,0,0.25)] backdrop-blur-sm">
            <img
              src="/branding/hero-banner.png"
              alt="Flota Patagonia Wings"
              className="h-full w-full rounded-[26px] object-cover"
            />
          </div>

          <HomeFleetShowcase />
        </div>
      </section>

      <section id="certificaciones" className="border-y border-white/8 bg-[rgba(5,19,39,0.92)] py-20">
        <div className="pw-container">
          <div className="parallax-chip">Certificaciones</div>
          <h2 className="mt-5 text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
            Certificaciones, habilitaciones y operación previa al vuelo
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              "Perfil piloto completo",
              "Habilitación IFR y ratings",
              "Reserva, despacho y briefing final",
            ].map((item) => (
              <div key={item} className="rounded-[26px] border border-white/10 bg-gradient-to-b from-white/[0.08] to-white/[0.04] px-6 py-7">
                <div className="mb-4 h-10 w-10 rounded-2xl bg-gradient-to-br from-cyan-300/35 to-emerald-300/25" />
                <p className="text-lg font-semibold text-white">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="descargas" className="border-y border-white/8 bg-[rgba(4,18,38,0.96)] py-20 sm:py-24">
        <div className="pw-container">
          <div className="parallax-chip mb-5">Descargas</div>
          <div className="grid gap-10 lg:grid-cols-[1fr_420px] lg:items-start">
            <div>
              <h2 className="text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
                ACARS Patagonia Wings
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-200/82">
                El cliente oficial de ACARS para vuelos en MSFS 2020/2024. Sincronización
                automática con Supabase, telemetría en tiempo real, panel de luces LED y
                copiloto de voz integrado.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <a
                  href={ACARS_DOWNLOAD_URL}
                  className="inline-flex items-center gap-3 rounded-2xl px-8 py-4 text-base font-semibold text-white transition duration-200 hover:-translate-y-0.5"
                  style={{
                    background: "linear-gradient(135deg, #1a6fb5 0%, #0ca789 100%)",
                    boxShadow: "0 14px 40px rgba(12, 167, 137, 0.25)",
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <path d="M10 2v10m0 0l-3-3m3 3l3-3M3 14v2a1 1 0 001 1h12a1 1 0 001-1v-2"
                      stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Descargar ACARS v{ACARS_VERSION}
                </a>
                <span className="text-sm text-slate-400">
                  Windows 10/11 · MSFS 2020/2024 · ~48 MB
                </span>
              </div>

              <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-white/12 bg-white/[0.05] px-4 py-2 backdrop-blur-sm">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="text-sm text-white/80">
                  Versión <span className="font-semibold text-white">{ACARS_VERSION}</span>
                  <span className="mx-2 text-white/30">·</span>
                  {ACARS_BACKEND}
                </span>
              </div>

              <div className="mt-5 rounded-[18px] border border-emerald-400/15 bg-emerald-400/5 px-5 py-4">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300/70">
                  Novedades v{ACARS_VERSION}
                </p>
                <ul className="flex flex-col gap-1">
                  {ACARS_RELEASE_NOTES.map((note) => (
                    <li key={note} className="flex items-start gap-2 text-sm text-slate-300/85">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                      {note}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {[
                {
                  icon: "✈",
                  title: "SimConnect nativo",
                  desc: "Conecta directamente con MSFS 2020 y 2024 via SimConnect. Sin apps intermedias.",
                  color: "#2D9CDB",
                },
                {
                  icon: "📡",
                  title: "Telemetría completa",
                  desc: "Luces, tren, APU, bleed air, transponder, presurización y más de 30 variables en tiempo real.",
                  color: "#0CA789",
                },
                {
                  icon: "🔊",
                  title: "Copiloto de voz",
                  desc: "Anuncios automáticos al cruzar 10.000 ft, aproximación, luces y llegada. Voz ES/CL/BR.",
                  color: "#FFD700",
                },
                {
                  icon: "☁",
                  title: "Sincronización Supabase",
                  desc: "PIREPs automáticos con score, landing rate, g-force y penalizaciones según reglas operacionales.",
                  color: "#3FB950",
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="flex items-start gap-4 rounded-[22px] border border-white/8 bg-white/[0.04] px-5 py-4 backdrop-blur-sm"
                >
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
                    style={{ background: `${f.color}22`, border: `1px solid ${f.color}44` }}
                  >
                    {f.icon}
                  </div>
                  <div>
                    <p className="font-semibold text-white">{f.title}</p>
                    <p className="mt-0.5 text-sm leading-6 text-slate-300/80">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 rounded-[28px] border border-white/8 bg-white/[0.03] p-7 backdrop-blur-sm">
            <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              Requisitos del sistema
            </p>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Sistema operativo", value: "Windows 10/11 (64-bit)" },
                { label: "Simulador", value: "MSFS 2020 o 2024" },
                { label: "Runtime", value: ".NET Framework 4.8.1" },
                { label: "Conexión", value: "Internet (Supabase sync)" },
              ].map((r) => (
                <div key={r.label}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                    {r.label}
                  </p>
                  <p className="mt-1 text-sm font-medium text-white/90">{r.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="contacto" className="pw-container py-20 sm:py-24">
        <div className="grid gap-6 rounded-[34px] border border-white/10 bg-gradient-to-r from-[rgba(9,38,78,0.84)] to-[rgba(8,89,82,0.74)] p-8 shadow-[0_20px_80px_rgba(0,0,0,0.28)] lg:grid-cols-[1fr_auto] lg:items-center lg:p-10">
          <div>
            <div className="parallax-chip">Contacto</div>
            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
              Siguiente paso: llevar este look al resto de la web
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/84">
              Con esta base ya podemos dejar login, registro, dashboard y perfil con la misma estética one page parallax.
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <Link href="/login" className="button-primary">
              Ir a login
            </Link>
            <Link href="/register" className="parallax-outline-button">
              Crear cuenta
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
