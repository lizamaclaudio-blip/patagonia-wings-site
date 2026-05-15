type IcaoFlagBadgeSize = "sm" | "md";

const ICAO_PREFIX_TO_COUNTRY: Array<[string, string]> = [
  ["SC", "CL"],
  ["SA", "AR"],
  ["SB", "BR"],
  ["SP", "PE"],
  ["SK", "CO"],
  ["SE", "EC"],
  ["SU", "UY"],
  ["SG", "PY"],
  ["SL", "BO"],
  ["KM", "US"],
  ["KJ", "US"],
  ["KL", "US"],
  ["MM", "MX"],
  ["LE", "ES"],
  ["LF", "FR"],
  ["EG", "GB"],
];

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  CHILE: "CL",
  ARGENTINA: "AR",
  BRASIL: "BR",
  BRAZIL: "BR",
  PERU: "PE",
  COLOMBIA: "CO",
  ECUADOR: "EC",
  URUGUAY: "UY",
  PARAGUAY: "PY",
  BOLIVIA: "BO",
  "ESTADOS UNIDOS": "US",
  "UNITED STATES": "US",
  USA: "US",
  US: "US",
  MEXICO: "MX",
  ESPANA: "ES",
  SPAIN: "ES",
  FRANCIA: "FR",
  FRANCE: "FR",
  "REINO UNIDO": "GB",
  "UNITED KINGDOM": "GB",
  UK: "GB",
  ENGLAND: "GB",
  INGLATERRA: "GB",
};

function normalizeCountryCode(value?: string | null) {
  const normalized = value?.trim().toUpperCase() ?? "";
  if (!normalized) return null;
  if (normalized.length === 2) return normalized;
  return COUNTRY_NAME_TO_CODE[normalized] ?? null;
}

function inferCountryCodeFromIcao(icao?: string | null) {
  const normalized = (icao ?? "").trim().toUpperCase();
  if (!normalized) return null;
  const match = ICAO_PREFIX_TO_COUNTRY.find(([prefix]) => normalized.startsWith(prefix));
  return match?.[1] ?? null;
}

function getFlagUrl(countryCode?: string | null) {
  const normalized = countryCode?.trim().toLowerCase() ?? "";
  return normalized ? `https://flagcdn.com/24x18/${normalized}.png` : "";
}

function resolveCountryCode(countryCode?: string | null, icao?: string | null) {
  return normalizeCountryCode(countryCode) ?? inferCountryCodeFromIcao(icao) ?? null;
}

export default function IcaoFlagBadge({
  icao,
  countryCode,
  size = "md",
  className = "",
}: {
  icao?: string | null;
  countryCode?: string | null;
  size?: IcaoFlagBadgeSize;
  className?: string;
}) {
  const code = (icao ?? "").trim().toUpperCase() || "----";
  const resolvedCountryCode = resolveCountryCode(countryCode, code);
  const flagUrl = getFlagUrl(resolvedCountryCode);
  const compact = size === "sm";

  return (
    <span
      className={`icao-flag-badge inline-flex items-center gap-2 rounded-[9px] border border-[var(--pw-border)] bg-white text-[var(--pw-text)] shadow-[var(--pw-shadow-xs)] ${compact ? "px-2.5 py-[4px] text-[13px]" : "px-3 py-[5px] text-[14px]"} ${className}`}
    >
      {flagUrl ? (
        <img
          src={flagUrl}
          alt={`Bandera ${resolvedCountryCode ?? code}`}
          className={`${compact ? "h-[12px] w-[18px]" : "h-[13px] w-[20px]"} rounded-[2px] object-cover`}
          loading="lazy"
          decoding="async"
        />
      ) : null}
      <span className="icao-flag-badge__code font-extrabold uppercase tracking-[0.03em] leading-none">{code}</span>
    </span>
  );
}
