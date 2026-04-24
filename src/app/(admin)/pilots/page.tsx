import { updatePilotAction } from "@/app/(admin)/actions";
import { FormSubmitButton } from "@/components/admin/FormSubmitButton";
import { StatusPill } from "@/components/admin/StatusPill";
import { getHubs, getPilotRanks, getPilots } from "@/lib/control-center-data";
import { compactText, formatNumber, formatScore } from "@/lib/format";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function PilotsPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const query = typeof searchParams.q === "string" ? searchParams.q : "";
  const editId = typeof searchParams.edit === "string" ? searchParams.edit : "";
  const saved = typeof searchParams.saved === "string" ? searchParams.saved : "";

  const [pilots, hubs, ranks] = await Promise.all([
    getPilots(query),
    getHubs(),
    getPilotRanks(),
  ]);

  const selectedPilot =
    pilots.find((pilot) => String(pilot.id) === editId) ?? pilots[0] ?? null;

  return (
    <div className="stack gap-lg">
      <section className="section-head">
        <div>
          <span className="page-kicker">Pilots Office</span>
          <h1>Usuarios / Pilotos</h1>
          <p>Edición operacional de perfiles, rango, ubicación, horas y acceso.</p>
        </div>

        <form className="toolbar-form" method="get">
          <input
            className="input"
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Buscar por callsign, email o nombre"
          />
          <button className="button button-secondary" type="submit">
            Buscar
          </button>
        </form>
      </section>

      {saved ? <p className="banner success">Cambios de piloto guardados.</p> : null}

      <section className="content-grid two-columns">
        <article className="panel-card">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Listado</span>
              <h2>Pilotos registrados</h2>
            </div>
            <StatusPill>{pilots.length} resultados</StatusPill>
          </div>

          <div className="table-wrap tall-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Callsign</th>
                  <th>Nombre</th>
                  <th>Hub</th>
                  <th>Horas</th>
                  <th>Último vuelo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pilots.map((pilot) => (
                  <tr key={String(pilot.id)}>
                    <td>{compactText(pilot.callsign as string | null)}</td>
                    <td>
                      {compactText(
                        `${pilot.first_name ?? ""} ${pilot.last_name ?? ""}`.trim()
                      )}
                    </td>
                    <td>{compactText(pilot.base_hub as string | null)}</td>
                    <td>{formatNumber(Number(pilot.total_hours ?? 0), 1)}</td>
                    <td>
                      {pilot.last_flight
                        ? `${compactText(
                            pilot.last_flight.route_code as string | null
                          )} · ${formatScore(
                            Number(
                              pilot.last_flight.mission_score ??
                                pilot.last_flight.procedure_score ??
                                Number.NaN
                            )
                          )}`
                        : "Sin vuelos recientes"}
                    </td>
                    <td>
                      <a
                        className="inline-link"
                        href={`/pilots?edit=${String(pilot.id)}${
                          query ? `&q=${encodeURIComponent(query)}` : ""
                        }`}
                      >
                        Editar
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Editor</span>
              <h2>
                {selectedPilot
                  ? compactText(selectedPilot.callsign as string | null)
                  : "Sin selección"}
              </h2>
            </div>
          </div>

          {selectedPilot ? (
            <form action={updatePilotAction} className="stack gap-md">
              <input type="hidden" name="id" value={String(selectedPilot.id)} />
              <input
                type="hidden"
                name="callsign"
                value={compactText(selectedPilot.callsign as string | null)}
              />

              <div className="grid-two">
                <label className="field">
                  <span className="field-label">Callsign</span>
                  <input
                    className="input"
                    value={compactText(selectedPilot.callsign as string | null)}
                    readOnly
                  />
                </label>
                <label className="field">
                  <span className="field-label">Email</span>
                  <input
                    className="input"
                    value={compactText(selectedPilot.email as string | null)}
                    readOnly
                  />
                </label>
                <label className="field">
                  <span className="field-label">Nombre</span>
                  <input
                    className="input"
                    name="first_name"
                    defaultValue={selectedPilot.first_name?.toString() ?? ""}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Apellido</span>
                  <input
                    className="input"
                    name="last_name"
                    defaultValue={selectedPilot.last_name?.toString() ?? ""}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Hub base</span>
                  <select
                    className="input"
                    name="base_hub"
                    defaultValue={compactText(selectedPilot.base_hub as string | null)}
                  >
                    {hubs.map((hub) => (
                      <option key={String(hub.hub_code)} value={String(hub.hub_code)}>
                        {String(hub.hub_code)} · {String(hub.hub_name)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Ubicación actual</span>
                  <input
                    className="input"
                    name="current_airport_icao"
                    defaultValue={selectedPilot.current_airport_icao?.toString() ?? ""}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Rango</span>
                  <select
                    className="input"
                    name="rank_code"
                    defaultValue={compactText(selectedPilot.rank_code as string | null)}
                  >
                    {ranks.map((rank) => (
                      <option key={String(rank.code)} value={String(rank.code)}>
                        {String(rank.code)} · {String(rank.name)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span className="field-label">Career rank</span>
                  <input
                    className="input"
                    name="career_rank_code"
                    defaultValue={selectedPilot.career_rank_code?.toString() ?? ""}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Horas totales</span>
                  <input
                    className="input"
                    type="number"
                    step="0.1"
                    name="total_hours"
                    defaultValue={String(selectedPilot.total_hours ?? "")}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Horas transferidas</span>
                  <input
                    className="input"
                    type="number"
                    step="0.1"
                    name="transferred_hours"
                    defaultValue={String(selectedPilot.transferred_hours ?? "")}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Horas carrera</span>
                  <input
                    className="input"
                    type="number"
                    step="0.1"
                    name="career_hours"
                    defaultValue={String(selectedPilot.career_hours ?? "")}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Estado</span>
                  <input
                    className="input"
                    name="status"
                    defaultValue={selectedPilot.status?.toString() ?? ""}
                  />
                </label>
              </div>

              <div className="grid-two">
                <label className="field">
                  <span className="field-label">Certificaciones activas</span>
                  <textarea
                    className="textarea"
                    name="active_certifications"
                    defaultValue={selectedPilot.active_certifications?.toString() ?? ""}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Habilitaciones activas</span>
                  <textarea
                    className="textarea"
                    name="active_qualifications"
                    defaultValue={selectedPilot.active_qualifications?.toString() ?? ""}
                  />
                </label>
              </div>

              <div className="checkbox-row">
                <label>
                  <input
                    type="checkbox"
                    name="is_active"
                    defaultChecked={Boolean(selectedPilot.is_active)}
                  />{" "}
                  Perfil activo
                </label>
                <label>
                  <input
                    type="checkbox"
                    name="access_enabled"
                    defaultChecked={Boolean(selectedPilot.account?.access_enabled)}
                  />{" "}
                  Acceso habilitado
                </label>
              </div>

              <div className="inline-note">
                Último vuelo:{" "}
                {selectedPilot.last_flight
                  ? `${compactText(
                      selectedPilot.last_flight.route_code as string | null
                    )} · ${formatScore(
                      Number(
                        selectedPilot.last_flight.mission_score ??
                          selectedPilot.last_flight.procedure_score ??
                          Number.NaN
                      )
                    )}`
                  : "Sin vuelos recientes registrados."}
              </div>

              <FormSubmitButton label="Guardar piloto" />
            </form>
          ) : (
            <p className="muted">No se encontraron pilotos con ese criterio.</p>
          )}
        </article>
      </section>
    </div>
  );
}
