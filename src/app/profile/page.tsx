"use client";

import { useEffect, useMemo, useState } from "react";
import PublicHeader from "@/components/site/PublicHeader";
import ProtectedPage, {
  useProtectedSession,
} from "@/components/site/ProtectedPage";
import {
  ensurePilotProfile,
  updatePilotProfile,
} from "@/lib/pilot-profile";

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

type NavigraphStatus = {
  configured: boolean;
  connected: boolean;
  hasRefreshToken: boolean;
  expiresAt: string | null;
  scopes: string[];
  subscriptions: string[];
  clientId: string | null;
  subject: string | null;
  error: string | null;
};

const EMPTY_STATUS: NavigraphStatus = {
  configured: false,
  connected: false,
  hasRefreshToken: false,
  expiresAt: null,
  scopes: [],
  subscriptions: [],
  clientId: null,
  subject: null,
  error: null,
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

function StatusPill({
  ok,
  okLabel,
  badLabel,
}: {
  ok: boolean;
  okLabel: string;
  badLabel: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
        ok
          ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-300"
          : "border-amber-400/20 bg-amber-400/10 text-amber-300"
      }`}
    >
      {ok ? okLabel : badLabel}
    </span>
  );
}

function ProfileContent() {
  const session = useProtectedSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [disconnectingAuth, setDisconnectingAuth] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [authStatus, setAuthStatus] = useState<NavigraphStatus>(EMPTY_STATUS);

  const [form, setForm] = useState<ProfileFormState>({
    first_name: "",
    last_name: "",
    callsign: "",
    email: session.user.email ?? "",
    country: "Chile",
    base_hub: "SCEL",
    simulator: "MSFS 2020",
    simbrief_username: "",
    vatsim_id: "",
    ivao_id: "",
  });

  useEffect(() => {
    async function loadProfile() {
      const profile = await ensurePilotProfile(session.user);

      if (profile) {
        setForm({
          first_name: profile.first_name ?? "",
          last_name: profile.last_name ?? "",
          callsign: profile.callsign ?? "",
          email: profile.email ?? session.user.email ?? "",
          country: profile.country ?? "Chile",
          base_hub: profile.base_hub ?? "SCEL",
          simulator: profile.simulator ?? "MSFS 2020",
          simbrief_username: profile.simbrief_username ?? "",
          vatsim_id: profile.vatsim_id ?? "",
          ivao_id: profile.ivao_id ?? "",
        });
      }

      setLoading(false);
    }

    void loadProfile();
  }, [session.user]);

  async function loadNavigraphStatus() {
    setCheckingAuth(true);

    try {
      const response = await fetch("/api/auth/navigraph/status", {
        method: "GET",
        cache: "no-store",
      });

      const data = (await response.json()) as NavigraphStatus;
      setAuthStatus(data);

      if (data.error) {
        setErrorMessage(data.error);
      }
    } catch {
      setAuthStatus(EMPTY_STATUS);
      setErrorMessage("No se pudo comprobar el estado de conexión con Navigraph.");
    } finally {
      setCheckingAuth(false);
    }
  }

  useEffect(() => {
    void loadNavigraphStatus();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const ok = params.get("ng");
    const error = params.get("ng_error");

    if (ok === "connected") {
      setInfoMessage("Navigraph/SimBrief quedó conectado correctamente.");
      void loadNavigraphStatus();
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    if (error) {
      setErrorMessage(error);
      void loadNavigraphStatus();
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  function updateField<K extends keyof ProfileFormState>(
    key: K,
    value: ProfileFormState[K]
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setErrorMessage("");
    setInfoMessage("");

    try {
      await updatePilotProfile(session.user.id, {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        callsign: form.callsign.trim().toUpperCase(),
        country: form.country.trim(),
        base_hub: form.base_hub,
        simulator: form.simulator,
        simbrief_username: form.simbrief_username.trim() || null,
        vatsim_id: form.vatsim_id.trim() || null,
        ivao_id: form.ivao_id.trim() || null,
      });

      setInfoMessage("Perfil actualizado correctamente.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo guardar el perfil.";

      setErrorMessage(message);
    } finally {
      setSaving(false);
    }
  }

  function handleConnectNavigraph() {
    if (typeof window === "undefined") {
      return;
    }

    window.location.href = "/api/auth/navigraph/start?next=/profile";
  }

  async function handleDisconnectNavigraph() {
    setDisconnectingAuth(true);
    setErrorMessage("");
    setInfoMessage("");

    try {
      const response = await fetch("/api/auth/navigraph/disconnect", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("No se pudo desconectar Navigraph.");
      }

      setInfoMessage("La conexión con Navigraph/SimBrief fue eliminada.");
      await loadNavigraphStatus();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "No se pudo desconectar Navigraph."
      );
    } finally {
      setDisconnectingAuth(false);
    }
  }

  const scopesLabel = useMemo(() => {
    if (!authStatus.scopes.length) {
      return "—";
    }

    return authStatus.scopes.join(" · ");
  }, [authStatus.scopes]);

  const subscriptionsLabel = useMemo(() => {
    if (!authStatus.subscriptions.length) {
      return "—";
    }

    return authStatus.subscriptions.join(" · ");
  }, [authStatus.subscriptions]);

  return (
    <div className="pw-container py-12 sm:py-16 lg:py-20">
      <section className="glass-panel rounded-[34px] p-7 sm:p-9">
        <span className="parallax-chip mb-6">PERFIL PILOTO</span>

        <h1 className="text-4xl font-semibold leading-tight text-white sm:text-5xl">
          Perfil operacional del piloto
        </h1>

        <p className="mt-5 max-w-3xl text-base leading-8 text-white/80">
          Esta vista ya queda preparada con conexión real a Navigraph/SimBrief,
          manteniendo intacta la estética aprobada.
        </p>
      </section>

      <form className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]" onSubmit={handleSave}>
        <div className="glass-panel rounded-[30px] p-7">
          <span className="section-chip">Datos principales</span>

          {loading ? (
            <p className="mt-6 text-white/76">Cargando perfil...</p>
          ) : (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
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
                <input
                  className="input-premium"
                  value={form.callsign}
                  onChange={(event) =>
                    updateField("callsign", event.target.value.toUpperCase())
                  }
                />
              </div>

              <div className="surface-outline rounded-[22px] px-5 py-5">
                <label className="field-label">Email</label>
                <input className="input-premium opacity-80" value={form.email} readOnly />
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
                <select
                  className="input-premium"
                  value={form.base_hub}
                  onChange={(event) => updateField("base_hub", event.target.value)}
                >
                  <option value="SCEL">SCEL - Santiago</option>
                  <option value="SCTE">SCTE - Puerto Montt</option>
                  <option value="SCFA">SCFA - Antofagasta</option>
                </select>
              </div>

              <div className="surface-outline rounded-[22px] px-5 py-5">
                <label className="field-label">Simulador principal</label>
                <select
                  className="input-premium"
                  value={form.simulator}
                  onChange={(event) => updateField("simulator", event.target.value)}
                >
                  <option value="MSFS 2020">MSFS 2020</option>
                  <option value="MSFS 2024">MSFS 2024</option>
                  <option value="X-Plane">X-Plane</option>
                </select>
              </div>

              <div className="surface-outline rounded-[22px] px-5 py-5">
                <label className="field-label">Usuario SimBrief</label>
                <input
                  className="input-premium"
                  value={form.simbrief_username}
                  onChange={(event) =>
                    updateField("simbrief_username", event.target.value)
                  }
                  placeholder="Ej: claudiolizama"
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
          )}

          <div className="mt-6 surface-outline rounded-[24px] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/56">
              Conexión real Navigraph / SimBrief
            </p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4">
                <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/56">
                  Estado
                </span>
                <div className="mt-3">
                  <StatusPill
                    ok={authStatus.connected}
                    okLabel="Conectado"
                    badLabel={checkingAuth ? "Comprobando..." : "No conectado"}
                  />
                </div>
              </div>

              <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4">
                <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/56">
                  Refresh token
                </span>
                <div className="mt-3">
                  <StatusPill
                    ok={authStatus.hasRefreshToken}
                    okLabel="Disponible"
                    badLabel="No disponible"
                  />
                </div>
              </div>

              <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4 sm:col-span-2">
                <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/56">
                  Scopes autorizados
                </span>
                <p className="mt-3 text-sm leading-7 text-white/82">{scopesLabel}</p>
              </div>

              <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4 sm:col-span-2">
                <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/56">
                  Expira access token
                </span>
                <p className="mt-3 text-sm leading-7 text-white/82">
                  {formatDateTime(authStatus.expiresAt)}
                </p>
              </div>

              <div className="rounded-[18px] border border-white/10 bg-white/5 px-4 py-4 sm:col-span-2">
                <span className="block text-xs font-semibold uppercase tracking-[0.2em] text-white/56">
                  Suscripciones detectadas
                </span>
                <p className="mt-3 text-sm leading-7 text-white/82">
                  {subscriptionsLabel}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              {!authStatus.connected ? (
                <button
                  type="button"
                  className="button-primary"
                  onClick={handleConnectNavigraph}
                  disabled={checkingAuth || loading}
                >
                  {checkingAuth ? "Comprobando..." : "Conectar Navigraph / SimBrief"}
                </button>
              ) : (
                <button
                  type="button"
                  className="button-ghost"
                  onClick={() => void handleDisconnectNavigraph()}
                  disabled={disconnectingAuth}
                >
                  {disconnectingAuth ? "Desconectando..." : "Desconectar"}
                </button>
              )}

              <button
                type="button"
                className="button-ghost"
                onClick={() => void loadNavigraphStatus()}
                disabled={checkingAuth}
              >
                {checkingAuth ? "Actualizando..." : "Actualizar estado"}
              </button>
            </div>
          </div>
        </div>

        <div className="glass-panel rounded-[30px] p-7">
          <span className="section-chip">Resumen</span>

          <div className="mt-6 space-y-4">
            <div className="surface-outline rounded-[22px] px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/56">
                Status
              </p>
              <span className="mt-3 inline-flex rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                Operational
              </span>
            </div>

            <div className="surface-outline rounded-[22px] px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/56">
                Callsign actual
              </p>
              <p className="mt-2 text-3xl font-semibold text-white">
                {form.callsign || "PWG000"}
              </p>
            </div>

            <div className="surface-outline rounded-[22px] px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/56">
                Hub base
              </p>
              <p className="mt-2 text-xl font-semibold text-white">{form.base_hub}</p>
            </div>

            <div className="surface-outline rounded-[22px] px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/56">
                Simulador
              </p>
              <p className="mt-2 text-xl font-semibold text-white">{form.simulator}</p>
            </div>

            <div className="surface-outline rounded-[22px] px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/56">
                Usuario SimBrief
              </p>
              <p className="mt-2 text-xl font-semibold text-white">
                {form.simbrief_username || "Pendiente"}
              </p>
            </div>

            <div className="surface-outline rounded-[22px] px-5 py-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/56">
                Autorización Navigraph
              </p>
              <div className="mt-3">
                <StatusPill
                  ok={authStatus.connected}
                  okLabel="Activa"
                  badLabel="Pendiente"
                />
              </div>
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

          <div className="mt-5">
            <button type="submit" className="button-primary w-full" disabled={saving || loading}>
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <main className="grid-overlay">
      <section className="parallax-hero relative isolate min-h-screen overflow-hidden">
        <div className="parallax-bg" />
        <div className="parallax-overlay" />

        <div className="relative z-10">
          <header className="pw-container pt-5">
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