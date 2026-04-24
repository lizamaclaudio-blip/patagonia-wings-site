import { MetricCard } from "@/components/admin/MetricCard";
import { StatusPill } from "@/components/admin/StatusPill";
import { getDashboardSnapshot } from "@/lib/control-center-data";
import { compactText, formatDateTime, formatScore } from "@/lib/format";

export default async function DashboardPage() {
  const snapshot = await getDashboardSnapshot();

  return (
    <div className="stack gap-lg">
      <section className="section-head">
        <div>
          <span className="page-kicker">Overview</span>
          <h1>Dashboard</h1>
          <p>Métricas rápidas y alertas operativas del ecosistema Patagonia Wings.</p>
        </div>
      </section>

      <section className="metric-grid">
        {snapshot.metrics.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            value={metric.value}
            tone={metric.tone}
          />
        ))}
      </section>

      <section className="content-grid two-columns">
        <article className="panel-card">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Alertas</span>
              <h2>Estado operativo</h2>
            </div>
            <StatusPill tone={snapshot.alerts.length ? "warning" : "success"}>
              {snapshot.alerts.length ? "Revisar" : "OK"}
            </StatusPill>
          </div>

          {snapshot.alerts.length ? (
            <ul className="bullet-list">
              {snapshot.alerts.map((alert) => (
                <li key={alert}>{alert}</li>
              ))}
            </ul>
          ) : (
            <p className="muted">No se detectaron inconsistencias críticas inmediatas.</p>
          )}

          <div className="inline-note">
            <strong>Mensajes/tickets:</strong>{" "}
            {snapshot.pendingSources.ticketsAvailable
              ? "Hay fuente real conectada."
              : "No existe tabla dedicada de tickets/mensajes en el esquema actual."}
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Actividad</span>
              <h2>Vuelos recientes</h2>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reserva</th>
                  <th>Piloto</th>
                  <th>Ruta</th>
                  <th>Estado</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.recentFlights.map((row) => (
                  <tr key={String(row.reservation_code)}>
                    <td>{compactText(row.reservation_code as string | null)}</td>
                    <td>{compactText(row.pilot_callsign as string | null)}</td>
                    <td>
                      {compactText(row.origin_ident as string | null)} →{" "}
                      {compactText(row.destination_ident as string | null)}
                    </td>
                    <td>{compactText(row.status as string | null)}</td>
                    <td>
                      {formatScore(
                        Number(
                          row.performance_score ??
                            row.procedure_score ??
                            Number.NaN
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="muted">
            Última actualización: {formatDateTime(new Date().toISOString())}
          </p>
        </article>
      </section>
    </div>
  );
}
