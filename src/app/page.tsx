import Link from "next/link";
import { BrandLogo } from "@/components/ui/BrandLogo";

const stats = [
  { value: "15+", label: "Años" },
  { value: "50+", label: "Destinos" },
  { value: "8", label: "Aeronaves" },
  { value: "100%", label: "Seguridad" },
];

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

const fleet = ["B737 Series", "C208 Caravan", "ATR Regional", "A320 Family"];

export default function HomePage() {
  return (
    <main className="bg-[#03162f] text-white">
      <section className="parallax-hero relative min-h-screen overflow-hidden">
        <div className="parallax-bg" />
        <div className="parallax-wing" />
        <div className="parallax-overlay" />

        <div className="relative z-20 flex min-h-screen flex-col">
          <header className="pw-container pt-5">
            <div className="parallax-nav flex items-center justify-between gap-6 rounded-[26px] px-5 py-4">
              <Link href="#inicio" className="shrink-0">
                <BrandLogo compact />
              </Link>

              <nav className="hidden items-center gap-10 text-[15px] font-semibold tracking-[0.02em] text-white/92 lg:flex">
                <a href="#inicio" className="parallax-link active">Inicio</a>
                <a href="#nosotros" className="parallax-link">Nosotros</a>
                <a href="#servicios" className="parallax-link">Servicios</a>
                <a href="#flota" className="parallax-link">Flota</a>
                <a href="#certificaciones" className="parallax-link">Certificaciones</a>
                <a href="#contacto" className="parallax-link">Contacto</a>
              </nav>

              <div className="hidden lg:block">
                <Link href="/login" className="parallax-login-button">
                  Iniciar sesión
                </Link>
              </div>
            </div>
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
            <div className="parallax-stats grid gap-0 overflow-hidden rounded-[28px] border border-white/10 bg-[rgba(4,21,44,0.78)] backdrop-blur-md md:grid-cols-4">
              {stats.map((item, index) => (
                <div
                  key={item.label}
                  className={`flex min-h-[132px] flex-col items-center justify-center px-6 py-7 text-center ${
                    index !== stats.length - 1 ? "md:border-r md:border-r-white/16" : ""
                  }`}
                >
                  <span className="text-[52px] font-semibold leading-none tracking-[-0.04em] text-emerald-300 sm:text-[58px]">
                    {item.value}
                  </span>
                  <span className="mt-2 text-[26px] font-medium text-white/90">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="nosotros" className="pw-container py-20 sm:py-24">
        <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <div className="parallax-chip">Nosotros</div>
            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
              Patagonia Wings con presencia web de aerolínea real
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200/88">
              Esta nueva home toma la lógica del mockup one page parallax y la convierte en una página web real:
              navegación superior transparente, hero a pantalla completa, identidad de marca y un flujo limpio hacia login,
              perfil, habilitaciones y despacho.
            </p>
          </div>

          <div className="overflow-hidden rounded-[32px] border border-white/10 bg-white/5 p-3 shadow-[0_20px_80px_rgba(0,0,0,0.25)] backdrop-blur-sm">
            <img
              src="/branding/mock-parallax-reference.png"
              alt="Referencia visual Patagonia Wings"
              className="h-full w-full rounded-[24px] object-cover"
            />
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

          <div>
            <h2 className="text-4xl font-semibold tracking-[-0.03em] text-white sm:text-5xl">
              Flota con imagen propia de la app
            </h2>
            <p className="mt-5 text-lg leading-8 text-slate-200/84">
              Conservamos el branding real de Patagonia Wings y lo llevamos a una portada más aérea, limpia y de mejor impacto visual.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {fleet.map((item) => (
                <div key={item} className="rounded-[22px] border border-white/10 bg-white/[0.05] px-5 py-4 text-base font-medium text-white/92 backdrop-blur-sm">
                  {item}
                </div>
              ))}
            </div>
          </div>
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
