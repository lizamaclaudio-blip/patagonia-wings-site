"use client";

import { useMemo, useState } from "react";
import type { PilotProfileRecord } from "@/lib/pilot-profile";
import CharterOriginDestinationStep from "@/components/dashboard/CharterOriginDestinationStep";
import {
  buildCharterFlightOperation,
  createCharterReservation,
  type CharterAircraftOption,
  type CharterReservationResult,
} from "@/lib/charter-ops";

type Props = {
  userId: string;
  profile: PilotProfileRecord;
  defaultOriginIcao?: string | null;
  onReserved?: (reservation: CharterReservationResult, operation: ReturnType<typeof buildCharterFlightOperation>) => void;
};

function defaultDepartureValue() {
  const date = new Date(Date.now() + 45 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoFromLocalTime(value: string) {
  const [rawHour, rawMinute] = value.split(":");
  const date = new Date();
  const hour = Number(rawHour);
  const minute = Number(rawMinute);

  date.setHours(Number.isFinite(hour) ? hour : 8, Number.isFinite(minute) ? minute : 0, 0, 0);
  return date.toISOString();
}

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

export default function CharterDispatchPanel({
  userId,
  profile,
  defaultOriginIcao,
  onReserved,
}: Props) {
  const lockedOrigin = normalize(
    profile.current_airport_icao ??
    profile.current_airport_code ??
    defaultOriginIcao ??
    profile.base_hub ??
    "SCEL",
  );

  const [originIcao] = useState(lockedOrigin);
  const [destinationIcao, setDestinationIcao] = useState("");
  const [scheduledDeparture, setScheduledDeparture] = useState(defaultDepartureValue());
  const [selectedAircraft, setSelectedAircraft] = useState<CharterAircraftOption | null>(null);
  const [remarks, setRemarks] = useState("Chárter creado desde Despacho Patagonia Wings.");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const routeReady = useMemo(() => {
    const origin = normalize(originIcao);
    const destination = normalize(destinationIcao);
    return origin.length === 4 && destination.length === 4 && origin !== destination;
  }, [destinationIcao, originIcao]);

  const operationDraft = useMemo(() => {
    if (!routeReady || !selectedAircraft) return null;
    return buildCharterFlightOperation({
      userId,
      profile,
      draft: {
        originIcao,
        destinationIcao,
        selectedAircraft,
        scheduledDeparture: toIsoFromLocalTime(scheduledDeparture),
        remarks,
      },
    });
  }, [destinationIcao, originIcao, profile, remarks, routeReady, scheduledDeparture, selectedAircraft, userId]);

  async function reserveCharter() {
    if (!operationDraft || !selectedAircraft) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const result = await createCharterReservation({
        aircraftId: selectedAircraft.aircraft_id,
        originIcao: operationDraft.origin,
        destinationIcao: operationDraft.destination,
        scheduledDeparture: operationDraft.scheduledDeparture,
        plannedBlockMinutes: null,
        remarks: operationDraft.remarks,
      });

      if (!result.ok || !result.reservation_id) {
        setError(result.error ? `No se pudo crear el Chárter: ${result.error}` : "No se pudo crear el Chárter.");
        return;
      }

      setMessage(`Chárter reservado. Continúa en Despacho para preparar el OFP.`);
      onReserved?.(result, operationDraft);
    } catch (err) {
      setError(err instanceof Error ? `No se pudo crear el Chárter: ${err.message}` : "No se pudo crear el Chárter. Revisa aeropuertos, rango/licencia o disponibilidad de aeronave.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5">
      <CharterOriginDestinationStep
        profile={profile}
        originIcao={originIcao}
        destinationIcao={destinationIcao}
        scheduledDeparture={scheduledDeparture}
        selectedAircraftId={selectedAircraft?.aircraft_id ?? null}
        originLocked={true}
        onOriginChange={() => {
          // Origen bloqueado por ubicación actual del piloto.
        }}
        onDestinationChange={setDestinationIcao}
        onScheduledDepartureChange={setScheduledDeparture}
        onAircraftChange={setSelectedAircraft}
      />

      <div className="rounded-[22px] border border-white/8 bg-white/[0.035] p-5">
        <label className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/42">Observaciones</label>
        <textarea
          value={remarks}
          onChange={(event) => setRemarks(event.target.value)}
          rows={3}
          className="mt-3 w-full resize-none rounded-[16px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-cyan-300/45"
        />
      </div>

      {operationDraft ? (
        <div className="rounded-[22px] border border-cyan-300/16 bg-cyan-300/[0.045] p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-100/60">Resumen Chárter</p>
          <h3 className="mt-2 text-xl font-semibold text-white">{operationDraft.origin} → {operationDraft.destination}</h3>
          <p className="mt-2 text-sm text-white/58">
            {operationDraft.aircraftTailNumber} · {operationDraft.aircraftTypeCode} · Meteo real obligatoria · Mueve piloto y aeronave al destino.
          </p>
        </div>
      ) : null}

      {message ? (
        <div className="rounded-[18px] border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-semibold text-emerald-100">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-[18px] border border-rose-300/24 bg-rose-400/10 px-4 py-3 text-sm font-semibold text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!operationDraft || saving}
          onClick={reserveCharter}
          className="rounded-[14px] bg-[#67d7ff] px-5 py-3 text-sm font-bold text-[#04162a] transition hover:bg-[#8be2ff] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {saving ? "Reservando..." : "Crear reserva Chárter"}
        </button>
      </div>
    </div>
  );
}
