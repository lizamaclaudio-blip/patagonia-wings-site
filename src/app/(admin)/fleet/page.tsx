import { returnAircraftHomeAction, upsertAircraftAction } from "@/app/(admin)/actions";
import { FormSubmitButton } from "@/components/admin/FormSubmitButton";
import { getFleet, getHubs } from "@/lib/control-center-data";
import { compactText, formatDateTime } from "@/lib/format";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function FleetPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const query = typeof searchParams.q === "string" ? searchParams.q : "";
  const status = typeof searchParams.status === "string" ? searchParams.status : "all";
  const hub = typeof searchParams.hub === "string" ? searchParams.hub : "all";
  const edit = typeof searchParams.edit === "string" ? searchParams.edit : "";
  const saved = typeof searchParams.saved === "string" ? searchParams.saved : "";

  const [fleet, hubs] = await Promise.all([getFleet(query, status, hub), getHubs()]);
  const selectedAircraft =
    fleet.find((row) => String(row.id) === edit) ?? fleet[0] ?? null;

  return (
    <div className="stack gap-lg">
      <section className="section-head">
        <div>
          <span className="page-kicker">Fleet Ops</span>
          <h1>Flota / Aeronaves</h1>
          <p>Control de matrícula, hub base, ubicación, estado y mantenimiento.</p>
        </div>

        <form className="toolbar-form toolbar-grid" method="get">
          <input
            className="input"
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Buscar matrícula, tipo o variante"
          />
          <select className="input" name="hub" defaultValue={hub}>
            <option value="all">Todos los hubs</option>
            {hubs.map((item) => (
              <option key={String(item.hub_code)} value={String(item.hub_code)}>
                {String(item.hub_code)}
              </option>
            ))}
          </select>
          <select className="input" name="status" defaultValue={status}>
            <option value="all">Todos los estados</option>
            <option value="available">available</option>
            <option value="maintenance">maintenance</option>
            <option value="assigned">assigned</option>
            <option value="out_of_service">out_of_service</option>
          </select>
          <button className="button button-secondary" type="submit">
            Filtrar
          </button>
        </form>
      </section>

      {saved ? <p className="banner success">Flota actualizada.</p> : null}

      <section className="content-grid two-columns">
        <article className="panel-card">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Listado</span>
              <h2>Flota activa</h2>
            </div>
          </div>

          <div className="table-wrap tall-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Matrícula</th>
                  <th>Tipo</th>
                  <th>Hub</th>
                  <th>Ubicación</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {fleet.map((row) => (
                  <tr key={String(row.id)}>
                    <td>{compactText(row.registration as string | null)}</td>
                    <td>{compactText(row.aircraft_type as string | null)}</td>
                    <td>{compactText(row.home_hub_icao as string | null)}</td>
                    <td>{compactText(row.current_airport_icao as string | null)}</td>
                    <td>{compactText(row.status as string | null)}</td>
                    <td>
                      <a className="inline-link" href={`/fleet?edit=${String(row.id)}`}>
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
                {selectedAircraft
                  ? compactText(selectedAircraft.registration as string | null)
                  : "Sin selección"}
              </h2>
            </div>
          </div>

          {selectedAircraft ? (
            <>
              <form action={upsertAircraftAction} className="stack gap-md">
                <input type="hidden" name="id" value={String(selectedAircraft.id)} />

                <div className="grid-two">
                  <label className="field">
                    <span className="field-label">Matrícula</span>
                    <input
                      className="input"
                      name="registration"
                      defaultValue={selectedAircraft.registration?.toString() ?? ""}
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Estado operativo</span>
                    <input
                      className="input"
                      name="status"
                      defaultValue={selectedAircraft.status?.toString() ?? ""}
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Hub base</span>
                    <select
                      className="input"
                      name="home_hub_icao"
                      defaultValue={compactText(selectedAircraft.home_hub_icao as string | null)}
                    >
                      {hubs.map((item) => (
                        <option key={String(item.hub_code)} value={String(item.hub_code)}>
                          {String(item.hub_code)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span className="field-label">Ubicación actual</span>
                    <input
                      className="input"
                      name="current_airport_icao"
                      defaultValue={selectedAircraft.current_airport_icao?.toString() ?? ""}
                    />
                  </label>
                </div>

                <div className="grid-two">
                  <label className="field">
                    <span className="field-label">Último piloto</span>
                    <input
                      className="input"
                      value={compactText(selectedAircraft.last_pilot_callsign as string | null)}
                      readOnly
                    />
                  </label>
                  <label className="field">
                    <span className="field-label">Último vuelo</span>
                    <input
                      className="input"
                      value={compactText(
                        selectedAircraft.last_flight?.flight_number as string | null
                      )}
                      readOnly
                    />
                  </label>
                </div>

                <div className="checkbox-row">
                  <label>
                    <input
                      type="checkbox"
                      name="maintenance_required"
                      defaultChecked={Boolean(
                        selectedAircraft.condition?.maintenance_required
                      )}
                    />{" "}
                    En mantenimiento
                  </label>
                </div>

                <label className="field">
                  <span className="field-label">Motivo mantenimiento</span>
                  <textarea
                    className="textarea"
                    name="maintenance_reason"
                    defaultValue={selectedAircraft.condition?.maintenance_reason?.toString() ?? ""}
                  />
                </label>

                <div className="inline-note">
                  Último mantenimiento:{" "}
                  {formatDateTime(
                    selectedAircraft.condition?.last_maintenance_at as string | null
                  )}
                </div>

                <FormSubmitButton label="Guardar aeronave" />
              </form>

              <form action={returnAircraftHomeAction}>
                <input type="hidden" name="id" value={String(selectedAircraft.id)} />
                <input
                  type="hidden"
                  name="home_hub_icao"
                  value={compactText(selectedAircraft.home_hub_icao as string | null)}
                />
                <FormSubmitButton
                  label="Devolver a su hub"
                  busyLabel="Devolviendo..."
                  variant="secondary"
                />
              </form>
            </>
          ) : (
            <p className="muted">No se encontraron aeronaves con ese filtro.</p>
          )}
        </article>
      </section>
    </div>
  );
}
