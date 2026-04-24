import { upsertHubAction } from "@/app/(admin)/actions";
import { FormSubmitButton } from "@/components/admin/FormSubmitButton";
import { StatusPill } from "@/components/admin/StatusPill";
import { getHubs } from "@/lib/control-center-data";
import { compactText } from "@/lib/format";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function HubsPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const edit = typeof searchParams.edit === "string" ? searchParams.edit : "";
  const saved = typeof searchParams.saved === "string" ? searchParams.saved : "";
  const hubs = await getHubs();
  const selectedHub =
    hubs.find((hub) => String(hub.hub_code) === edit) ?? hubs[0] ?? null;

  return (
    <div className="stack gap-lg">
      <section className="section-head">
        <div>
          <span className="page-kicker">Network</span>
          <h1>Hubs</h1>
          <p>Gestión de hubs, cobertura de pilotos y distribución de flota.</p>
        </div>
      </section>

      {saved ? <p className="banner success">Hub guardado correctamente.</p> : null}

      <section className="content-grid two-columns">
        <article className="panel-card">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Listado</span>
              <h2>Hubs Patagonia Wings</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hub</th>
                  <th>Ciudad</th>
                  <th>Pilotos</th>
                  <th>Flota base</th>
                  <th>Flota presente</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {hubs.map((hub) => (
                  <tr key={String(hub.hub_code)}>
                    <td>{compactText(hub.hub_code as string | null)}</td>
                    <td>{compactText(hub.city_name as string | null)}</td>
                    <td>{String(hub.pilot_count)}</td>
                    <td>{String(hub.aircraft_count)}</td>
                    <td>{String(hub.aircraft_here_count)}</td>
                    <td>
                      <a className="inline-link" href={`/hubs?edit=${String(hub.hub_code)}`}>
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
              <h2>{selectedHub ? String(selectedHub.hub_code) : "Nuevo hub"}</h2>
            </div>
            {selectedHub ? (
              <StatusPill tone={Boolean(selectedHub.is_active) ? "success" : "warning"}>
                {Boolean(selectedHub.is_active) ? "Activo" : "Inactivo"}
              </StatusPill>
            ) : null}
          </div>

          <form action={upsertHubAction} className="stack gap-md">
            <div className="grid-two">
              <label className="field">
                <span className="field-label">Código hub</span>
                <input
                  className="input"
                  name="hub_code"
                  defaultValue={selectedHub ? String(selectedHub.hub_code) : ""}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">ICAO</span>
                <input
                  className="input"
                  name="airport_ident"
                  defaultValue={selectedHub ? String(selectedHub.airport_ident) : ""}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Nombre</span>
                <input
                  className="input"
                  name="hub_name"
                  defaultValue={selectedHub ? String(selectedHub.hub_name) : ""}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Ciudad</span>
                <input
                  className="input"
                  name="city_name"
                  defaultValue={selectedHub ? String(selectedHub.city_name) : ""}
                />
              </label>
              <label className="field">
                <span className="field-label">País</span>
                <input
                  className="input"
                  name="country_name"
                  defaultValue={selectedHub ? String(selectedHub.country_name) : ""}
                />
              </label>
              <label className="field">
                <span className="field-label">Orden</span>
                <input
                  className="input"
                  type="number"
                  name="sort_order"
                  defaultValue={selectedHub ? String(selectedHub.sort_order) : "0"}
                />
              </label>
            </div>

            <div className="checkbox-row">
              <label>
                <input
                  type="checkbox"
                  name="is_primary"
                  defaultChecked={Boolean(selectedHub?.is_primary)}
                />{" "}
                Hub principal
              </label>
              <label>
                <input
                  type="checkbox"
                  name="is_active"
                  defaultChecked={selectedHub ? Boolean(selectedHub.is_active) : true}
                />{" "}
                Activo
              </label>
            </div>

            {selectedHub ? (
              <div className="inline-note">
                Pilotos base: {String(selectedHub.pilot_count)} · Flota base:{" "}
                {String(selectedHub.aircraft_count)} · Gap: {String(selectedHub.aircraft_gap)}
              </div>
            ) : null}

            <FormSubmitButton label={selectedHub ? "Guardar hub" : "Crear hub"} />
          </form>
        </article>
      </section>
    </div>
  );
}
