export type AcarsDispatchMode = "ITINERARY" | "CHARTER" | "TRAINING" | "EVENT";

export type AcarsActiveDispatch = {
  ok: boolean;
  error?: string | null;
  reservation_id?: string | null;
  reservation_code?: string | null;
  pilot_callsign?: string | null;
  flight_mode_code?: AcarsDispatchMode | string | null;
  flight_number?: string | null;
  route_code?: string | null;
  origin_ident?: string | null;
  destination_ident?: string | null;
  aircraft_id?: string | null;
  aircraft_registration?: string | null;
  aircraft_type_code?: string | null;
  scheduled_departure?: string | null;
  status?: string | null;
  real_weather_required?: boolean;
  move_pilot_on_close?: boolean;
  move_aircraft_on_close?: boolean;
};

export function isCharterDispatch(dispatch: AcarsActiveDispatch | null | undefined) {
  return (dispatch?.flight_mode_code ?? "").toString().trim().toUpperCase() === "CHARTER";
}

export function mustUseRealWeather(dispatch: AcarsActiveDispatch | null | undefined) {
  return Boolean(dispatch?.real_weather_required) || isCharterDispatch(dispatch);
}

export function dispatchMovesPilotAndAircraft(dispatch: AcarsActiveDispatch | null | undefined) {
  if (!dispatch) return false;
  if (isCharterDispatch(dispatch)) return true;
  return Boolean(dispatch.move_pilot_on_close && dispatch.move_aircraft_on_close);
}

export function getDispatchRouteLabel(dispatch: AcarsActiveDispatch | null | undefined) {
  const origin = dispatch?.origin_ident ?? "";
  const destination = dispatch?.destination_ident ?? "";
  if (!origin || !destination) return "Ruta pendiente";
  return `${origin} → ${destination}`;
}
