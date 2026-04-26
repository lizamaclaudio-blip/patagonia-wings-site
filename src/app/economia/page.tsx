"use client";

import Link from "next/link";
import PublicHeader from "@/components/site/PublicHeader";

type Section = {
  id: string;
  icon: string;
  title: string;
  color: string;
  items: { heading: string; text: string }[];
};

const SECTIONS: Section[] = [
  {
    id: "billetera",
    icon: "💰",
    title: "Billetera del piloto",
    color: "from-emerald-400/10 to-transparent",
    items: [
      {
        heading: "Saldo inicial",
        text: "Todo piloto registrado en Patagonia Wings recibe automáticamente $1,000 USD en su billetera virtual al momento de crear su cuenta.",
      },
      {
        heading: "Cómo aumenta",
        text: "El saldo crece con cada vuelo completado (comisión por vuelo) y con el sueldo base mensual cuando se cumplen los 5 vuelos requeridos.",
      },
      {
        heading: "Cómo disminuye",
        text: "Se descuenta el costo de traslados entre aeropuertos y el 10% del costo estimado de reparación cuando hay daño grave a la aeronave.",
      },
      {
        heading: "Visibilidad",
        text: "Tu saldo actual siempre aparece en el panel de traslados del dashboard. No es dinero real — es parte de la simulación de aerolínea virtual.",
      },
    ],
  },
  {
    id: "comisiones",
    icon: "✈️",
    title: "Comisión por vuelo",
    color: "from-cyan-400/10 to-transparent",
    items: [
      {
        heading: "Fórmula base",
        text: "Comisión = (Horas de bloque × $30 + Distancia en NM × $0.06) × Multiplicador aeronave × Multiplicador modo",
      },
      {
        heading: "Multiplicadores por tipo de aeronave",
        text: "Widebody (B777, B787, A350, A380…): ×2.2 · Narrowbody (B737, A320, B757…): ×1.6 · Regional (CRJ, E170, DHC-8…): ×1.3 · Aviación general / turbohélice: ×0.8",
      },
      {
        heading: "Multiplicadores por modo de vuelo",
        text: "ITINERARIO (CAREER): ×1.5 — el modo mejor pagado, porque requiere cumplir horarios y rutas fijas · CHARTER: ×1.2 · EVENT: ×0.8 · TRAINING: ×0.5",
      },
      {
        heading: "Rango permitido",
        text: "Mínimo $15 USD — Máximo $500 USD por vuelo, independiente del resultado del cálculo.",
      },
      {
        heading: "Ejemplo práctico",
        text: "Vuelo Santiago → Madrid en A330 (narrowbody): 5,760 NM · 13h de bloque → Base = (13×30 + 5760×0.06) = $735 → ×1.6 = $1,176 → tope $500. Comisión final: $500 USD.",
      },
      {
        heading: "Cuándo se acredita",
        text: "La comisión se acredita inmediatamente en tu billetera al cerrar el vuelo con estado 'completado' en el ACARS.",
      },
    ],
  },
  {
    id: "sueldo",
    icon: "📅",
    title: "Sueldo base mensual",
    color: "from-violet-400/10 to-transparent",
    items: [
      {
        heading: "Condición para recibirlo",
        text: "Debes completar al menos 5 vuelos en el mes calendario (1° al último día del mes). Si no llegas a 5, igual recibes las comisiones individuales de los vuelos que hayas hecho — solo no recibes el bono base.",
      },
      {
        heading: "Monto del sueldo base",
        text: "$1,500 USD fijos por mes si cumples los 5 vuelos. Este monto se suma a tus comisiones del mes para calcular el total neto.",
      },
      {
        heading: "Fecha de pago",
        text: "El pago se procesa el último día hábil (lunes a viernes) de cada mes. Ejemplo: si el último día del mes cae sábado, el pago se realiza el viernes anterior.",
      },
      {
        heading: "Fórmula del total mensual",
        text: "Total neto = Comisiones del mes + Sueldo base ($1,500 si ≥5 vuelos) − Deducciones por daños del mes",
      },
      {
        heading: "Historial",
        text: "Cada período queda registrado en tu historial de nómina con estado 'pagado', 'pendiente' o 'sin actividad'. Puedes verlo en el widget de economía del dashboard.",
      },
    ],
  },
  {
    id: "danos",
    icon: "🔧",
    title: "Deducciones por daño a aeronave",
    color: "from-red-400/10 to-transparent",
    items: [
      {
        heading: "Cuándo aplica",
        text: "Solo se descuenta si durante el vuelo ocurre al menos un evento de daño con severidad 'heavy' (grave) o 'critical' (crítico). Daños leves o medios no generan deducción.",
      },
      {
        heading: "Monto de la deducción",
        text: "Se descuenta el 10% del costo base estimado de reparación según el tipo de aeronave. No se cobra el 100% — es una penalización parcial.",
      },
      {
        heading: "Costos de reparación base por categoría",
        text: "Aviación general / turbohélice: $800 USD → descuento $80 · Regional jet: $2,000 USD → descuento $200 · Narrowbody: $5,000 USD → descuento $500 · Widebody: $12,000 USD → descuento $1,200",
      },
      {
        heading: "Cómo evitarla",
        text: "Aterriza con VS suave, mantén G-force dentro de rangos normales, no toques pista a alta velocidad ni actives reversas de forma abrupta. El sistema ACARS detecta estos eventos en tiempo real.",
      },
      {
        heading: "Efecto en el pago",
        text: "La deducción se aplica en el momento del cierre del vuelo, reduciendo tu comisión neta de ese vuelo. El total mensual también refleja la suma de todas las deducciones del período.",
      },
    ],
  },
  {
    id: "traslados",
    icon: "🗺️",
    title: "Traslados entre aeropuertos",
    color: "from-amber-400/10 to-transparent",
    items: [
      {
        heading: "Para qué sirven",
        text: "Si tu aeronave está en un aeropuerto donde no hay rutas disponibles o quieres reposicionarte, puedes trasladarte a otro aeropuerto pagando el costo del traslado.",
      },
      {
        heading: "Tipos de traslado",
        text: "Terrestre (hasta 250 km): $10–$180 USD según distancia · Vuelo doméstico/regional (80–2,500 km): precio según distancia real · Vuelo internacional: precio fijo según destino continental ($160–$1,150 USD)",
      },
      {
        heading: "Multa por abandono operacional",
        text: "Si tu aeronave quedó en un aeropuerto que NO es un hub designado de Patagonia Wings, se suma una multa de $350 USD al costo del traslado. Esta multa refleja el costo operacional de reubicar recursos fuera de la red. Si el avión quedó en un hub (SCL, EZE, GRU, MIA, JFK, MAD, LHR, CDG, DXB, SIN…), el traslado solo cobra el precio real — sin multa.",
      },
      {
        heading: "Cómo evitar la multa",
        text: "Siempre que sea posible, termina tus vuelos en un aeropuerto hub. Si por operaciones charter o de entrenamiento debes terminar en un aeropuerto menor, el sistema lo indica al mostrar cada opción de traslado con su desglose de costo.",
      },
      {
        heading: "Sin tiempo de espera",
        text: "El traslado es instantáneo — se actualiza tu aeropuerto actual de inmediato. Solo tiene costo económico, no de tiempo.",
      },
      {
        heading: "Opciones disponibles",
        text: "El sistema te muestra automáticamente los 3 aeropuertos más cercanos en terrestre, los 3 más relevantes para vuelo regional, y un hub internacional por continente (Norteamérica, Europa, Asia, etc.).",
      },
    ],
  },
];

function SectionCard({ section }: { section: Section }) {
  return (
    <div className={`rounded-[24px] border border-white/10 bg-gradient-to-br ${section.color} bg-white/[0.03] p-6 shadow-[0_12px_40px_rgba(0,0,0,0.24)] backdrop-blur-xl`}>
      <div className="flex items-center gap-3">
        <span className="text-3xl">{section.icon}</span>
        <h2 className="text-xl font-black text-white">{section.title}</h2>
      </div>
      <div className="mt-5 space-y-4">
        {section.items.map((item, i) => (
          <div key={i} className="flex gap-3">
            <div className="mt-1 h-5 w-5 shrink-0 rounded-full border border-white/15 bg-white/[0.06] flex items-center justify-center">
              <span className="text-[9px] font-black text-white/50">{i + 1}</span>
            </div>
            <div>
              <p className="text-sm font-bold text-white/90">{item.heading}</p>
              <p className="mt-1 text-sm leading-6 text-white/60">{item.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CommissionTable() {
  const rows = [
    { ruta: "SCBA → SCTE (Regional)", nm: 140, block: 45, tipo: "DHC-8 (Regional ×1.3)", modo: "CAREER ×1.0", comision: "$43.68" },
    { ruta: "SCEL → SAEZ (Nacional)", nm: 960, block: 135, tipo: "A320 (Narrowbody ×1.6)", modo: "CAREER ×1.0", comision: "$165.12" },
    { ruta: "SCEL → SPJC (Internacional)", nm: 2340, block: 290, tipo: "A320 (Narrowbody ×1.6)", modo: "CHARTER ×1.3", comision: "$500.00" },
    { ruta: "SCEL → EGLL (Long haul)", nm: 7200, block: 780, tipo: "B787 (Widebody ×2.2)", modo: "CAREER ×1.0", comision: "$500.00" },
    { ruta: "SCPQ → SCTE (Local)", nm: 65, block: 25, tipo: "C208 (GA ×0.8)", modo: "TRAINING ×0.5", comision: "$15.00" },
  ];

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/8">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/8 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/36">
            <th className="px-4 py-3 text-left">Ruta ejemplo</th>
            <th className="px-4 py-3 text-right">NM</th>
            <th className="px-4 py-3 text-right">Block</th>
            <th className="px-4 py-3 text-left">Aeronave · Modo</th>
            <th className="px-4 py-3 text-right">Comisión</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={`border-b border-white/6 ${i % 2 === 0 ? "bg-white/[0.015]" : ""}`}>
              <td className="px-4 py-3 font-medium text-white/80">{r.ruta}</td>
              <td className="px-4 py-3 text-right text-white/60">{r.nm.toLocaleString("es-CL")}</td>
              <td className="px-4 py-3 text-right text-white/60">{r.block} min</td>
              <td className="px-4 py-3 text-white/60">{r.tipo} · {r.modo}</td>
              <td className="px-4 py-3 text-right font-black text-emerald-300">{r.comision}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function EconomiaPage() {
  return (
    <div className="min-h-screen bg-[#030e1a]">
      <PublicHeader />

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-10 sm:px-6">
        {/* Header */}
        <div className="mb-10">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/60 transition hover:border-white/20 hover:text-white/90"
          >
            ← Volver al dashboard
          </Link>

          <div className="mt-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-400/70">
              Patagonia Wings
            </p>
            <h1 className="mt-2 text-4xl font-black text-white">Sistema económico</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-white/60">
              Cómo se calculan tus ingresos, comisiones, sueldo mensual y deducciones dentro de la simulación de aerolínea virtual.
            </p>
          </div>

          {/* Quick summary pills */}
          <div className="mt-6 flex flex-wrap gap-2">
            {[
              { label: "$1,000 USD de inicio", color: "border-emerald-400/20 bg-emerald-400/8 text-emerald-300" },
              { label: "Comisión por cada vuelo completado", color: "border-cyan-400/20 bg-cyan-400/8 text-cyan-300" },
              { label: "$1,500 USD sueldo base con 5+ vuelos/mes", color: "border-violet-400/20 bg-violet-400/8 text-violet-300" },
              { label: "Pago el último día hábil del mes", color: "border-amber-400/20 bg-amber-400/8 text-amber-300" },
              { label: "−10% por daño grave a la aeronave", color: "border-red-400/20 bg-red-400/8 text-red-300" },
            ].map((pill) => (
              <span
                key={pill.label}
                className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${pill.color}`}
              >
                {pill.label}
              </span>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {SECTIONS.map((s) => (
            <SectionCard key={s.id} section={s} />
          ))}
        </div>

        {/* Commission examples table */}
        <div className="mt-8">
          <div className="mb-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/50">Referencia rápida</p>
            <h2 className="mt-1 text-xl font-bold text-white">Ejemplos de comisión por ruta</h2>
            <p className="mt-1 text-sm text-white/48">Los valores al tope $500 aplican cuando la fórmula supera ese máximo.</p>
          </div>
          <CommissionTable />
        </div>

        {/* Monthly timeline */}
        <div className="mt-8 rounded-[24px] border border-white/10 bg-white/[0.03] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/50">Ciclo mensual</p>
          <h2 className="mt-1 text-xl font-bold text-white">¿Qué pasa cada mes?</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { day: "Día 1", title: "Inicio del período", desc: "Comienza el conteo de vuelos y acumulación de comisiones para el nuevo mes." },
              { day: "Días 1–28/30/31", title: "Vuelas y acumulas", desc: "Cada vuelo completado en ACARS acredita la comisión al instante en tu billetera." },
              { day: "Día 28–31", title: "Cierre del período", desc: "Se verifica si completaste 5 vuelos. Si sí, se suma el sueldo base de $1,500 USD." },
              { day: "Último día hábil", title: "Liquidación", desc: "Se procesa el pago total (comisiones + base − deducciones) y queda registrado en tu historial." },
            ].map((step, i) => (
              <div key={i} className="relative pl-4">
                <div className="absolute left-0 top-1 h-full w-px bg-white/8" />
                <div className="absolute left-[-4px] top-1 h-2 w-2 rounded-full bg-emerald-400" />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-400/70">{step.day}</p>
                <p className="mt-1 text-sm font-bold text-white">{step.title}</p>
                <p className="mt-1 text-xs leading-5 text-white/52">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="rounded-2xl border border-white/12 bg-white/[0.05] px-6 py-3 text-sm font-semibold text-white transition hover:border-white/24 hover:bg-white/[0.08]"
          >
            Ir al dashboard
          </Link>
          <Link
            href="/routes"
            className="rounded-2xl border border-emerald-400/24 bg-emerald-400/10 px-6 py-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/16"
          >
            Ver rutas y comisiones estimadas
          </Link>
        </div>
      </main>
    </div>
  );
}
