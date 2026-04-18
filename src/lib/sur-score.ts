function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

export function resolveSurScore(input: {
  scorePayload?: Record<string, unknown> | null;
  surScore?: unknown;
  finalScore?: unknown;
  procedureScore?: unknown;
  performanceScore?: unknown;
  missionScore?: unknown;
  pulso10?: unknown;
  ruta10?: unknown;
}) {
  const payload = input.scorePayload ?? {};
  return (
    toNumber(payload.sur_score) ||
    toNumber(payload.final_score) ||
    toNumber(input.surScore) ||
    toNumber(input.finalScore) ||
    toNumber(input.procedureScore) ||
    toNumber(input.performanceScore) ||
    toNumber(input.missionScore) ||
    toNumber(input.pulso10) ||
    toNumber(input.ruta10)
  );
}
