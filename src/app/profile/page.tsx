"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthPageFrame from "@/components/site/AuthPageFrame";
import PublicHeader from "@/components/site/PublicHeader";
import ProtectedPage, {
  useProtectedSession,
} from "@/components/site/ProtectedPage";
import {
  ensurePilotProfile,
  updatePilotProfile,
  type PilotProfileRecord,
} from "@/lib/pilot-profile";
import { supabase } from "@/lib/supabase/browser";

type ProfileFormState = {
  first_name: string;
  last_name: string;
  callsign: string;
  email: string;
  country: string;
  base_hub: string;
  simulator: string;
  simbrief_username: string;
  vatsim_id: string;
  ivao_id: string;
};

type ProfileView = "perfil" | "datos";

type PilotScoreRow = {
  pulso_10: number | null;
  ruta_10: number | null;
  legado_points: number | null;
};

const EMPTY_FORM: ProfileFormState = {
  first_name: "",
  last_name: "",
  callsign: "",
  email: "",
  country: "Chile",
  base_hub: "SCEL",
  simulator: "MSFS 2020",
  simbrief_username: "",
  vatsim_id: "",
  ivao_id: "",
};

function toNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function formatDecimal(value: number) {
  return new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRankLabel(value: string | null | undefined) {
  const normalized = (value ?? "CADET").trim();
  if (!normalized) {
    return "Cadet";
  }

  return normalized
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/(^|\s)\w/g, (letter) => letter.toUpperCase());
}

function getTotalHours(profile: PilotProfileRecord | null) {
  if (!profile) {
    return 0;
  }

  const raw = profile as PilotProfileRecord & {
    total_hours?: number | string | null;
    career_hours?: number | string | null;
    transferred_hours?: number | string | null;
  };

  const totalHours = toNumber(raw.total_hours);
  if (totalHours > 0) {
    return totalHours;
  }

  return toNumber(raw.career_hours) + toNumber(raw.transferred_hours);
}

function getPilotName(form: ProfileFormState) {
  const value = [form.first_name.trim(), form.last_name.trim()].filter(Boolean).join(" ");
  return value || form.callsign || "Piloto Patagonia Wings";
}

function getRankBadge(rank: string | null | undefined) {
  const code = (rank ?? "CADET").trim().toUpperCase();

  if (code.includes("LEGEND")) {
    return { symbol: "✦", label: "Leyenda Patagonia" };
  }

  if (code.includes("INSPECTOR") || code.includes("CHECK") || code.includes("MASTER")) {
    return { symbol: "★", label: "Inspector de línea" };
  }

  if (code.includes("COMMANDER")) {
    return { symbol: "◆", label: "Comandante regional" };
  }

  if (code.includes("CAPTAIN")) {
    return { symbol: "▲", label: "Capitán de línea" };
  }

  if (code.includes("FIRST_OFFICER")) {
    return { symbol: "■", label: "Primer oficial" };
  }

  if (code.includes("SECOND_OFFICER")) {
    return { symbol: "●", label: "Segundo oficial" };
  }

  return { symbol: "◈", label: "Cadete" };
}

function readView(value: string | null): ProfileView {
  return value === "datos" ? "datos" : "perfil";
}

function ProfileContent() {
  const session = useProtectedSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [profile, setProfile] = useState<PilotProfileRecord | null>(null);
  const [activeView, setActiveView] = useState<ProfileView>(readView(searchParams.get("view")));
  const [score, setScore] = useState({
    pulso10: 0,
    ruta10: 0,
    legado: 0,
  });

  const [form, setForm] = useState<ProfileFormState>({
    ...EMPTY_FORM,
    email: session.user.email ?? "",
  });

  useEffect(() => {
    setActiveView(readView(searchParams.get("view")));
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);

      try {
        const currentProfile = await ensurePilotProfile(session.user);

        if (cancelled) {
          return;
        }

        setProfile(currentProfile);
        setForm({
          first_name: currentProfile?.first_name ?? "",
          last_name: currentProfile?.last_name ?? "",
          callsign: currentProfile?.callsign ?? "",
          email: currentProfile?.email ?? session.user.email ?? "",
          country: currentProfile?.country ?? "Chile",
          base_hub: currentProfile?.base_hub ?? "SCEL",
          simulator: "MSFS 2020",
          simbrief_username: currentProfile?.simbrief_username ?? "",
          vatsim_id: currentProfile?.vatsim_id ?? "",
          ivao_id: currentProfile?.ivao_id ?? "",
        });

        if (currentProfile?.callsign) {
          const { data } = await supabase
            .from("pw_pilot_scores")
            .select("pulso_10, ruta_10, legado_points")
            .eq("pilot_callsign", currentProfile.callsign)
            .maybeSingle();

          if (!cancelled) {
            const row = (data ?? null) as PilotScoreRow | null;
            setScore({
              pulso10: toNumber(row?.pulso_10),
              ruta10: toNumber(row?.ruta_10),
              legado: toNumber(row?.legado_points),
            });
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [session.user]);

  function updateField<K extends keyof ProfileFormState>(
    key: K,
    value: ProfileFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function switchView(nextView: ProfileView) {
    setActiveView(nextView);
    router.replace(`/profile?view=${nextView}`);
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrorMessage("");
    setInfoMessage("");

    try {
      const updated = await updatePilotProfile(session.user.id, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        country: form.country.trim(),
        simbrief_username: form.simbrief_username.trim() || null,
        vatsim_id: form.vatsim_id.trim() || null,
        ivao_id: form.ivao_id.trim() || null,
      });

      setProfile(updated);
      setInfoMessage("Tus datos se guardaron correctamente.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "No se pudieron guardar los datos."
      );
    } finally {
      setSaving(false);
    }
  }

  const rankBadge = useMemo(
    () => getRankBadge(profile?.career_rank_code ?? profile?.rank_code),
    [profile?.career_rank_code, profile?.rank_code]
  );

  const pilotName = useMemo(() => getPilotName(form), [form]);
  const rankLabel = useMemo(
    () => formatRankLabel(profile?.career_rank_code ?? profile?.rank_code),
    [profile?.career_rank_code, profile?.rank_code]
  );

  return (
    <AuthPageFrame>
      <div className="space-y-6">
        <section className="glass-panel rounded-[30px] p-6 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="parallax-chip">Cuenta piloto</span>
              <h1 className="mt-4 text-3xl font-semibold text-white sm:text-[40px]">
                Área personal Patagonia Wings
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/72 sm:text-base">
                Aquí dejamos el perfil limpio: datos del piloto por un lado y ficha operacional por otro, sin mezclar Navigraph ni pasos de despacho.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => switchView("perfil")}
                className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                  activeView === "perfil"
                    ? "bg-emerald-500 text-white shadow-[0_12px_30px_rgba(17,181,110,0.22)]"
                    : "border border-white/10 bg-white/[0.04] text-white/72 hover:bg-white/[0.07]"
                }`}
              >
                Mi perfil
              </button>
              <button
                type="button"
                onClick={() => switchView("datos")}
                className={`rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                  activeView === "datos"
                    ? "bg-emerald-500 text-white shadow-[0_12px_30px_rgba(17,181,110,0.22)]"
                    : "border border-white/10 bg-white/[0.04] text-white/72 hover:bg-white/[0.07]"
                }`}
              >
                Mis datos
              </button>
            </div>
          </div>
        </section>

        {activeView === "perfil" ? (
          <section className="glass-panel rounded-[30px] p-6 sm:p-7">
            <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
              <div className="surface-outline rounded-[26px] p-6 text-center">
                <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-[32px] border border-white/12 bg-[radial-gradient(circle_at_top,rgba(103,215,255,0.22),rgba(4,20,40,0.9))] text-4xl font-semibold tracking-[0.16em] text-white shadow-[0_18px_46px_rgba(0,0,0,0.28)]">
                  {(form.first_name.charAt(0) + form.last_name.charAt(0) || form.callsign.slice(0, 2) || "PW").toUpperCase()}
                </div>

                <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/56">
                  {form.callsign || "PWG000"}
                </p>
                <h2 className="mt-3 text-3xl font-semibold leading-tight text-white">
                  {pilotName}
                </h2>

                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/16 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-100">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-base">
                    {rankBadge.symbol}
                  </span>
                  <span className="font-semibold">{rankBadge.label}</span>
                </div>

                <p className="mt-3 text-sm text-white/66">Foto de piloto pendiente por cargar</p>
              </div>

              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {[
                    { label: "Rango", value: rankLabel },
                    { label: "Horas totales", value: formatDecimal(getTotalHours(profile)) },
                    {
                      label: "Estado",
                      value: profile?.status?.trim().toLowerCase() === "inactive" ? "Inactivo" : "Activo",
                    },
                    { label: "País", value: form.country || "Chile" },
                    { label: "Hub base", value: form.base_hub || "SCEL" },
                    { label: "SimBrief", value: form.simbrief_username || "Pendiente" },
                    { label: "VATSIM ID", value: form.vatsim_id || "—" },
                    { label: "IVAO ID", value: form.ivao_id || "—" },
                    { label: "Simulador", value: "MSFS 2020" },
                  ].map((item) => (
                    <div key={item.label} className="surface-outline rounded-[22px] px-5 py-5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/54">
                        {item.label}
                      </p>
                      <p className="mt-2 text-xl font-semibold text-white">{loading ? "…" : item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    { label: "Pulso 10", value: formatDecimal(score.pulso10) },
                    { label: "Ruta 10", value: formatDecimal(score.ruta10) },
                    { label: "Legado", value: formatInteger(score.legado) },
                  ].map((item) => (
                    <div key={item.label} className="surface-outline rounded-[22px] px-5 py-5 text-center">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/54">
                        {item.label}
                      </p>
                      <p className="mt-2 text-[28px] font-semibold text-white">{loading ? "…" : item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activeView === "datos" ? (
          <section className="glass-panel rounded-[30px] p-6 sm:p-7">
            <div className="mb-5">
              <span className="section-chip">Datos personales</span>
              <h2 className="mt-4 text-3xl font-semibold text-white">Editar información del piloto</h2>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-white/72">
                Dejamos el hub bloqueado porque solo se define al registrarte. El simulador también queda fijo en MSFS 2020 por ahora.
              </p>
            </div>

            <form onSubmit={handleSave}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="surface-outline rounded-[22px] px-5 py-5">
                  <label className="field-label">Nombre</label>
                  <input
                    className="input-premium"
                    value={form.first_name}
                    onChange={(event) => updateField("first_name", event.target.value)}
                  />
                </div>

                <div className="surface-outline rounded-[22px] px-5 py-5">
                  <label className="field-label">Apellido</label>
                  <input
                    className="input-premium"
                    value={form.last_name}
                    onChange={(event) => updateField("last_name", event.target.value)}
                  />
                </div>

                <div className="surface-outline rounded-[22px] px-5 py-5">
                  <label className="field-label">Callsign</label>
                  <input className="input-premium opacity-70" value={form.callsign} readOnly />
                </div>

                <div className="surface-outline rounded-[22px] px-5 py-5">
                  <label className="field-label">Email</label>
                  <input className="input-premium opacity-70" value={form.email} readOnly />
                </div>

                <div className="surface-outline rounded-[22px] px-5 py-5">
                  <label className="field-label">País</label>
                  <input
                    className="input-premium"
                    value={form.country}
                    onChange={(event) => updateField("country", event.target.value)}
                  />
                </div>

                <div className="surface-outline rounded-[22px] px-5 py-5">
                  <label className="field-label">Hub base</label>
                  <input className="input-premium opacity-70" value={`${form.base_hub} · Bloqueado`} readOnly />
                </div>

                <div className="surface-outline rounded-[22px] px-5 py-5">
                  <label className="field-label">Simulador</label>
                  <input className="input-premium opacity-70" value="MSFS 2020" readOnly />
                </div>

                <div className="surface-outline rounded-[22px] px-5 py-5">
                  <label className="field-label">Usuario SimBrief</label>
                  <input
                    className="input-premium"
                    value={form.simbrief_username}
                    onChange={(event) => updateField("simbrief_username", event.target.value)}
                    placeholder="Ej: candonga5"
                  />
                </div>

                <div className="surface-outline rounded-[22px] px-5 py-5">
                  <label className="field-label">VATSIM ID</label>
                  <input
                    className="input-premium"
                    value={form.vatsim_id}
                    onChange={(event) => updateField("vatsim_id", event.target.value)}
                  />
                </div>

                <div className="surface-outline rounded-[22px] px-5 py-5">
                  <label className="field-label">IVAO ID</label>
                  <input
                    className="input-premium"
                    value={form.ivao_id}
                    onChange={(event) => updateField("ivao_id", event.target.value)}
                  />
                </div>
              </div>

              {errorMessage ? (
                <div className="mt-5 rounded-[18px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                  {errorMessage}
                </div>
              ) : null}

              {infoMessage ? (
                <div className="mt-5 rounded-[18px] border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200">
                  {infoMessage}
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-3">
                <button type="submit" className="button-primary" disabled={saving || loading}>
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => switchView("perfil")}
                >
                  Volver a mi perfil
                </button>
              </div>
            </form>
          </section>
        ) : null}
      </div>
    </AuthPageFrame>
  );
}

export default function ProfilePage() {
  return (
    <main className="grid-overlay">
      <section className="parallax-hero relative isolate min-h-screen">
        <div className="parallax-bg" />
        <div className="parallax-overlay" />

        <div className="relative z-10">
          <header className="pw-container sticky top-4 z-40 pt-5">
            <PublicHeader />
          </header>

          <ProtectedPage>
            <ProfileContent />
          </ProtectedPage>
        </div>
      </section>
    </main>
  );
}
