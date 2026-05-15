import Link from "next/link";
import type { ReactNode } from "react";
import HomeStatsBar from "@/components/site/HomeStatsBar";
import PublicFooter from "@/components/site/PublicFooter";
import PublicHeader from "@/components/site/PublicHeader";
import { FALLBACK_HOME_STATS, loadHomeStatsFromSupabase } from "@/lib/home-stats";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ACARS_VERSION, ACARS_BACKEND, ACARS_RELEASE_NOTES, ACARS_DOWNLOAD_URL } from "@/lib/acars-version";

const operationSteps = [
  {
    title: "Planifica tu vuelo",
    text: "Prepara tu ruta con herramientas profesionales y consulta clima, flota y destino.",
    icon: "☑",
  },
  {
    title: "Despacha tu operación",
    text: "Genera o carga tu OFP y valida la planificación antes del manifiesto.",
    icon: "□",
  },
  {
    title: "Conecta ACARS",
    text: "Vincula tu simulador con Patagonia Wings para seguimiento en tiempo real.",
    icon: "⌁",
  },
  {
    title: "Vuela Patagonia Wings",
    text: "Completa tu operación, envía tu PIREP y revisa tu resumen de vuelo.",
    icon: "✈",
  },
];

const integrations = [
  {
    title: "Navigraph",
    text: "Cartas, AIRAC y planificación profesional.",
    badge: "Integrado",
    badgeTone: "success",
    image: "/partners/navigraph-official-horizontal.png",
    featured: true,
  },
  {
    title: "SimBrief",
    text: "OFP, plan de vuelo y despacho integrado.",
    badge: "Integrado",
    badgeTone: "success",
    image: "/partners/simbrief-by-navigraph-official.png",
    featured: true,
  },
  {
    title: "Route Finder",
    text: "Explora rutas, aprende rutas utilizadas y encuentra nuevos destinos.",
    badge: "Activo",
    badgeTone: "info",
    icon: "⌖",
  },
  {
    title: "Cobertura Regional",
    text: "Operaciones por la Patagonia y Sudamérica.",
    badge: "Activa",
    badgeTone: "success",
    flags: ["CL", "AR", "BR", "UY"],
  },
  {
    title: "ACARS",
    text: "Seguimiento en tiempo real y reportes automaticos.",
    badge: "Integrado",
    badgeTone: "success",
    icon: "⌁",
  },
  {
    title: "Banderas y paises",
    text: "Identificacion clara de aeropuertos, paises y red regional.",
    badge: "Activo",
    badgeTone: "info",
    flags: ["CL", "AR", "PE", "BO"],
  },
];

const lowerCards = [
  {
    title: "Nuevos pilotos",
    text: "Comienza tu aventura en la aviación virtual con apoyo de nuestra comunidad.",
    href: "/register",
    link: "Más información",
    icon: "◎",
  },
  {
    title: "Vuelos en curso",
    text: "Sigue vuelos en tiempo real de nuestros pilotos conectados.",
    href: "/dashboard",
    link: "Ver vuelos en curso",
    icon: "✈",
  },
  {
    title: "Destinos destacados",
    text: "Descubre los aeropuertos mas visitados de nuestra red.",
    href: "/routes",
    link: "Explorar destinos",
    icon: "⌖",
  },
  {
    title: "Ranking y comunidad",
    text: "Progresion, habilitaciones y actividad mensual en un solo perfil.",
    href: "/profile",
    link: "Ver perfil piloto",
    icon: "▦",
  },
  {
    title: "Descarga ACARS",
    text: `Versión actual ${ACARS_VERSION}, preparada para MSFS 2020/2024.`,
    href: "#descargas",
    link: "Descargar cliente",
    icon: "⇩",
  },
  {
    title: "Estado de servicios",
    text: "Integraciones y operación web listas para apertura controlada.",
    href: "#integraciones",
    link: "Ver integraciones",
    icon: "◷",
  },
];

const partnerLogos = [
  { src: "/partners/navigraph-official-horizontal.png", alt: "Navigraph" },
  { src: "/partners/simbrief-by-navigraph-official.png", alt: "SimBrief by Navigraph" },
  { src: "/partners/sayintentions-logo.png", alt: "SayIntentions.AI" },
];

const flagNames: Record<string, string> = {
  AR: "Argentina",
  BO: "Bolivia",
  BR: "Brasil",
  CL: "Chile",
  PE: "Perú",
  UY: "Uruguay",
};

function Badge({ tone, children }: { tone: string; children: ReactNode }) {
  return <span className={`pw-badge pw-badge-${tone}`}>{children}</span>;
}

function CountryFlagRow({ flags }: { flags: string[] }) {
  return (
    <div className="pw-flag-row">
      {flags.map((flag) => (
        <span key={flag} title={flagNames[flag] ?? flag} className="pw-country-flag">
          {flag}
        </span>
      ))}
    </div>
  );
}

export default async function HomePage() {
  let initialHomeStats = FALLBACK_HOME_STATS;

  try {
    initialHomeStats = await loadHomeStatsFromSupabase(createSupabaseServerClient());
  } catch {
    initialHomeStats = FALLBACK_HOME_STATS;
  }

  return (
    <main className="pw-sky-home">
      <section id="inicio" className="pw-hero">
        <PublicHeader />
        <div className="pw-container pw-hero-inner">
          <div className="pw-hero-copy">
            <Badge tone="info">Apertura próximamente</Badge>
            <p className="pw-eyebrow">Patagonia Wings</p>
            <h1>Tu conexión aérea en la Patagonia</h1>
            <p className="pw-hero-subtitle">
              Únete a nuestra red virtual y disfruta de vuelos realistas, operaciones profesionales y
              una comunidad preparada para volar.
            </p>
            <div className="pw-hero-actions">
              <Link href="/register" className="pw-btn-primary">
                Crear cuenta gratis
              </Link>
              <Link href="/routes" className="pw-btn-secondary">
                Ver rutas
              </Link>
              <a href="#descargas" className="pw-btn-ghost">
                Descargar ACARS
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="pw-stats-section">
        <div className="pw-container">
          <HomeStatsBar initialStats={initialHomeStats} />
        </div>
      </section>

      <section id="vuela" className="pw-section">
        <div className="pw-section-title">
          <p>Vuela con nosotros</p>
          <h2>Tu operación en cuatro simples pasos</h2>
        </div>
        <div className="pw-container pw-flow-grid">
          {operationSteps.map((step, index) => (
            <article key={step.title} className="pw-card pw-step-card">
              <div className="pw-icon-bubble">{step.icon}</div>
              <span className="pw-step-number">{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="integraciones" className="pw-section pw-section-compact">
        <div className="pw-section-title">
          <p>Herramientas e integraciones</p>
          <h2>Ecosistema operativo listo para despacho</h2>
        </div>
        <div className="pw-container pw-integration-grid">
          {integrations.map((item) => (
            <article key={item.title} className={`pw-card pw-integration-card ${item.featured ? "is-featured" : ""}`}>
              {item.image ? (
                <img src={item.image} alt={item.title} className="pw-integration-logo" />
              ) : (
                <div className="pw-icon-bubble">{item.icon}</div>
              )}
              {item.flags ? <CountryFlagRow flags={item.flags} /> : null}
              <div>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </div>
              <Badge tone={item.badgeTone}>{item.badge}</Badge>
            </article>
          ))}
        </div>
      </section>

      <section id="servicios" className="pw-section pw-page-band">
        <div className="pw-container pw-feature-grid">
          {lowerCards.map((card) => (
            <article key={card.title} className="pw-card pw-feature-card">
              <div className="pw-icon-bubble">{card.icon}</div>
              <div>
                <h3>{card.title}</h3>
                <p>{card.text}</p>
                <Link href={card.href}>{card.link} →</Link>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section id="flota" className="pw-section">
        <div className="pw-container pw-showcase">
          <div>
            <p className="pw-eyebrow">Flota Patagonia Wings</p>
            <h2>Una identidad propia para volar la red austral</h2>
            <p>
              Flota, rutas, habilitaciones y disponibilidad se conectan para que cada vuelo tenga
              contexto operacional antes de llegar al ACARS.
            </p>
            <div className="pw-showcase-actions">
              <Link href="/routes" className="pw-btn-primary">Explorar rutas</Link>
              <Link href="/dashboard?tab=dispatch" className="pw-btn-secondary">Abrir despacho</Link>
            </div>
          </div>
          <div className="pw-showcase-media">
            <img src="/branding/hero-banner.png" alt="Aeronave Patagonia Wings sobre la Patagonia" />
          </div>
        </div>
      </section>

      <section id="descargas" className="pw-section pw-page-band">
        <div className="pw-container pw-download-panel">
          <div>
            <Badge tone="success">Instalador oficial</Badge>
            <h2>ACARS Patagonia Wings</h2>
            <p>
              Cliente oficial para MSFS 2020/2024 con telemetría, seguimiento de vuelo, PIREP y
              sincronización operacional.
            </p>
            <div className="pw-download-actions">
              <a href={ACARS_DOWNLOAD_URL} className="pw-btn-primary">
                Descargar ACARS v{ACARS_VERSION}
              </a>
              <span>{ACARS_BACKEND}</span>
            </div>
          </div>
          <div className="pw-card">
            <h3>Changelog corto</h3>
            <ul className="pw-check-list">
              {ACARS_RELEASE_NOTES.slice(0, 4).map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
            <div className="pw-requirements">
              <span>Windows 10/11</span>
              <span>MSFS 2020/2024</span>
              <span>.NET Framework 4.8.1</span>
            </div>
          </div>
        </div>
      </section>

      <section id="aliados" className="pw-allies">
        <div className="pw-container">
          <p className="pw-eyebrow">Nuestros aliados</p>
          <div className="pw-allies-row">
            {partnerLogos.map((logo) => (
              <img key={logo.alt} src={logo.src} alt={logo.alt} />
            ))}
          </div>
        </div>
      </section>

      <section id="nosotros" className="pw-section">
        <div className="pw-container pw-about">
          <div>
            <p className="pw-eyebrow">Acerca de</p>
            <h2>Patagonia Wings nace para operar con realismo, claridad y comunidad</h2>
            <p>
              Una aerolinea virtual enfocada en rutas regionales y sudamericanas, con despacho,
              progresion, economia mensual y herramientas integradas para pilotos que quieren volar mejor.
            </p>
          </div>
          <div className="pw-card">
            <h3>Estado de apertura</h3>
            <p>
              La plataforma esta preparada para una apertura controlada: pilotos, ACARS, despacho,
              rutas, integraciones y datos operacionales en una experiencia unificada.
            </p>
            <Badge tone="warning">En validacion</Badge>
          </div>
        </div>
      </section>

      <section id="faq" className="pw-section pw-section-compact">
        <div className="pw-container pw-faq-grid">
          {[
            ["Necesito Navigraph?", "Para el flujo OFP integrado se recomienda una cuenta activa de Navigraph/SimBrief."],
            ["ACARS se descarga desde aqui?", "Si. La seccion de descargas mantiene el instalador oficial visible."],
            ["Puedo ver rutas antes de registrarme?", "Si. El catalogo publico de rutas queda disponible para explorar la red."],
          ].map(([question, answer]) => (
            <details key={question} className="pw-card pw-accordion">
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
