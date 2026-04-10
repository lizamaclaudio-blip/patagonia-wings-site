import type {
  PilotAircraftRating,
  PilotCertification,
  PilotProfile,
} from "@/types/pilot";

export const mockPilotProfile: PilotProfile = {
  firstName: "Claudio",
  lastName: "Lizama",
  callsign: "PWG000",
  email: "pwg000@patagoniawings.app",
  country: "Chile",
  baseHub: "SCEL",
  mainSimulator: "MSFS 2020",
  simbriefUsername: "claudiolizama",
  vatsimId: "Pendiente",
  ivaoId: "Pendiente",
  status: "Operational",
  totalHours: 74.6,
  favoriteAirports: ["SCEL", "SCTE", "SCFA"],
  notes:
    "Piloto base de pruebas Patagonia Wings. En esta etapa la información es mock y servirá para conectar luego Supabase + SimBrief.",
};

export const mockPilotCertifications: PilotCertification[] = [
  {
    code: "PILOT-CORE",
    name: "Inducción Patagonia Wings",
    category: "General",
    status: "Active",
    issuedAt: "2026-04-01",
    expiresAt: "2027-04-01",
  },
  {
    code: "IFR-STD",
    name: "Habilitación IFR estándar",
    category: "Operación",
    status: "Active",
    issuedAt: "2026-03-20",
    expiresAt: "2027-03-20",
  },
  {
    code: "DISPATCH-001",
    name: "Procedimiento de despacho",
    category: "Dispatch",
    status: "Pending",
    issuedAt: "2026-04-05",
    expiresAt: "2026-12-31",
  },
  {
    code: "SAFETY-BRIEF",
    name: "Briefing de seguridad y SOP",
    category: "Safety",
    status: "Active",
    issuedAt: "2026-04-01",
    expiresAt: "2027-04-01",
  },
];

export const mockPilotRatings: PilotAircraftRating[] = [
  {
    code: "B737",
    name: "Boeing 737 Series",
    family: "Jet",
    status: "Training",
  },
  {
    code: "A320",
    name: "Airbus A320 Series",
    family: "Jet",
    status: "Locked",
  },
  {
    code: "C208",
    name: "Cessna 208 Caravan",
    family: "Turboprop",
    status: "Active",
  },
];

export const mockReadinessChecklist = [
  { name: "Perfil piloto completo", done: true },
  { name: "Usuario SimBrief cargado", done: true },
  { name: "Habilitación IFR activa", done: true },
  { name: "Reserva de vuelo", done: false },
  { name: "Despacho final", done: false },
  { name: "Estado ready_for_acars", done: false },
];