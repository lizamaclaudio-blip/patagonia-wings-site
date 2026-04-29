"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PublicHeader from "@/components/site/PublicHeader";
import { supabase } from "@/lib/supabase/browser";


const DEFAULT_OWNER_CALLSIGNS = ["PWG001"];

function parseOwnerList(value: string | undefined, fallback: string[]) {
  const parsed = (value ?? "")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
}

function isOwnerIdentity(callsign?: string | null, email?: string | null) {
  const ownerCallsigns = parseOwnerList(process.env.NEXT_PUBLIC_PWG_OWNER_CALLSIGNS, DEFAULT_OWNER_CALLSIGNS);
  const ownerEmails = parseOwnerList(process.env.NEXT_PUBLIC_PWG_OWNER_EMAILS, []);
  const normalizedCallsign = (callsign ?? "").trim().toUpperCase();
  const normalizedEmail = (email ?? "").trim().toUpperCase();
  return Boolean(
    (normalizedCallsign && ownerCallsigns.includes(normalizedCallsign)) ||
    (normalizedEmail && ownerEmails.includes(normalizedEmail))
  );
}

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
      { heading: "Saldo inicial", text: "Todo piloto recibe una billetera virtual operacional. El saldo sirve para traslados, licencias, pruebas teóricas, checkrides y habilitaciones." },
      { heading: "Cómo aumenta", text: "Aumenta con el pago por vuelos completados, nómina mensual y bonos operativos cuando correspondan." },
      { heading: "Cómo disminuye", text: "Disminuye por gastos personales del piloto: traslados, licencias, pruebas, habilitaciones, entrenamientos recurrentes y deducciones por daño si aplica." },
      { heading: "Trazabilidad", text: "Cada gasto queda registrado en pilot_expense_ledger y cada ingreso se acumula en pilot_salary_ledger para liquidaciones mensuales." },
    ],
  },
  {
    id: "modelo-realista",
    icon: "📊",
    title: "Economía operacional realista",
    color: "from-sky-400/10 to-transparent",
    items: [
      { heading: "Estimación previa", text: "Antes del vuelo, el sistema estima pasajeros, carga, combustible, tasas, handling, servicio a bordo, pago piloto y utilidad usando la ruta y la aeronave compatible seleccionada." },
      { heading: "Planificación OFP", text: "Cuando hay OFP SimBrief, pasajeros, carga, payload, combustible y block time planificados reemplazan la estimación genérica." },
      { heading: "Cierre real", text: "Al cerrar con ACARS/PIREP, la web recalcula economía oficial con datos reales disponibles: fuel usado, block real, daño, ventas a bordo y desempeño operacional." },
      { heading: "Registro global", text: "Los movimientos quedan en airline_ledger y flight_economy_snapshots para métricas mensuales/anuales: pax, carga, combustible, ingresos, costos, utilidad, rutas y aeronaves." },
    ],
  },
  {
    id: "comisiones",
    icon: "✈️",
    title: "Pago piloto por vuelo",
    color: "from-cyan-400/10 to-transparent",
    items: [
      { heading: "Fórmula vigente", text: "Pago piloto = base por banda de ruta + horas bloque × tarifa horaria + distancia × tarifa NM. Luego se ajusta por responsabilidad de aeronave y tipo de operación." },
      { heading: "Bandas de ruta", text: "Local, regional, nacional, internacional, long haul e intercontinental tienen mínimos, máximos y tarifas distintas. Así un regional corto no paga más que un nacional equivalente." },
      { heading: "Responsabilidad por aeronave", text: "GA/avioneta paga menos; regional queda en nivel medio; narrowbody aumenta por responsabilidad; widebody y long haul pagan más por complejidad." },
      { heading: "Tipo de operación", text: "Itinerario/Career usa base normal, Charter paga más, Training paga bajo y eventos/tours usan multiplicadores propios. El tope de long haul es mayor que el de vuelos regionales." },
      { heading: "Costo para aerolínea", text: "El pago piloto es costo operacional para Patagonia Wings y se registra en salary ledger, snapshots y ledger de aerolínea al cierre del vuelo." },
    ],
  },
  {
    id: "combustible",
    icon: "⛽",
    title: "Combustible por ruta y aeropuerto",
    color: "from-amber-400/10 to-transparent",
    items: [
      { heading: "No es estanque lleno", text: "El costo mostrado para una ruta se calcula por combustible estimado de la ruta, no por llenar el avión completo." },
      { heading: "Qué incluye", text: "Trip fuel estimado, taxi fuel, contingencia y reserva operacional según distancia y aeronave." },
      { heading: "Precio local", text: "El precio JetA1 se toma del aeropuerto de origen; si no existe, usa ciudad, país o fallback regional." },
      { heading: "Validación de autonomía", text: "La capacidad de combustible se usa para validar si una aeronave puede operar la ruta, no para cobrar siempre el estanque lleno." },
    ],
  },
  {
    id: "aeronaves",
    icon: "🛫",
    title: "Aeronaves compatibles y crecimiento",
    color: "from-teal-400/10 to-transparent",
    items: [
      { heading: "Filtro maestro", text: "Las rutas e itinerarios usan filtro piloto → ubicación → ruta → aeronave disponible → autonomía → habilitación → economía." },
      { heading: "Rango real", text: "Una aeronave solo aparece si su alcance práctico y combustible utilizable alcanzan para la ruta. Long haul/intercontinental no debe mostrar C172, BE58, B350 o ATR72." },
      { heading: "Compra de flota", text: "La compra real de aeronaves solo la realiza la dirección/owner. Los pilotos ven la explicación y valores, pero no el formulario de compra." },
      { heading: "Entrega desde fábrica", text: "Cada compra descuenta caja, registra ledger, crea solicitud de compra y entrega la aeronave al hub asignado." },
    ],
  },
  {
    id: "sueldo",
    icon: "📅",
    title: "Liquidación mensual del piloto",
    color: "from-violet-400/10 to-transparent",
    items: [
      { heading: "Qué acumula", text: "Vuelos, horas, comisiones, sueldo base si corresponde, bonos, descuentos y gastos del piloto." },
      { heading: "Cuándo se paga", text: "La nómina mensual se acumula por período y queda con estado pendiente/pagado según el flujo administrativo." },
      { heading: "Dónde se ve", text: "El piloto revisa su economía y liquidación desde Mi economía en Oficina/Profile." },
      { heading: "PDF", text: "La liquidación puede imprimirse/guardarse como PDF desde la vista del piloto. La generación binaria directa queda como mejora posterior si se requiere." },
    ],
  },
  {
    id: "danos",
    icon: "🔧",
    title: "Daño, desgaste y reparación",
    color: "from-red-400/10 to-transparent",
    items: [
      { heading: "Desgaste por vuelo", text: "Cada vuelo reduce la condición de la aeronave según operación, tiempo, aterrizaje, incidentes y daño reportado." },
      { heading: "Costo para aerolínea", text: "Mantenimiento, reserva técnica y reparación se registran como costos operacionales en airline_ledger y snapshots." },
      { heading: "Deducción al piloto", text: "Solo daños graves o críticos pueden generar deducción al piloto; el costo principal lo asume la aerolínea como operación." },
      { heading: "Métricas", text: "El historial permitirá detectar aeronaves más costosas, rutas con más desgaste y hubs con mayor carga técnica." },
    ],
  },
  {
    id: "traslados",
    icon: "🗺️",
    title: "Traslados entre aeropuertos",
    color: "from-amber-400/10 to-transparent",
    items: [
      { heading: "Para qué sirven", text: "Permiten mover al piloto cuando no está donde necesita operar. No mueven la aeronave automáticamente." },
      { heading: "Regla hub/no-hub", text: "Si la aeronave queda en hub, no hay multa por abandono. Si queda en aeropuerto no-hub, se aplica costo operacional de recuperación." },
      { heading: "Costo piloto", text: "Traslados terrestres, domésticos e internacionales tienen costos distintos y se descuentan desde la billetera." },
      { heading: "Visibilidad", text: "El módulo de traslados se oculta si no hay alternativas reales para evitar parpadeos o cajas vacías." },
    ],
  },
  {
    id: "gastos-piloto",
    icon: "🎓",
    title: "Licencias, habilitaciones y pruebas",
    color: "from-cyan-400/10 to-transparent",
    items: [
      { heading: "Pruebas teóricas", text: "IFR/IMC, regional, narrowbody, widebody y recurrente tienen costo propio y se pagan desde billetera." },
      { heading: "Pruebas prácticas", text: "Los checkrides liberan operación por categoría de aeronave. Su costo depende de la complejidad operacional." },
      { heading: "Habilitaciones", text: "Las habilitaciones de tipo permiten acceder a aeronaves y rutas de mayor ingreso, pero son una inversión del piloto." },
      { heading: "Trazabilidad", text: "Cada gasto queda registrado para métricas por piloto, mes, categoría y progresión operacional." },
    ],
  },
  {
    id: "costos-fijos",
    icon: "🏢",
    title: "Costos fijos de aerolínea",
    color: "from-slate-400/10 to-transparent",
    items: [
      { heading: "Operación mensual", text: "La aerolínea debe cubrir staff, sistemas, hubs, seguros, hangares, flota y mantenimiento programado." },
      { heading: "Caja operacional", text: "El capital inicial aprobado sirve para operar mientras los vuelos generan ingresos reales y crecimiento de flota." },
      { heading: "Ledger", text: "Los costos mensuales deben registrarse como movimientos separados para reconstruir el balance desde airline_ledger." },
      { heading: "Métricas futuras", text: "La página Economía mostrará utilidad mensual/anual, costo por hub, costo por aeronave, rutas rentables y rutas con pérdida." },
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
    { ruta: "SCTB → SCPF (Local)", nm: 8, block: 27, banda: "Local", avion: "C208 / B350", pago: "$25–45", nota: "mínimo operacional" },
    { ruta: "SACO → SAZN (Regional)", nm: 498, block: 164, banda: "Regional", avion: "ATR72 / E190", pago: "$90–180", nota: "según aeronave" },
    { ruta: "SCEL → SCTE (Nacional)", nm: 495, block: 115, banda: "Nacional", avion: "A320 / B738", pago: "$120–260", nota: "rango medio" },
    { ruta: "SCEL → SPJC (Internacional)", nm: 1_330, block: 225, banda: "Internacional", avion: "A320 / B738", pago: "$250–450", nota: "más responsabilidad" },
    { ruta: "SCEL → KMIA (Long haul)", nm: 3_600, block: 520, banda: "Long haul", avion: "B789 / A339", pago: "$700–1.300", nota: "sin tope regional" },
    { ruta: "LFPG → SAEZ (Intercontinental)", nm: 5_994, block: 804, banda: "Intercontinental", avion: "A339 / B789 / B77W", pago: "$1.100–1.800", nota: "solo widebody apto" },
  ];

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/8">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/8 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/36">
            <th className="px-4 py-3 text-left">Ruta ejemplo</th>
            <th className="px-4 py-3 text-right">NM</th>
            <th className="px-4 py-3 text-right">Block</th>
            <th className="px-4 py-3 text-left">Banda</th>
            <th className="px-4 py-3 text-left">Aeronave apta</th>
            <th className="px-4 py-3 text-right">Pago piloto</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={`border-b border-white/6 ${i % 2 === 0 ? "bg-white/[0.015]" : ""}`}>
              <td className="px-4 py-3 font-medium text-white/80">{r.ruta}<p className="mt-1 text-[10px] text-white/35">{r.nota}</p></td>
              <td className="px-4 py-3 text-right text-white/60">{r.nm.toLocaleString("es-CL")}</td>
              <td className="px-4 py-3 text-right text-white/60">{r.block} min</td>
              <td className="px-4 py-3 text-white/60">{r.banda}</td>
              <td className="px-4 py-3 text-white/60">{r.avion}</td>
              <td className="px-4 py-3 text-right font-black text-emerald-300">{r.pago} USD</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
// ─── SVG Mini Line Chart ──────────────────────────────────────────────────────

type ChartSeries = { label: string; color: string; values: number[] };

function MiniLineChart({ series, labels }: { series: ChartSeries[]; labels: string[] }) {
  const W = 560;
  const H = 120;
  const PAD_L = 8;
  const PAD_R = 8;
  const PAD_T = 12;
  const PAD_B = 8;

  const allValues = series.flatMap((s) => s.values);
  const minVal = Math.min(0, ...allValues);
  const maxVal = Math.max(...allValues, 1);
  const range = maxVal - minVal || 1;

  const n = labels.length;
  const xStep = n <= 1 ? 0 : (W - PAD_L - PAD_R) / (n - 1);

  function toX(i: number) { return PAD_L + i * xStep; }
  function toY(v: number) { return PAD_T + (1 - (v - minVal) / range) * (H - PAD_T - PAD_B); }

  function buildPath(values: number[]) {
    return values.map((v, i) => `${i === 0 ? "M" : "L"} ${toX(i).toFixed(1)} ${toY(v).toFixed(1)}`).join(" ");
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height: 120 }}
      aria-hidden="true"
    >
      {/* Zero line */}
      {minVal < 0 && (
        <line
          x1={PAD_L} y1={toY(0).toFixed(1)}
          x2={W - PAD_R} y2={toY(0).toFixed(1)}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
      )}
      {/* Series lines */}
      {series.map((s) => (
        <g key={s.label}>
          <path
            d={buildPath(s.values)}
            fill="none"
            stroke={s.color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {/* Dots */}
          {s.values.map((v, i) => (
            <circle key={i} cx={toX(i).toFixed(1)} cy={toY(v).toFixed(1)} r="3" fill={s.color} />
          ))}
        </g>
      ))}
      {/* X labels */}
      {labels.map((label, i) => (
        <text
          key={i}
          x={toX(i).toFixed(1)}
          y={H - 1}
          textAnchor="middle"
          fontSize="9"
          fill="rgba(255,255,255,0.35)"
          fontFamily="system-ui, sans-serif"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

// ─── Airline Finance Panel ────────────────────────────────────────────────────

type EconomiaStats = {
  airline: { name: string; balance_usd: number; total_revenue_usd: number; total_costs_usd: number; net_profit_usd: number };
  breakdown: { income_flights: number; income_passengers?: number; income_cargo?: number; income_charter?: number; cost_fuel: number; cost_maintenance: number; cost_pilot_payments: number; cost_repairs: number; cost_airport_fees?: number; cost_handling?: number; cost_salaries: number };
  payroll: Array<{ year: number; month: number; flights: number; commission: number; base_salary: number; net: number; callsigns: string[] }>;
  recentLedger: Array<{ entry_type: string; amount_usd: number; pilot_callsign?: string; description?: string; created_at: string }>;
  topPilots: Array<{ callsign: string; commission: number }>;
  totalFlightsCompleted: number;
};

const MONTH_NAMES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

function fmt(n: number) { return n.toLocaleString("es-CL", { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function fmtUsd(n: number) { return `$${fmt(Math.abs(n))} USD`; }

function entryTypeLabel(t: string) {
  const map: Record<string, string> = {
    flight_income: "Ingreso vuelo",
    passenger_revenue: "Ingreso pasajeros",
    cargo_revenue: "Ingreso carga",
    charter_revenue: "Ingreso chárter",
    airport_fees: "Tasas aeropuerto",
    handling_cost: "Handling/rampa",
    repair_reserve: "Reserva técnica",
    fuel_cost: "Combustible",
    maintenance_cost: "Mantenimiento",
    pilot_payment: "Pago piloto",
    repair_cost: "Reparación",
    salary_payment: "Nómina",
    initial_capital: "Capital inicial",
  };
  return map[t] ?? t;
}

function entryTypeColor(t: string) {
  if (t === "flight_income" || t === "initial_capital") return "text-emerald-300";
  if (t === "pilot_payment" || t === "salary_payment") return "text-cyan-300";
  if (t === "repair_cost") return "text-rose-300";
  return "text-amber-300";
}

function AirlineFinancePanel() {
  const [stats, setStats] = useState<EconomiaStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/economia/stats")
      .then((r) => r.json())
      .then((data: { ok?: boolean } & Partial<EconomiaStats>) => {
        if (data.ok && data.airline) setStats(data as EconomiaStats);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="mb-10 rounded-[28px] border border-white/10 bg-white/[0.03] p-7 text-sm text-white/40">
      Cargando estadísticas de la aerolínea...
    </div>
  );
  if (!stats) return null;

  const { airline, breakdown, payroll, topPilots, totalFlightsCompleted, recentLedger } = stats;
  const isProfit = airline.net_profit_usd >= 0;

  // Build chart data from payroll (reverse = oldest first)
  const chartPayroll = [...payroll].reverse();
  const chartLabels = chartPayroll.map((r) => `${MONTH_NAMES[r.month - 1]}`);
  const hasChart = chartPayroll.length >= 2;

  const summaryCards = [
    { emoji: "🏦", label: "Balance actual", value: fmtUsd(airline.balance_usd), tone: airline.balance_usd >= 0 ? "text-emerald-300" : "text-rose-300", bg: "from-emerald-500/10" },
    { emoji: "📈", label: "Ingresos totales", value: fmtUsd(airline.total_revenue_usd), tone: "text-sky-300", bg: "from-sky-500/10" },
    { emoji: "📉", label: "Costos totales", value: fmtUsd(airline.total_costs_usd), tone: "text-amber-300", bg: "from-amber-500/10" },
    { emoji: "👥", label: "Pasajeros", value: fmtUsd(breakdown.income_passengers ?? 0), tone: "text-emerald-300", bg: "from-emerald-500/10" },
    { emoji: "📦", label: "Carga", value: fmtUsd(breakdown.income_cargo ?? 0), tone: "text-emerald-300", bg: "from-emerald-500/10" },
    { emoji: isProfit ? "✅" : "⚠️", label: isProfit ? "Utilidad neta" : "Pérdida neta", value: `${isProfit ? "+" : "−"}${fmtUsd(airline.net_profit_usd)}`, tone: isProfit ? "text-emerald-300" : "text-rose-300", bg: isProfit ? "from-emerald-500/10" : "from-rose-500/10" },
  ];

  const breakdownCards = [
    { emoji: "🧾", label: "Tasas", value: fmtUsd(breakdown.cost_airport_fees ?? 0), tone: "text-amber-300" },
    { emoji: "🧳", label: "Handling", value: fmtUsd(breakdown.cost_handling ?? 0), tone: "text-amber-300" },
    { emoji: "✈️", label: "Vuelos completados", value: String(totalFlightsCompleted), tone: "text-white" },
    { emoji: "💵", label: "Ingreso por vuelos", value: fmtUsd(breakdown.income_flights), tone: "text-emerald-300" },
    { emoji: "⛽", label: "Combustible", value: fmtUsd(breakdown.cost_fuel), tone: "text-amber-300" },
    { emoji: "🔩", label: "Mantenimiento", value: fmtUsd(breakdown.cost_maintenance), tone: "text-amber-300" },
    { emoji: "👨‍✈️", label: "Pagos a pilotos", value: fmtUsd(breakdown.cost_pilot_payments), tone: "text-cyan-300" },
    { emoji: "🔧", label: "Reparaciones", value: fmtUsd(breakdown.cost_repairs), tone: "text-rose-300" },
  ];

  return (
    <div className="mb-10 space-y-5">
      {/* Summary cards */}
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 sm:p-7">
        <div className="flex items-center gap-2 mb-5">
          <span className="text-2xl">🏢</span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/40">Aerolínea virtual</p>
            <p className="text-base font-bold text-white">{airline.name}</p>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.label} className={`rounded-[20px] border border-white/8 bg-gradient-to-br ${card.bg} to-transparent px-5 py-5`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{card.emoji}</span>
                <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/40">{card.label}</p>
              </div>
              <p className={`text-xl font-black ${card.tone}`}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Cost breakdown mini-grid */}
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {breakdownCards.map((card) => (
            <div key={card.label} className="flex items-center gap-3 rounded-[14px] border border-white/6 bg-white/[0.02] px-4 py-3">
              <span className="text-base">{card.emoji}</span>
              <span className="flex-1 text-[11px] text-white/54">{card.label}</span>
              <span className={`text-sm font-bold ${card.tone}`}>{card.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly trend chart */}
      {hasChart && (
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40 mb-1">Tendencia mensual</p>
          <h3 className="text-base font-bold text-white mb-4">Ingresos · Costos · Neto por piloto</h3>
          <MiniLineChart
            labels={chartLabels}
            series={[
              { label: "Comisiones", color: "#34d399", values: chartPayroll.map((r) => r.commission) },
              { label: "Base salary", color: "#818cf8", values: chartPayroll.map((r) => r.base_salary) },
              { label: "Neto", color: "#38bdf8", values: chartPayroll.map((r) => r.net) },
            ]}
          />
          <div className="mt-3 flex flex-wrap gap-4">
            {[
              { color: "#34d399", label: "Comisiones pilotos" },
              { color: "#818cf8", label: "Sueldo base" },
              { color: "#38bdf8", label: "Neto total" },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-5 rounded-full" style={{ backgroundColor: l.color }} />
                <span className="text-[11px] text-white/50">{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payroll by month + top pilots */}
      {(payroll.length > 0 || topPilots.length > 0) && (
        <div className="grid gap-5 lg:grid-cols-2">
          {payroll.length > 0 && (
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">📋</span>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">Nómina mensual</p>
              </div>
              <div className="space-y-2">
                {payroll.slice(0, 6).map((row) => (
                  <div key={`${row.year}-${row.month}`} className="flex items-center justify-between rounded-[14px] border border-white/6 bg-black/10 px-4 py-3">
                    <div>
                      <p className="text-xs font-bold text-white">{MONTH_NAMES[row.month - 1]} {row.year}</p>
                      <p className="text-[10px] text-white/44">{row.flights} vuelos · {row.callsigns.length} piloto{row.callsigns.length !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-emerald-300">{fmtUsd(row.net)}</p>
                      <p className="text-[10px] text-white/40">comisión {fmtUsd(row.commission)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {topPilots.length > 0 && (
            <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🏆</span>
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">Top pilotos por comisión</p>
              </div>
              <div className="space-y-2">
                {topPilots.map((p, i) => (
                  <div key={p.callsign} className="flex items-center justify-between rounded-[14px] border border-white/6 bg-black/10 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-black ${i === 0 ? "text-amber-300" : i === 1 ? "text-white/60" : i === 2 ? "text-amber-600" : "text-white/30"}`}>
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                      </span>
                      <span className="text-sm font-bold text-white">{p.callsign}</span>
                    </div>
                    <span className="text-sm font-black text-cyan-300">{fmtUsd(p.commission)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent ledger */}
      {recentLedger.length > 0 && (
        <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xl">🧾</span>
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">Últimas transacciones</p>
          </div>
          <div className="space-y-1.5">
            {recentLedger.map((row, i) => {
              const isIncome = row.amount_usd > 0;
              const dateStr = row.created_at ? new Date(row.created_at).toLocaleDateString("es-CL", { day: "2-digit", month: "short" }) : "";
              return (
                <div key={i} className="flex items-center justify-between rounded-[12px] border border-white/5 bg-white/[0.015] px-4 py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-base shrink-0">{isIncome ? "💚" : "🔴"}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white/80 truncate">{entryTypeLabel(row.entry_type)}</p>
                      {row.pilot_callsign && <p className="text-[10px] text-white/36">{row.pilot_callsign}</p>}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className={`text-sm font-bold ${entryTypeColor(row.entry_type)}`}>
                      {isIncome ? "+" : "−"}{fmtUsd(row.amount_usd)}
                    </p>
                    <p className="text-[10px] text-white/30">{dateStr}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Pilot Expense Plan Panel ────────────────────────────────────────────────

type PilotExpenseApiItem = {
  code: string;
  category: string;
  label: string;
  amountUsd: number;
  description?: string;
  phase?: string;
  requiredFor?: string;
};

type PilotExpenseApiGroup = {
  category: string;
  label: string;
  totalUsd: number;
  items: PilotExpenseApiItem[];
};

type PilotExpenseApiResponse = {
  ok?: boolean;
  source?: string;
  groups?: PilotExpenseApiGroup[];
};

const EXPENSE_CATEGORY_EMOJI: Record<string, string> = {
  transfer: "🚌",
  license: "📄",
  certification: "🎖️",
  type_rating: "✈️",
  theory_exam: "📝",
  practical_check: "🧑‍✈️",
  training: "🎓",
};

function PilotExpensePlanPanel() {
  const [groups, setGroups] = useState<PilotExpenseApiGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/economia/pilot-expenses")
      .then((r) => r.json())
      .then((data: PilotExpenseApiResponse) => {
        if (data.ok && Array.isArray(data.groups)) setGroups(data.groups);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 text-sm text-white/42">
        Cargando plan de gastos del piloto...
      </div>
    );
  }

  if (groups.length === 0) return null;

  const theoryGroup = groups.find((group) => group.category === "theory_exam");
  const grandTotal = groups.reduce((sum, group) => sum + group.totalUsd, 0);

  return (
    <section className="rounded-[28px] border border-cyan-400/14 bg-gradient-to-br from-cyan-400/[0.08] to-white/[0.025] p-6 sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300/70">Plan económico del piloto</p>
          <h2 className="mt-1 text-2xl font-black text-white">🎓 Gastos, licencias y pruebas</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/58">
            La billetera del piloto no solo recibe pagos por vuelos: también financia traslados, licencias, habilitaciones, entrenamientos y pruebas teóricas.
            Estos valores quedan en catálogo para descontarlos después en forma trazable desde la cuenta del piloto.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/36">Catálogo activo</p>
          <p className="text-xl font-black text-emerald-300">{fmtUsd(grandTotal)}</p>
          <p className="text-[10px] text-white/38">suma referencial</p>
        </div>
      </div>

      {theoryGroup && (
        <div className="mt-5 rounded-2xl border border-amber-300/18 bg-amber-300/[0.07] p-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📝</span>
            <div>
              <p className="text-sm font-black text-amber-100">Pruebas teóricas incluidas</p>
              <p className="text-xs leading-5 text-white/56">
                IFR/IMC, regional, narrowbody, widebody y recurrente. Cada examen tiene costo propio antes de liberar la habilitación o certificación correspondiente.
              </p>
            </div>
            <span className="ml-auto text-sm font-black text-amber-200">{fmtUsd(theoryGroup.totalUsd)}</span>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => (
          <div key={group.category} className="rounded-[22px] border border-white/8 bg-black/15 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{EXPENSE_CATEGORY_EMOJI[group.category] ?? "💳"}</span>
                <p className="text-sm font-black text-white">{group.label}</p>
              </div>
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-cyan-200">
                {fmtUsd(group.totalUsd)}
              </span>
            </div>
            <div className="space-y-2">
              {group.items.slice(0, 5).map((item) => (
                <div key={item.code} className="flex items-start justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.018] px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-white/82">{item.label}</p>
                    {(item.requiredFor || item.description) && (
                      <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-white/40">
                        {item.requiredFor ? `Requerido para ${item.requiredFor}. ` : ""}{item.description ?? ""}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs font-black text-emerald-300">{fmtUsd(item.amountUsd)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}


// ─── Fleet Assets Panel ───────────────────────────────────────────────────────

type FleetAssetItem = {
  aircraftType: string;
  count: number;
  totalValueUsd: number;
  monthlyFixedCostUsd: number;
  hourlyMaintenanceUsd: number;
  registrations: string[];
  hubs: string[];
};

type FleetAssetApiResponse = {
  ok?: boolean;
  airline?: {
    name: string;
    balanceUsd: number;
    recommendedReserveUsd: number;
    purchasingPowerUsd: number;
  };
  summary?: {
    aircraftCount: number;
    rawAircraftRows?: number;
    aircraftFleetTableCount?: number;
    aircraftTableCount?: number;
    duplicateAircraftRows?: number;
    typeCount: number;
    aircraftTypesTableCount?: number;
    economyProfileTypeCount?: number;
    assetCatalogTypeCount?: number;
    expectedAircraftTypeCount?: number;
    totalFleetValueUsd: number;
    totalMonthlyFixedCostUsd: number;
    aircraftPurchaseLedgerUsd: number;
    source: string;
    sourceErrors?: string[];
  };
  typeAudit?: {
    expectedTypeCount: number;
    realFleetTypes: string[];
    aircraftTypesCatalog: string[];
    economyProfileTypes: string[];
    assetCatalogTypes: string[];
    missingEconomyProfiles: string[];
    missingAssetValues: string[];
    fleetTypeCounts: Array<{ aircraftType: string; count: number }>;
  };
  fleet?: FleetAssetItem[];
  catalog?: Array<{
    aircraftType: string;
    estimatedPurchasePriceUsd: number;
    estimatedMonthlyFixedCostUsd: number;
    estimatedHourlyMaintenanceUsd: number;
  }>;
  purchaseOptions?: Array<{
    aircraftType: string;
    estimatedPurchasePriceUsd: number;
    estimatedMonthlyFixedCostUsd: number;
    estimatedHourlyMaintenanceUsd: number;
    factory?: string;
    canBuyWithReserve?: boolean;
    canBuyCashOnly?: boolean;
    remainingAfterPurchaseUsd?: number;
    reserveGapUsd?: number;
    suggested?: boolean;
  }>;
};

function FleetAssetsPanel() {
  const [data, setData] = useState<FleetAssetApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/economia/fleet-assets")
      .then((r) => r.json())
      .then((payload: FleetAssetApiResponse) => {
        if (payload.ok) setData(payload);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6 text-sm text-white/42">
        Calculando inversión de flota...
      </div>
    );
  }

  if (!data?.summary) return null;

  const summary = data.summary;
  const airline = data.airline;
  const fleet = data.fleet ?? [];
  const catalog = data.catalog ?? [];
  const visibleRows = fleet.length > 0 ? fleet.slice(0, 6) : catalog.slice(0, 6).map((item) => ({
    aircraftType: item.aircraftType,
    count: 0,
    totalValueUsd: item.estimatedPurchasePriceUsd,
    monthlyFixedCostUsd: item.estimatedMonthlyFixedCostUsd,
    hourlyMaintenanceUsd: item.estimatedHourlyMaintenanceUsd,
    registrations: [],
    hubs: [],
  }));

  const sourceLabel = summary.source === "supabase_exact" ? "Base real Supabase" : "Catálogo base";
  const typeAudit = data.typeAudit;
  const expectedTypes = summary.expectedAircraftTypeCount ?? typeAudit?.expectedTypeCount ?? 33;
  const aircraftTypesTableCount = summary.aircraftTypesTableCount ?? typeAudit?.aircraftTypesCatalog?.length ?? summary.typeCount;
  const typeHealthLabel = aircraftTypesTableCount === expectedTypes ? "Tipos OK" : `Revisar tipos: ${aircraftTypesTableCount}/${expectedTypes}`;

  return (
    <section className="rounded-[28px] border border-emerald-400/14 bg-gradient-to-br from-emerald-400/[0.08] to-white/[0.025] p-6 sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-300/70">Activos de aerolínea</p>
          <h2 className="mt-1 text-2xl font-black text-white">🏦 Flota, inversión y crecimiento</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/58">
            Cada aeronave tiene valor patrimonial, costo fijo mensual y costo técnico por hora. Las nuevas aeronaves deberán comprarse con caja de la aerolínea y serán entregadas al hub asignado desde fábrica.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/36">Fuente</p>
          <p className="text-sm font-black text-emerald-300">{sourceLabel}</p>
          <p className="text-[10px] text-white/38">{typeHealthLabel}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { emoji: "✈️", label: "Aeronaves reales", value: String(summary.aircraftCount || "Catálogo") },
          { emoji: "🧩", label: "Tipos BD", value: `${aircraftTypesTableCount}/${expectedTypes}` },
          { emoji: "🏷️", label: "Valor flota", value: fmtUsd(summary.totalFleetValueUsd) },
          { emoji: "📅", label: "Costo fijo mensual", value: fmtUsd(summary.totalMonthlyFixedCostUsd) },
        ].map((card) => (
          <div key={card.label} className="rounded-[18px] border border-white/8 bg-black/15 px-4 py-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">{card.emoji}</span>
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/36">{card.label}</p>
            </div>
            <p className="mt-2 text-lg font-black text-white">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        {[
          { label: "aircraft_fleet", value: summary.aircraftFleetTableCount ?? 0 },
          { label: "aircraft", value: summary.aircraftTableCount ?? 0 },
          { label: "Duplicados matrícula", value: summary.duplicateAircraftRows ?? 0 },
          { label: "Tipos con economía", value: summary.economyProfileTypeCount ?? 0 },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-white/8 bg-white/[0.018] px-3 py-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/32">{item.label}</p>
            <p className="mt-1 text-lg font-black text-white">{item.value}</p>
          </div>
        ))}
      </div>

      {(typeAudit?.missingEconomyProfiles?.length || typeAudit?.missingAssetValues?.length || summary.sourceErrors?.length) ? (
        <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/[0.055] p-4 text-xs leading-5 text-amber-50/78">
          <p className="font-black text-amber-100">Auditoría de tipos de aeronave</p>
          {typeAudit?.missingEconomyProfiles?.length ? <p className="mt-1">Faltan perfiles económicos: {typeAudit.missingEconomyProfiles.join(", ")}</p> : null}
          {typeAudit?.missingAssetValues?.length ? <p className="mt-1">Faltan valores patrimoniales: {typeAudit.missingAssetValues.join(", ")}</p> : null}
          {summary.sourceErrors?.length ? <p className="mt-1">Avisos lectura Supabase: {summary.sourceErrors.join(" · ")}</p> : null}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-emerald-300/14 bg-emerald-300/[0.04] p-4 text-xs leading-5 text-emerald-50/72">
          Flota leída desde Supabase con paginación completa y deduplicación por matrícula. No se limita a 1000 registros.
        </div>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[22px] border border-white/8 bg-black/15 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-black text-white">Valor por tipo de aeronave</p>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/36">Top valores</span>
          </div>
          <div className="space-y-2">
            {visibleRows.map((item) => (
              <div key={item.aircraftType} className="rounded-xl border border-white/5 bg-white/[0.018] px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-white">{item.aircraftType}</p>
                    <p className="text-[10px] text-white/40">
                      {item.count > 0 ? `${item.count} aeronave${item.count !== 1 ? "s" : ""}` : "valor referencial"}
                      {item.hubs.length > 0 ? ` · Hub ${item.hubs.join(", ")}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-emerald-300">{fmtUsd(item.totalValueUsd)}</p>
                    <p className="text-[10px] text-white/36">mes {fmtUsd(item.monthlyFixedCostUsd)}</p>
                  </div>
                </div>
                {item.registrations.length > 0 && (
                  <p className="mt-2 truncate text-[10px] text-white/32">Matrículas: {item.registrations.join(", ")}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[22px] border border-white/8 bg-black/15 p-4">
          <p className="text-sm font-black text-white">Reglas de crecimiento</p>
          <div className="mt-3 space-y-3 text-xs leading-5 text-white/58">
            <p><span className="font-bold text-emerald-200">Compra:</span> cada aeronave nueva descuenta caja y queda registrada como inversión de flota.</p>
            <p><span className="font-bold text-emerald-200">Entrega:</span> se trae desde fábrica al hub asignado, no aparece mágicamente en cualquier aeropuerto.</p>
            <p><span className="font-bold text-emerald-200">Reserva:</span> mantener 6 meses de costos fijos + reserva técnica antes de compras grandes.</p>
            <p><span className="font-bold text-emerald-200">Métricas:</span> el valor de flota, costos fijos y mantenimiento alimentarán la economía mensual.</p>
          </div>
          <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.025] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/36">Reserva recomendada</p>
            <p className="mt-1 text-xl font-black text-amber-200">{fmtUsd(airline?.recommendedReserveUsd ?? 0)}</p>
            <p className="mt-1 text-[10px] leading-4 text-white/42">Caja aerolínea: {fmtUsd(airline?.balanceUsd ?? 0)} · Compras registradas: {fmtUsd(summary.aircraftPurchaseLedgerUsd)}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Aircraft Purchase Panel ──────────────────────────────────────────────────

type PurchaseOption = NonNullable<FleetAssetApiResponse["purchaseOptions"]>[number];

function FleetPurchasePanel() {
  const [data, setData] = useState<FleetAssetApiResponse | null>(null);
  const [selectedType, setSelectedType] = useState("");
  const [targetHub, setTargetHub] = useState("SCEL");
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ownerChecked, setOwnerChecked] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [viewerLabel, setViewerLabel] = useState("Piloto");

  useEffect(() => {
    fetch("/api/economia/fleet-assets")
      .then((r) => r.json())
      .then((payload: FleetAssetApiResponse) => {
        if (payload.ok) {
          setData(payload);
          const firstSuggested = payload.purchaseOptions?.find((item) => item.suggested || item.canBuyWithReserve) ?? payload.purchaseOptions?.[0];
          if (firstSuggested?.aircraftType) setSelectedType(firstSuggested.aircraftType);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let active = true;

    async function resolveOwner() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user;
        if (!user) {
          if (!active) return;
          setViewerLabel("Visitante");
          setIsOwner(false);
          return;
        }

        const { data: profile } = await supabase
          .from("pilot_profiles")
          .select("callsign, email")
          .eq("id", user.id)
          .maybeSingle();

        const callsign = typeof profile?.callsign === "string" ? profile.callsign : "";
        const email = typeof profile?.email === "string" ? profile.email : user.email ?? "";

        if (!active) return;
        setViewerLabel(callsign || email || "Piloto");
        setIsOwner(isOwnerIdentity(callsign, email));
      } catch {
        if (!active) return;
        setIsOwner(false);
      } finally {
        if (active) setOwnerChecked(true);
      }
    }

    resolveOwner();
    return () => {
      active = false;
    };
  }, []);

  const options = data?.purchaseOptions ?? [];
  const selected = options.find((item) => item.aircraftType === selectedType) ?? options[0];
  const totalPrice = (selected?.estimatedPurchasePriceUsd ?? 0) * quantity;
  const canBuy = Boolean(selected?.canBuyCashOnly) && totalPrice > 0;

  async function submitPurchase() {
    if (!selected?.aircraftType || !targetHub.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Debes iniciar sesión como administrador para comprar aeronaves.");

      const res = await fetch("/api/economia/aircraft-purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ aircraftType: selected.aircraftType, targetHubIcao: targetHub, quantity }),
      });
      const payload = await res.json();
      if (!res.ok || !payload.ok) throw new Error(payload.error ?? "No se pudo registrar la compra.");
      setMessage(`Compra registrada: ${payload.purchased.quantity}x ${payload.purchased.aircraftType} · matrículas ${payload.purchased.registrations.join(", ")}.`);
      const refreshed = await fetch("/api/economia/fleet-assets").then((r) => r.json());
      if (refreshed.ok) setData(refreshed);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "No se pudo registrar la compra.");
    } finally {
      setBusy(false);
    }
  }

  if (!data?.airline || options.length === 0) return null;

  if (ownerChecked && !isOwner) {
    return (
      <section className="rounded-[28px] border border-sky-400/14 bg-gradient-to-br from-sky-400/[0.08] to-white/[0.025] p-6 sm:p-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-300/70">Compra de aeronaves</p>
            <h2 className="mt-1 text-2xl font-black text-white">🛫 Crecimiento real de flota</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/58">
              Los pilotos pueden revisar cómo Patagonia Wings compra aeronaves, conserva reserva operacional y entrega cada unidad al hub asignado.
              La compra real queda reservada para la dirección de la aerolínea.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/36">Usuario</p>
            <p className="text-sm font-black text-sky-200">{viewerLabel}</p>
            <p className="text-[10px] text-white/38">Modo informativo</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[22px] border border-white/8 bg-black/15 p-4">
            <p className="text-sm font-black text-white">Reglas para pilotos</p>
            <div className="mt-3 space-y-3 text-xs leading-5 text-white/58">
              <p><span className="font-bold text-sky-200">Caja:</span> cada compra usa dinero real de la aerolínea acumulado por operaciones.</p>
              <p><span className="font-bold text-sky-200">Entrega:</span> las aeronaves llegan desde fábrica al hub asignado y no aparecen en cualquier aeropuerto.</p>
              <p><span className="font-bold text-sky-200">Control:</span> solo PWG001/dirección puede registrar compras para evitar cambios accidentales de flota.</p>
            </div>
          </div>
          <div className="rounded-[22px] border border-white/8 bg-black/15 p-4">
            <p className="text-sm font-black text-white">Opciones referenciales</p>
            <div className="mt-3 space-y-2">
              {options.slice(0, 5).map((item) => (
                <div key={item.aircraftType} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.018] px-3 py-2">
                  <div>
                    <p className="text-xs font-black text-white">{item.aircraftType}</p>
                    <p className="text-[10px] text-white/36">Costo fijo mensual {fmtUsd(item.estimatedMonthlyFixedCostUsd)}</p>
                  </div>
                  <p className="text-xs font-black text-emerald-300">{fmtUsd(item.estimatedPurchasePriceUsd)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[28px] border border-sky-400/14 bg-gradient-to-br from-sky-400/[0.08] to-white/[0.025] p-6 sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-300/70">Compra de aeronaves</p>
          <h2 className="mt-1 text-2xl font-black text-white">🛫 Crecimiento real de flota</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/58">
            La aerolínea compra aeronaves con su caja operacional. Cada compra descuenta el ledger, crea la aeronave en flota y la deja entregada en el hub asignado desde fábrica.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/36">Caja disponible</p>
          <p className="text-lg font-black text-emerald-300">{fmtUsd(data.airline.balanceUsd)}</p>
          <p className="text-[10px] text-white/38">Poder compra: {fmtUsd(data.airline.purchasingPowerUsd)}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[22px] border border-white/8 bg-black/15 p-4">
          <p className="text-sm font-black text-white">Registrar compra</p>
          <div className="mt-4 space-y-3">
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/36">Aeronave</span>
              <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white outline-none">
                {options.map((item) => (
                  <option key={item.aircraftType} value={item.aircraftType}>{item.aircraftType} · {fmtUsd(item.estimatedPurchasePriceUsd)}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/36">Hub destino</span>
              <input value={targetHub} onChange={(e) => setTargetHub(e.target.value.toUpperCase().slice(0, 4))} className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-sm font-black uppercase tracking-[0.12em] text-white outline-none" />
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/36">Cantidad</span>
              <input type="number" min={1} max={5} value={quantity} onChange={(e) => setQuantity(Math.min(5, Math.max(1, Number(e.target.value) || 1)))} className="mt-1 w-full rounded-2xl border border-white/10 bg-black/40 px-3 py-3 text-sm text-white outline-none" />
            </label>
            <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-3">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/36">Total compra</p>
              <p className="text-xl font-black text-white">{fmtUsd(totalPrice)}</p>
              <p className={`mt-1 text-[11px] ${canBuy ? "text-emerald-300" : "text-amber-300"}`}>{canBuy ? "Caja suficiente para compra operacional." : "Caja insuficiente o bajo reserva recomendada."}</p>
            </div>
            <button type="button" disabled={!canBuy || busy} onClick={submitPurchase} className="w-full rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/35">
              {busy ? "Registrando compra..." : "Comprar aeronave"}
            </button>
            {message && <p className="rounded-2xl border border-white/8 bg-black/20 p-3 text-xs leading-5 text-white/70">{message}</p>}
          </div>
        </div>

        <div className="rounded-[22px] border border-white/8 bg-black/15 p-4">
          <p className="text-sm font-black text-white">Opciones recomendadas</p>
          <div className="mt-3 space-y-2">
            {options.slice(0, 7).map((item: PurchaseOption) => (
              <div key={item.aircraftType} className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.018] px-3 py-3">
                <div>
                  <p className="text-sm font-black text-white">{item.aircraftType}</p>
                  <p className="text-[10px] text-white/40">{item.factory ?? "Fábrica fabricante"} · fijo mes {fmtUsd(item.estimatedMonthlyFixedCostUsd)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-emerald-300">{fmtUsd(item.estimatedPurchasePriceUsd)}</p>
                  <p className="text-[10px] text-white/36">{item.canBuyWithReserve ? "dentro de reserva" : `faltan ${fmtUsd(item.reserveGapUsd ?? 0)}`}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.025] p-3 text-xs leading-5 text-white/56">
            <p><span className="font-bold text-sky-200">Ledger:</span> la compra se registra como <code>aircraft_purchase</code> y descuenta caja.</p>
            <p><span className="font-bold text-sky-200">Entrega:</span> se genera matrícula PWG según país del hub y la aeronave queda en el hub destino.</p>
            <p><span className="font-bold text-sky-200">Control:</span> no comprar si deja la caja bajo reserva operacional salvo decisión administrativa.</p>
          </div>
        </div>
      </div>
    </section>
  );
}


type MonthlyCostItem = {
  code: string;
  label: string;
  amountUsd: number;
  description: string;
};

type MonthlyFixedCostsResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  status?: string;
  airline?: { id: string; name: string; balanceUsd: number };
  period?: { year: number; month: number; code: string };
  fleet?: { count: number; valueUsd: number; fixedMonthlyUsd: number };
  hubs?: { count: number };
  items?: MonthlyCostItem[];
  totalMonthlyCostUsd?: number;
  sixMonthReserveUsd?: number;
  recommendedReserveUsd?: number;
  alreadyApplied?: boolean;
};

function MonthlyFixedCostsPanel() {
  const [data, setData] = useState<MonthlyFixedCostsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [ownerChecked, setOwnerChecked] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  async function loadMonthlyCosts() {
    setLoading(true);
    fetch("/api/economia/monthly-fixed-costs")
      .then((r) => r.json())
      .then((payload: MonthlyFixedCostsResponse) => setData(payload))
      .catch((error) => setData({ ok: false, error: error instanceof Error ? error.message : "No se pudieron cargar costos mensuales." }))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let cancelled = false;
    loadMonthlyCosts();

    async function checkOwner() {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const user = sessionData.session?.user;
        if (!user) {
          if (!cancelled) {
            setIsOwner(false);
            setOwnerChecked(true);
          }
          return;
        }

        const { data: profile } = await supabase
          .from("pilot_profiles")
          .select("callsign, email")
          .eq("id", user.id)
          .maybeSingle();

        const callsign = typeof profile?.callsign === "string" ? profile.callsign : "";
        const email = typeof profile?.email === "string" ? profile.email : user.email ?? "";
        if (!cancelled) {
          setIsOwner(isOwnerIdentity(callsign, email));
          setOwnerChecked(true);
        }
      } catch {
        if (!cancelled) {
          setIsOwner(false);
          setOwnerChecked(true);
        }
      }
    }

    checkOwner();
    return () => {
      cancelled = true;
    };
  }, []);

  async function applyMonthlyCosts() {
    setApplying(true);
    setMessage(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Debes iniciar sesión como dirección/owner para aplicar costos mensuales.");

      const response = await fetch("/api/economia/monthly-fixed-costs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          periodYear: data?.period?.year,
          periodMonth: data?.period?.month,
        }),
      });
      const payload = (await response.json()) as MonthlyFixedCostsResponse;
      if (!response.ok || payload.ok === false) throw new Error(payload.error || "No se pudo aplicar el cierre mensual.");
      setData(payload);
      setMessage(payload.message || "Costos mensuales aplicados correctamente.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo aplicar el cierre mensual.");
    } finally {
      setApplying(false);
    }
  }

  if (loading) {
    return (
      <div className="mt-8 rounded-[28px] border border-white/10 bg-white/[0.03] p-7 text-sm text-white/40">
        Cargando costos fijos mensuales...
      </div>
    );
  }

  const items = data?.items ?? [];
  const total = data?.totalMonthlyCostUsd ?? 0;
  const recommendedReserve = data?.recommendedReserveUsd ?? 0;
  const airlineBalance = data?.airline?.balanceUsd ?? 0;
  const remainingAfterClose = airlineBalance - total;

  return (
    <section className="mt-8 rounded-[28px] border border-cyan-300/15 bg-cyan-400/[0.035] p-6 sm:p-7">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300/70">Operación mensual</p>
          <h2 className="mt-1 text-2xl font-black text-white">🏢 Costos fijos de aerolínea</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/64">
            Estos costos representan la operación mensual de Patagonia Wings: staff, hubs, flota, seguros, sistemas,
            administración y reserva técnica. Solo la dirección puede aplicar el cierre mensual al ledger.
          </p>
        </div>
        <div className="rounded-[20px] border border-white/10 bg-black/20 px-5 py-4 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">Período</p>
          <p className="mt-1 text-xl font-black text-cyan-200">{data?.period?.code ?? "Actual"}</p>
          <p className="mt-1 text-[11px] text-white/45">{data?.alreadyApplied ? "Cierre ya aplicado" : "Pendiente de cierre"}</p>
        </div>
      </div>

      {data?.ok === false && (
        <div className="mb-5 rounded-[18px] border border-amber-300/20 bg-amber-300/8 px-4 py-3 text-sm text-amber-100">
          {data.error || "No se pudo cargar el resumen de costos fijos."}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Caja actual", value: fmtUsd(airlineBalance), tone: airlineBalance >= 0 ? "text-emerald-300" : "text-rose-300" },
          { label: "Costo mensual", value: fmtUsd(total), tone: "text-amber-200" },
          { label: "Reserva recomendada", value: fmtUsd(recommendedReserve), tone: "text-cyan-200" },
          { label: "Caja post cierre", value: fmtUsd(remainingAfterClose), tone: remainingAfterClose >= 0 ? "text-emerald-300" : "text-rose-300" },
        ].map((card) => (
          <div key={card.label} className="rounded-[18px] border border-white/10 bg-black/18 px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/38">{card.label}</p>
            <p className={`mt-2 text-xl font-black ${card.tone}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {items.map((item) => (
          <div key={item.code} className="rounded-[18px] border border-white/8 bg-white/[0.025] px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black text-white">{item.label}</p>
                <p className="mt-1 text-xs leading-5 text-white/52">{item.description}</p>
              </div>
              <p className="shrink-0 text-sm font-black text-amber-200">{fmtUsd(item.amountUsd)}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-[20px] border border-white/10 bg-black/20 p-5">
        <p className="text-sm font-black text-white">Regla de cierre mensual</p>
        <p className="mt-2 text-xs leading-6 text-white/58">
          El cierre mensual descuenta movimientos separados en airline_ledger para poder reconstruir el balance por categoría.
          No se duplica si el período ya fue aplicado. Los pilotos pueden ver la explicación; solo owner/dirección puede ejecutar el cargo.
        </p>
        {message && <p className="mt-3 rounded-[14px] border border-cyan-300/20 bg-cyan-300/8 px-4 py-3 text-xs text-cyan-100">{message}</p>}
        {ownerChecked && isOwner && (
          <button
            type="button"
            onClick={applyMonthlyCosts}
            disabled={applying || Boolean(data?.alreadyApplied)}
            className="mt-4 rounded-2xl border border-cyan-300/30 bg-cyan-300/14 px-5 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {data?.alreadyApplied ? "Cierre mensual ya aplicado" : applying ? "Aplicando cierre..." : "Aplicar costos fijos del mes"}
          </button>
        )}
      </div>
    </section>
  );
}

type MonthlySalaryAdminResponse = {
  ok?: boolean;
  error?: string;
  period?: { year: number; month: number; paymentDateLabel: string };
  totals?: { pilots: number; payablePilots: number; netPayableUsd: number };
};

function MonthlyPilotPayoutPanel() {
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month, setMonth] = useState(now.getUTCMonth() + 1);
  const [ownerChecked, setOwnerChecked] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [data, setData] = useState<MonthlySalaryAdminResponse | null>(null);

  useEffect(() => {
    let active = true;
    async function checkOwner() {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) {
        if (active) {
          setIsOwner(false);
          setOwnerChecked(true);
        }
        return;
      }
      const profileRes = await fetch("/api/pilot/salary/monthly", { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
      const payload = profileRes && profileRes.ok ? await profileRes.json().catch(() => null) : null;
      const callsign = String(payload?.pilot?.callsign ?? "");
      const email = String(payload?.pilot?.email ?? "");
      if (active) {
        setIsOwner(isOwnerIdentity(callsign, email));
        setOwnerChecked(true);
      }
    }
    void checkOwner();
    return () => {
      active = false;
    };
  }, []);

  async function runPreview() {
    setLoading(true);
    setMessage("");
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Debes iniciar sesión como owner.");
      const res = await fetch(`/api/pilot/salary/monthly/admin?year=${year}&month=${month}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await res.json()) as MonthlySalaryAdminResponse;
      if (!res.ok || payload.ok === false) throw new Error(payload.error ?? "No se pudo generar preview.");
      setData(payload);
    } catch (error) {
      setData(null);
      setMessage(error instanceof Error ? error.message : "Error en preview.");
    } finally {
      setLoading(false);
    }
  }

  async function runPayout() {
    setRunning(true);
    setMessage("");
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      if (!token) throw new Error("Debes iniciar sesión como owner.");
      const res = await fetch(`/api/pilot/salary/monthly/admin?year=${year}&month=${month}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = (await res.json()) as MonthlySalaryAdminResponse;
      if (!res.ok || payload.ok === false) throw new Error(payload.error ?? "No se pudo ejecutar liquidación.");
      setData(payload);
      setMessage("Liquidación ejecutada. Reintentar el mismo mes no duplicará pagos.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Error al ejecutar liquidación.");
    } finally {
      setRunning(false);
    }
  }

  if (ownerChecked && !isOwner) return null;

  return (
    <section className="mb-10 rounded-[30px] border border-cyan-400/14 bg-gradient-to-br from-cyan-400/[0.08] to-white/[0.025] p-6 sm:p-7">
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300/70">Liquidación mensual piloto</p>
      <h2 className="mt-1 text-xl font-black text-white">Cierre manual owner/admin</h2>
      <p className="mt-2 text-sm leading-6 text-white/58">
        La comisión se devenga por vuelo y se paga solo aquí en cierre mensual. Futuro cron sugerido: último día hábil.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-xs text-white/60">Año
          <input value={year} onChange={(e) => setYear(Number(e.target.value) || year)} className="mt-1 block w-28 rounded-xl border border-white/12 bg-black/20 px-3 py-2 text-sm text-white" />
        </label>
        <label className="text-xs text-white/60">Mes
          <input value={month} onChange={(e) => setMonth(Math.min(12, Math.max(1, Number(e.target.value) || month)))} className="mt-1 block w-20 rounded-xl border border-white/12 bg-black/20 px-3 py-2 text-sm text-white" />
        </label>
        <button type="button" onClick={runPreview} disabled={loading || running} className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white">
          {loading ? "Cargando..." : "Preview"}
        </button>
        <button type="button" onClick={runPayout} disabled={loading || running} className="rounded-xl border border-cyan-300/30 bg-cyan-300/14 px-4 py-2 text-xs font-semibold text-cyan-100">
          {running ? "Procesando..." : "Pagar liquidación"}
        </button>
      </div>
      {data?.totals ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <p className="rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs text-white/78">Pilotos: {data.totals.pilots}</p>
          <p className="rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs text-white/78">Pagables: {data.totals.payablePilots}</p>
          <p className="rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs text-emerald-300">Total: {fmtUsd(data.totals.netPayableUsd)}</p>
        </div>
      ) : null}
      {message ? <p className="mt-3 text-xs text-amber-200">{message}</p> : null}
    </section>
  );
}
type EconomyHistoricalMetricsResponse = {
  ok?: boolean;
  totals?: {
    flights: number;
    distanceNm: number;
    blockHours: number;
    passengers: number;
    cargoKg: number;
    fuelKg: number;
    revenueUsd: number;
    costUsd: number;
    profitUsd: number;
  };
  monthly?: Array<{
    month: string;
    label: string;
    flights: number;
    passengers: number;
    cargoKg: number;
    fuelKg: number;
    airlineRevenueUsd: number;
    totalCostUsd: number;
    netProfitUsd: number;
    profitMarginPct: number;
  }>;
  ledgerTrend?: Array<{ key: string; label: string; incomeUsd: number; costUsd: number; netUsd: number }>;
  topRoutes?: Array<{ route: string; flights: number; revenueUsd: number; costUsd: number; profitUsd: number; passengers: number; cargoKg: number; distanceNm: number }>;
  lossRoutes?: Array<{ route: string; flights: number; revenueUsd: number; costUsd: number; profitUsd: number; passengers: number; cargoKg: number; distanceNm: number }>;
  topAircraft?: Array<{ aircraftType: string; flights: number; revenueUsd: number; costUsd: number; profitUsd: number; fuelKg: number; distanceNm: number }>;
  topPilots?: Array<{ callsign: string; flights: number; commissionUsd: number; hours: number }>;
  pilotExpenses?: Array<{ category: string; amountUsd: number; count: number }>;
  dataHealth?: { monthlyRows: number; snapshotRows: number; ledgerRows: number; expenseRows: number; salaryRows: number };
};

function EconomyHistoricalMetricsPanel() {
  const [data, setData] = useState<EconomyHistoricalMetricsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/economia/metrics")
      .then((r) => r.json())
      .then((payload: EconomyHistoricalMetricsResponse) => {
        if (active && payload.ok) setData(payload);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return (
      <section className="mb-8 rounded-[28px] border border-white/10 bg-white/[0.03] p-6 text-sm text-white/45">
        Cargando métricas históricas...
      </section>
    );
  }

  if (!data?.totals) {
    return (
      <section className="mb-8 rounded-[28px] border border-cyan-400/12 bg-cyan-400/[0.04] p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300/70">Métricas históricas</p>
        <h2 className="mt-1 text-xl font-black text-white">📈 Centro de métricas listo</h2>
        <p className="mt-2 text-sm leading-6 text-white/58">
          Cuando existan cierres ACARS y snapshots económicos, esta sección mostrará pasajeros, carga, combustible, rutas rentables, aeronaves y pilotos productivos.
        </p>
      </section>
    );
  }

  const totals = data.totals;
  const monthly = data.monthly ?? [];
  const trend = monthly.slice(-12);
  const labels = trend.map((row) => row.label);
  const hasTrend = trend.length >= 2;

  const kpis = [
    { icon: "✈️", label: "Vuelos", value: fmt(totals.flights), tone: "text-white" },
    { icon: "👥", label: "Pax trasladados", value: fmt(totals.passengers), tone: "text-emerald-300" },
    { icon: "📦", label: "Carga", value: `${fmt(totals.cargoKg)} kg`, tone: "text-cyan-300" },
    { icon: "⛽", label: "Fuel", value: `${fmt(totals.fuelKg)} kg`, tone: "text-amber-300" },
    { icon: "🧭", label: "Distancia", value: `${fmt(totals.distanceNm)} NM`, tone: "text-sky-300" },
    { icon: "🕒", label: "Horas", value: `${fmt(totals.blockHours)} h`, tone: "text-violet-300" },
    { icon: "🏢", label: "Ingresos", value: fmtUsd(totals.revenueUsd), tone: "text-emerald-300" },
    { icon: "📈", label: "Utilidad", value: `${totals.profitUsd >= 0 ? "+" : "−"}${fmtUsd(totals.profitUsd)}`, tone: totals.profitUsd >= 0 ? "text-emerald-300" : "text-rose-300" },
  ];

  return (
    <section className="mb-10 rounded-[30px] border border-emerald-400/14 bg-gradient-to-br from-emerald-400/[0.08] to-white/[0.025] p-6 sm:p-7">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-emerald-300/70">Métricas históricas</p>
          <h2 className="mt-1 text-2xl font-black text-white">📊 Operación acumulada Patagonia Wings</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-white/58">
            Lectura consolidada desde snapshots económicos, ledger, nómina y gastos piloto. Permite auditar pasajeros, carga, combustible, utilidad, rutas, aeronaves y pilotos.
          </p>
        </div>
        {data.dataHealth && (
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/36">Fuente</p>
            <p className="text-sm font-black text-emerald-300">Supabase</p>
            <p className="text-[10px] text-white/38">{data.dataHealth.snapshotRows} snapshots · {data.dataHealth.ledgerRows} ledger</p>
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((item) => (
          <div key={item.label} className="rounded-[18px] border border-white/8 bg-black/15 p-4">
            <div className="flex items-center gap-2">
              <span>{item.icon}</span>
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/38">{item.label}</p>
            </div>
            <p className={`mt-2 text-lg font-black ${item.tone}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {hasTrend && (
        <div className="mt-5 rounded-[22px] border border-white/8 bg-black/15 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">Tendencia mensual</p>
          <h3 className="mt-1 text-base font-bold text-white">Ingresos · Costos · Utilidad</h3>
          <div className="mt-4">
            <MiniLineChart
              labels={labels}
              series={[
                { label: "Ingresos", color: "#34d399", values: trend.map((row) => row.airlineRevenueUsd) },
                { label: "Costos", color: "#f59e0b", values: trend.map((row) => row.totalCostUsd) },
                { label: "Utilidad", color: "#38bdf8", values: trend.map((row) => row.netProfitUsd) },
              ]}
            />
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <MetricList title="🏆 Rutas más rentables" rows={(data.topRoutes ?? []).slice(0, 5).map((row) => ({ main: row.route, sub: `${row.flights} vuelos · ${fmt(row.passengers)} pax · ${fmt(row.cargoKg)} kg`, value: `${row.profitUsd >= 0 ? "+" : "−"}${fmtUsd(row.profitUsd)}`, tone: row.profitUsd >= 0 ? "text-emerald-300" : "text-rose-300" }))} />
        <MetricList title="⚠️ Rutas con pérdida" rows={(data.lossRoutes ?? []).filter((row) => row.profitUsd < 0).slice(0, 5).map((row) => ({ main: row.route, sub: `${row.flights} vuelos · costos ${fmtUsd(row.costUsd)}`, value: `−${fmtUsd(row.profitUsd)}`, tone: "text-rose-300" }))} empty="Sin rutas con pérdida registradas." />
        <MetricList title="🛫 Aeronaves productivas" rows={(data.topAircraft ?? []).slice(0, 5).map((row) => ({ main: row.aircraftType, sub: `${row.flights} vuelos · ${fmt(row.distanceNm)} NM · ${fmt(row.fuelKg)} kg fuel`, value: `${row.profitUsd >= 0 ? "+" : "−"}${fmtUsd(row.profitUsd)}`, tone: row.profitUsd >= 0 ? "text-emerald-300" : "text-rose-300" }))} />
        <MetricList title="👨‍✈️ Pilotos productivos" rows={(data.topPilots ?? []).slice(0, 5).map((row) => ({ main: row.callsign, sub: `${row.flights} vuelos · ${fmt(row.hours)} h`, value: fmtUsd(row.commissionUsd), tone: "text-cyan-300" }))} />
      </div>

      {(data.pilotExpenses ?? []).length > 0 && (
        <div className="mt-5 rounded-[22px] border border-white/8 bg-black/15 p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/40">Gastos de pilotos</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {(data.pilotExpenses ?? []).slice(0, 8).map((row) => (
              <div key={row.category} className="rounded-2xl border border-white/7 bg-white/[0.025] p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/38">{row.category}</p>
                <p className="mt-1 text-base font-black text-amber-300">{fmtUsd(row.amountUsd)}</p>
                <p className="text-[10px] text-white/38">{row.count} movimiento{row.count !== 1 ? "s" : ""}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function MetricList({ title, rows, empty = "Sin datos suficientes todavía." }: { title: string; rows: Array<{ main: string; sub: string; value: string; tone: string }>; empty?: string }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-black/15 p-4">
      <p className="text-sm font-black text-white">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-xs leading-5 text-white/42">{empty}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {rows.map((row, index) => (
            <div key={`${row.main}-${index}`} className="flex items-center justify-between gap-3 rounded-2xl border border-white/6 bg-white/[0.025] px-3 py-3">
              <div>
                <p className="text-sm font-black text-white">{row.main}</p>
                <p className="text-[10px] text-white/42">{row.sub}</p>
              </div>
              <p className={`shrink-0 text-sm font-black ${row.tone}`}>{row.value}</p>
            </div>
          ))}
        </div>
      )}
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
            <h1 className="mt-2 text-4xl font-black text-white">💰 Sistema económico</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-white/60">
              Cómo se calculan tus ingresos, comisiones, sueldo mensual y deducciones dentro de la simulación de aerolínea virtual.
            </p>
          </div>

          {/* Quick summary pills */}
          <div className="mt-6 flex flex-wrap gap-2">
            {[
              { label: "💳 $1,000 USD de inicio", color: "border-emerald-400/20 bg-emerald-400/8 text-emerald-300" },
              { label: "✈️ Comisión por cada vuelo completado", color: "border-cyan-400/20 bg-cyan-400/8 text-cyan-300" },
              { label: "📅 $1,500 USD sueldo base con 5+ vuelos/mes", color: "border-violet-400/20 bg-violet-400/8 text-violet-300" },
              { label: "🗓 Pago el último día hábil del mes", color: "border-amber-400/20 bg-amber-400/8 text-amber-300" },
              { label: "⚠️ −10% por daño grave a la aeronave", color: "border-red-400/20 bg-red-400/8 text-red-300" },
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

        {/* Airline live financial panel */}
        <AirlineFinancePanel />

        {/* Historical economy metrics */}
        <EconomyHistoricalMetricsPanel />

        {/* Fleet assets and airline growth */}
        <FleetAssetsPanel />
        <FleetPurchasePanel />
        <MonthlyFixedCostsPanel />
        <MonthlyPilotPayoutPanel />

        {/* Pilot wallet expenses and certification costs */}
        <PilotExpensePlanPanel />

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
            <h2 className="mt-1 text-xl font-bold text-white">📊 Ejemplos de comisión por ruta</h2>
            <p className="mt-1 text-sm text-white/48">Los valores se calculan por banda de ruta, aeronave y operación; long haul e intercontinental tienen topes superiores a rutas regionales.</p>
          </div>
          <CommissionTable />
        </div>

        {/* Monthly timeline */}
        <div className="mt-8 rounded-[24px] border border-white/10 bg-white/[0.03] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/50">Ciclo mensual</p>
          <h2 className="mt-1 text-xl font-bold text-white">🗓 ¿Qué pasa cada mes?</h2>
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
          <Link
            href="/profile?view=economia"
            className="rounded-2xl border border-cyan-400/24 bg-cyan-400/10 px-6 py-3 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/16"
          >
            Mi liquidación personal →
          </Link>
        </div>
      </main>
    </div>
  );
}
