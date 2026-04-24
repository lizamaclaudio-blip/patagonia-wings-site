import {
  updateHoursTransferRequestAction,
  updatePromotionRequestAction,
} from "@/app/(admin)/actions";
import { FormSubmitButton } from "@/components/admin/FormSubmitButton";
import { getRequestsData } from "@/lib/control-center-data";
import { compactText, formatDateTime, formatNumber } from "@/lib/format";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RequestsPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const transferId =
    typeof searchParams.transfer === "string" ? searchParams.transfer : "";
  const promotionId =
    typeof searchParams.promotion === "string" ? searchParams.promotion : "";
  const saved = typeof searchParams.saved === "string" ? searchParams.saved : "";
  const { hoursTransfers, promotions, messagesAvailable } = await getRequestsData();

  const selectedTransfer =
    hoursTransfers.find((row) => String(row.id) === transferId) ??
    hoursTransfers[0] ??
    null;
  const selectedPromotion =
    promotions.find((row) => String(row.id) === promotionId) ?? promotions[0] ?? null;

  return (
    <div className="stack gap-lg">
      <section className="section-head">
        <div>
          <span className="page-kicker">Inbox</span>
          <h1>Mensajes / Tickets / Solicitudes</h1>
          <p>
            Solicitudes reales disponibles hoy: transferencias de horas y promociones de
            rango.
          </p>
        </div>
      </section>

      {saved ? <p className="banner success">Solicitud actualizada.</p> : null}

      {!messagesAvailable ? (
        <p className="banner info">
          No existe una tabla real dedicada a tickets/mensajes/reportes generales en el
          esquema actual. El módulo queda operativo sobre las solicitudes reales hoy
          disponibles.
        </p>
      ) : null}

      <section className="content-grid two-columns">
        <article className="panel-card">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Hours transfer</span>
              <h2>Solicitudes de transferencia</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Piloto</th>
                  <th>Horas</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {hoursTransfers.map((row) => (
                  <tr key={String(row.id)}>
                    <td>{compactText(row.pilot_callsign as string | null)}</td>
                    <td>{formatNumber(Number(row.requested_hours ?? 0), 1)}</td>
                    <td>{compactText(row.request_status as string | null)}</td>
                    <td>
                      <a
                        className="inline-link"
                        href={`/requests?transfer=${String(row.id)}`}
                      >
                        Revisar
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selectedTransfer ? (
            <form action={updateHoursTransferRequestAction} className="stack gap-md top-border">
              <input type="hidden" name="id" value={String(selectedTransfer.id)} />
              <div className="inline-note">
                {compactText(selectedTransfer.pilot_callsign as string | null)} ·{" "}
                {compactText(selectedTransfer.source_name as string | null)} ·{" "}
                {formatDateTime(selectedTransfer.created_at as string | null)}
              </div>
              <div className="grid-two">
                <label className="field">
                  <span className="field-label">Estado</span>
                  <input
                    className="input"
                    name="request_status"
                    defaultValue={selectedTransfer.request_status?.toString() ?? ""}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Horas solicitadas</span>
                  <input
                    className="input"
                    value={formatNumber(Number(selectedTransfer.requested_hours ?? 0), 1)}
                    readOnly
                  />
                </label>
              </div>
              <label className="field">
                <span className="field-label">Notas</span>
                <textarea
                  className="textarea"
                  name="notes"
                  defaultValue={selectedTransfer.notes?.toString() ?? ""}
                />
              </label>
              <FormSubmitButton label="Guardar transferencia" />
            </form>
          ) : null}
        </article>

        <article className="panel-card">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Promotion requests</span>
              <h2>Solicitudes de promoción</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Piloto</th>
                  <th>Rango actual</th>
                  <th>Solicita</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {promotions.map((row) => (
                  <tr key={String(row.id)}>
                    <td>{compactText(row.pilot_callsign as string | null)}</td>
                    <td>{compactText(row.current_rank_code as string | null)}</td>
                    <td>{compactText(row.requested_rank_code as string | null)}</td>
                    <td>
                      <a
                        className="inline-link"
                        href={`/requests?promotion=${String(row.id)}`}
                      >
                        Revisar
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selectedPromotion ? (
            <form action={updatePromotionRequestAction} className="stack gap-md top-border">
              <input type="hidden" name="id" value={String(selectedPromotion.id)} />
              <div className="inline-note">
                {compactText(selectedPromotion.pilot_callsign as string | null)} ·{" "}
                {compactText(selectedPromotion.current_rank_code as string | null)} →{" "}
                {compactText(selectedPromotion.requested_rank_code as string | null)}
              </div>
              <div className="grid-two">
                <label className="field">
                  <span className="field-label">Estado</span>
                  <input
                    className="input"
                    name="request_status"
                    defaultValue={selectedPromotion.request_status?.toString() ?? ""}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Snapshot horas</span>
                  <input
                    className="input"
                    value={formatNumber(Number(selectedPromotion.snapshot_total_hours ?? 0), 1)}
                    readOnly
                  />
                </label>
              </div>
              <label className="field">
                <span className="field-label">Notas de revisión</span>
                <textarea
                  className="textarea"
                  name="review_notes"
                  defaultValue={selectedPromotion.review_notes?.toString() ?? ""}
                />
              </label>
              <FormSubmitButton label="Guardar promoción" />
            </form>
          ) : null}
        </article>
      </section>
    </div>
  );
}
