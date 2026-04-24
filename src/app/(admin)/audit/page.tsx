import { getAuditData } from "@/lib/control-center-data";
import { compactText, formatDateTime } from "@/lib/format";

export default async function AuditPage() {
  const audit = await getAuditData();

  return (
    <div className="stack gap-lg">
      <section className="section-head">
        <div>
          <span className="page-kicker">Audit</span>
          <h1>Auditoría / Logs</h1>
          <p>Trazabilidad real disponible hoy sobre reservas, movimientos y flight logs.</p>
        </div>
      </section>

      <section className="content-grid two-columns">
        <article className="panel-card">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Reservation audit</span>
              <h2>Eventos ACARS / reserva</h2>
            </div>
          </div>
          <div className="table-wrap tall-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reserva</th>
                  <th>Evento</th>
                  <th>Versión</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {audit.reservationAudit.map((row) => (
                  <tr key={String(row.id)}>
                    <td>{compactText(row.reservation_id as string | null)}</td>
                    <td>{compactText(row.event_type as string | null)}</td>
                    <td>{compactText(row.acars_version as string | null)}</td>
                    <td>{formatDateTime(row.created_at as string | null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Aircraft movements</span>
              <h2>Movimientos de flota</h2>
            </div>
          </div>
          <div className="table-wrap tall-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Avión</th>
                  <th>Desde</th>
                  <th>Hacia</th>
                  <th>Tipo</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {audit.aircraftMovements.map((row) => (
                  <tr key={String(row.id)}>
                    <td>{compactText(row.aircraft_id as string | null)}</td>
                    <td>{compactText(row.from_icao as string | null)}</td>
                    <td>{compactText(row.to_icao as string | null)}</td>
                    <td>{compactText(row.movement_type as string | null)}</td>
                    <td>{formatDateTime(row.created_at as string | null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="panel-card">
        <div className="panel-header">
          <div>
            <span className="section-kicker">Flight logs</span>
            <h2>Últimos logs</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Vuelo</th>
                <th>Origen</th>
                <th>Destino</th>
                <th>Estado</th>
                <th>Inicio</th>
                <th>Fin</th>
              </tr>
            </thead>
            <tbody>
              {audit.flightLogs.map((row) => (
                <tr key={String(row.id)}>
                  <td>{compactText(row.flight_number as string | null)}</td>
                  <td>{compactText(row.origin_icao as string | null)}</td>
                  <td>{compactText(row.destination_icao as string | null)}</td>
                  <td>{compactText(row.status as string | null)}</td>
                  <td>{formatDateTime(row.started_at as string | null)}</td>
                  <td>{formatDateTime(row.completed_at as string | null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
