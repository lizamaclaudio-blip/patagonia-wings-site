export function formatDateTime(value?: string | null) {
  if (!value) return "--";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDate(value?: string | null) {
  if (!value) return "--";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
  }).format(date);
}

export function formatNumber(value?: number | null, digits = 0) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "--";
  }

  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatScore(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "Sin score";
  }

  return `${formatNumber(value, 0)} pts`;
}

export function compactText(value?: string | null) {
  return value && value.trim().length ? value.trim() : "--";
}
