import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient, getUserFromAccessToken } from "@/lib/supabase/server";
import { lastBusinessDayLabel } from "@/lib/pilot-economy";

function getBearerToken(request: NextRequest) {
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return null;
  return auth.slice(7).trim() || null;
}

function toNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function money(value: number) {
  return `$${Math.round(value).toLocaleString("es-CL")} USD`;
}

function periodRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01T00:00:00Z`;
  const end = month === 12 ? `${year + 1}-01-01T00:00:00Z` : `${year}-${String(month + 1).padStart(2, "0")}-01T00:00:00Z`;
  return { start, end };
}

function getFlightBlockMinutes(row: Record<string, unknown>) {
  return toNumber(row.actual_block_minutes) || toNumber(row.block_minutes) || toNumber(row.block_time_minutes) || toNumber(row.estimated_block_minutes);
}

function normalizePdfText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function escapePdfText(value: unknown) {
  return normalizePdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildSimplePdf(lines: string[]) {
  const pageWidth = 612;
  const pageHeight = 792;
  const left = 54;
  let y = 742;
  const contentParts: string[] = [];

  function write(text: string, size = 10, leading = 15) {
    if (y < 70) return;
    contentParts.push(`BT /F1 ${size} Tf ${left} ${y} Td (${escapePdfText(text)}) Tj ET`);
    y -= leading;
  }

  contentParts.push("0.08 0.12 0.18 rg 0 0 612 792 re f");
  contentParts.push("0.00 0.70 0.78 rg 0 780 612 12 re f");
  contentParts.push("1 1 1 rg");

  lines.forEach((line, index) => {
    if (index === 0) write(line, 20, 28);
    else if (line === "") y -= 8;
    else if (line.startsWith("# ")) write(line.slice(2), 14, 20);
    else write(line, 10, 15);
  });

  const stream = contentParts.join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj`,
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${Buffer.byteLength(stream, "utf8")} >> stream\n${stream}\nendstream endobj`,
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${obj}\n`;
  }
  const xref = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "utf8");
}

export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) return NextResponse.json({ error: "No autenticado." }, { status: 401 });

  let user;
  try {
    user = await getUserFromAccessToken(token);
  } catch {
    return NextResponse.json({ error: "Sesión inválida." }, { status: 401 });
  }

  const now = new Date();
  const year = Number(request.nextUrl.searchParams.get("year")) || now.getUTCFullYear();
  const month = Math.min(12, Math.max(1, Number(request.nextUrl.searchParams.get("month")) || now.getUTCMonth() + 1));
  const { start, end } = periodRange(year, month);
  const supabase = createSupabaseServerClient(token);

  const { data: profile } = await supabase
    .from("pilot_profiles")
    .select("id,callsign,wallet_balance,first_name,last_name,email")
    .eq("id", user.id)
    .maybeSingle();

  const callsign = profile?.callsign ?? "PWG";
  const pilotName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || callsign;

  const { data: flightsData } = await supabase
    .from("flight_reservations")
    .select("*")
    .eq("pilot_callsign", callsign)
    .eq("status", "completed")
    .gte("completed_at", start)
    .lt("completed_at", end)
    .order("completed_at", { ascending: false });

  const flights = (flightsData ?? []) as Array<Record<string, unknown>>;
  const flightsCount = flights.length;
  const commissionTotal = flights.reduce((sum, f) => sum + toNumber(f.commission_usd), 0);
  const damageTotal = flights.reduce((sum, f) => sum + toNumber(f.damage_deduction_usd), 0);
  const blockMinutes = flights.reduce((sum, f) => sum + getFlightBlockMinutes(f), 0);

  const { data: expensesData } = await supabase
    .from("pilot_expense_ledger")
    .select("*")
    .or(`pilot_id.eq.${user.id},pilot_callsign.eq.${callsign}`)
    .gte("created_at", start)
    .lt("created_at", end)
    .order("created_at", { ascending: false });

  const expenses = (expensesData ?? []) as Array<Record<string, unknown>>;
  const expensesTotal = expenses.reduce((sum, item) => sum + Math.abs(toNumber(item.amount_usd)), 0);
  const baseSalary = flightsCount >= 5 ? 1500 : 0;
  const gross = commissionTotal + baseSalary;
  const net = Math.max(0, gross - damageTotal - expensesTotal);

  const lines = [
    "Patagonia Wings - Liquidacion mensual piloto",
    `Periodo: ${String(month).padStart(2, "0")}/${year}`,
    `Fecha estimada de pago: ${lastBusinessDayLabel(year, month)}`,
    `Piloto: ${pilotName}`,
    `Callsign: ${callsign}`,
    "",
    "# Resumen de haberes",
    `Vuelos completados: ${flightsCount}`,
    `Horas bloque: ${(blockMinutes / 60).toFixed(1)}`,
    `Comisiones por vuelo: ${money(commissionTotal)}`,
    `Sueldo base mensual: ${money(baseSalary)}`,
    `Total bruto: ${money(gross)}`,
    "",
    "# Descuentos y gastos",
    `Deducciones por dano: ${money(damageTotal)}`,
    `Gastos piloto pagados: ${money(expensesTotal)}`,
    `Total liquido: ${money(net)}`,
    "",
    "# Ultimos vuelos del periodo",
    ...flights.slice(0, 12).map((f) => {
      const date = f.completed_at ? new Date(String(f.completed_at)).toLocaleDateString("es-CL") : "Sin fecha";
      const route = `${String(f.origin_icao ?? f.origin ?? "---")} - ${String(f.destination_icao ?? f.destination ?? "---")}`;
      return `${date} | ${String(f.flight_number ?? f.route_code ?? "Vuelo")} | ${route} | Comision ${money(toNumber(f.commission_usd))}`;
    }),
    "",
    "# Gastos del periodo",
    ...expenses.slice(0, 10).map((e) => `${e.created_at ? new Date(String(e.created_at)).toLocaleDateString("es-CL") : "Sin fecha"} | ${String(e.category ?? "gasto")} | ${String(e.description ?? e.expense_code ?? "Gasto")} | ${money(Math.abs(toNumber(e.amount_usd)))}`),
    "",
    "Documento interno de simulacion para Patagonia Wings Virtual Airline.",
  ];

  const pdf = buildSimplePdf(lines);
  const filename = `liquidacion-${callsign}-${year}-${String(month).padStart(2, "0")}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
