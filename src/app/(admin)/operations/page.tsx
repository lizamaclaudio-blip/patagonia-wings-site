import { updateReservationAction } from "@/app/(admin)/actions";
import { FormSubmitButton } from "@/components/admin/FormSubmitButton";
import { StatusPill } from "@/components/admin/StatusPill";
import { getOperationsData } from "@/lib/control-center-data";
import { compactText, formatDateTime, formatScore } from "@/lib/format";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function OperationsPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const status = typeof searchParams.status === "string" ? searchParams.status : "all";
  const query = typeof searchParams.q === "string" ? searchParams.q : "";
  const edit = typeof searchParams.edit === "string" ? searchParams.edit : "";
  const saved = typeof searchParams.saved === "string" ? searchParams.saved : "";

  const operations = await getOperationsData(status, query);
  const selected =
    operations.find((row) => String(row.id) === edit) ?? operations[0] ?? null;

  return (
    <div className="stack gap-lg">
      <section className="section-head">
        <div>
          <span className="page-kicker">Flight Ops</span>
          <h1>Reservas / Despachos / Vuelos</h1>
          <p>Reserva, despacho, score y consistencia entre piloto, avión y ruta.</p>
        </div>

        <form className="toolbar-form toolbar-grid" method="get">
          <input
            className="input"
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Buscar reserva, piloto, matrícula o ruta"
          />
          <select className="input" name="status" defaultValue={status}>
            <option value="all">Todos los estados</option>
            <option value="reserved">reserved</option>
            <option value="dispatched">dispatched</option>
            <option value="in_progress">in_progress</option>
            <option value="completed">completed</option>
            <option value="cancelled">cancelled</option>
            <option value="aborted">aborted</option>
            <option value="crashed">crashed</option>
          </select>
          <button className="button button-secondary" type="submit">
            Filtrar
          </button>
        </form>
      </section>

      {saved ? <p className="banner success">Reserva actualizada.</p> : null}

      <section className="content-grid two-columns">
        <article className="panel-card">
          <div className="table-wrap tall-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reserva</th>
                  <th>Piloto</th>
                  <th>Avión</th>
                  <th>Ruta</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {operations.map((row) => (
                  <tr key={String(row.id)}>
                    <td>{compactText(row.reservation_code as string | null)}</td>
                    <td>{compactText(row.pilot_callsign as string | null)}</td>
                    <td>{compactText(row.aircraft_registration as string | null)}</td>
                    <td>
                      {compactText(row.origin_ident as string | null)} →{" "}
                      {compactText(row.destination_ident as string | null)}
                    </td>
                    <td>
                      <StatusPill tone={Boolean(row.location_mismatch) ? "warning" : "default"}>
                        {compactText(row.status as string | null)}
                      </StatusPill>
                    </td>
                    <td>
                      <a className="inline-link" href={`/operations?edit=${String(row.id)}`}>
                        Revisar
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
              <span className="section-kicker">Inspector</span>
              <h2>{selected ? compactText(selected.reservation_code as string | null) : "--"}</h2>
            </div>
          </div>

          {selected ? (
            <form action={updateReservationAction} className="stack gap-md">
              <input type="hidden" name="id" value={String(selected.id)} />

              <div className="grid-two">
                <label className="field">
                  <span className="field-label">Piloto</span>
                  <input
                    className="input"
                    value={compactText(selected.pilot_callsign as string | null)}
                    readOnly
                  />
                </label>
                <label className="field">
                  <span className="field-label">Reserva</span>
                  <input
                    className="input"
                    value={compactText(selected.reservation_code as string | null)}
                    readOnly
                  />
                </label>
                <label className="field">
                  <span className="field-label">Matrícula</span>
                  <input
                    className="input"
                    name="aircraft_registration"
                    defaultValue={selected.aircraft_registration?.toString() ?? ""}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Estado</span>
                  <input
                    className="input"
                    name="status"
                    defaultValue={selected.status?.toString() ?? ""}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Origen</span>
                  <input
                    className="input"
                    value={compactText(selected.origin_ident as string | null)}
                    readOnly
                  />
                </label>
                <label className="field">
                  <span className="field-label">Destino</span>
                  <input
                    className="input"
                    name="destination_ident"
                    defaultValue={selected.destination_ident?.toString() ?? ""}
                  />
                </label>
              </div>

              <div className="inline-note">
                Despacho: {compactText(selected.dispatch?.dispatch_status as string | null)} ·
                Fuente: {compactText(selected.dispatch?.dispatch_source as string | null)} ·
                Score:{" "}
                {formatScore(
                  Number(
                    selected.score_report?.performance_score ??
                      selected.performance_score ??
                      Number.NaN
                  )
                )}
              </div>

              {selected.location_mismatch ? (
                <p className="banner warning">
                  Inconsistencia: la ubicación actual del avión no coincide con el origen
                  esperado de esta reserva.
                </p>
              ) : null}

              <div className="inline-note">
                Dispatched: {formatDateTime(selected.dispatched_at as string | null)} ·
                Completed: {formatDateTime(selected.completed_at as string | null)}
              </div>

              <FormSubmitButton label="Guardar reserva" />
            </form>
          ) : (
            <p className="muted">No hay reservas para el filtro seleccionado.</p>
          )}
        </article>
      </section>
    </div>
  );
}
