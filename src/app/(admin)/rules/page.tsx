import {
  upsertDamageRuleAction,
  upsertFlightModeAction,
  upsertOperationRuleAction,
} from "@/app/(admin)/actions";
import { FormSubmitButton } from "@/components/admin/FormSubmitButton";
import { getRulesData } from "@/lib/control-center-data";
import { compactText, formatDateTime, formatScore } from "@/lib/format";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RulesPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const modeCode = typeof searchParams.mode === "string" ? searchParams.mode : "";
  const damageCode = typeof searchParams.damage === "string" ? searchParams.damage : "";
  const saved = typeof searchParams.saved === "string" ? searchParams.saved : "";

  const { flightModes, operationRules, damageRules, scoreReports } =
    await getRulesData();

  const selectedMode =
    flightModes.find((row) => String(row.code) === modeCode) ?? flightModes[0] ?? null;
  const selectedDamage =
    damageRules.find((row) => String(row.event_code) === damageCode) ??
    damageRules[0] ??
    null;

  return (
    <div className="stack gap-lg">
      <section className="section-head">
        <div>
          <span className="page-kicker">Scoring</span>
          <h1>Reglaje / Reglas / Scoring</h1>
          <p>
            Lectura y parametrización parcial real del scoring disponible hoy en Supabase.
          </p>
        </div>
      </section>

      {saved ? <p className="banner success">Reglaje actualizado.</p> : null}

      <p className="banner info">
        No existe aún una tabla única, completa y 100% parametrizada por fase/regla para todo
        el reglaje Patagonia Wings. Este módulo expone y edita la capa real disponible hoy:
        flight modes, operation rules, damage rules y score reports.
      </p>

      <section className="content-grid two-columns">
        <article className="panel-card">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Flight modes</span>
              <h2>Modos de vuelo</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Horas</th>
                  <th>Score</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {flightModes.map((row) => (
                  <tr key={String(row.code)}>
                    <td>{String(row.code)}</td>
                    <td>{compactText(row.name as string | null)}</td>
                    <td>{String(Boolean(row.counts_hours))}</td>
                    <td>{String(Boolean(row.counts_for_scores))}</td>
                    <td>
                      <a className="inline-link" href={`/rules?mode=${String(row.code)}`}>
                        Editar
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form action={upsertFlightModeAction} className="stack gap-md top-border">
            <div className="grid-two">
              <label className="field">
                <span className="field-label">Código</span>
                <input
                  className="input"
                  name="code"
                  defaultValue={selectedMode ? String(selectedMode.code) : ""}
                />
              </label>
              <label className="field">
                <span className="field-label">Nombre</span>
                <input
                  className="input"
                  name="name"
                  defaultValue={selectedMode?.name?.toString() ?? ""}
                />
              </label>
            </div>
            <div className="checkbox-row">
              <label>
                <input
                  type="checkbox"
                  name="counts_hours"
                  defaultChecked={Boolean(selectedMode?.counts_hours)}
                />{" "}
                Cuenta horas
              </label>
              <label>
                <input
                  type="checkbox"
                  name="counts_for_scores"
                  defaultChecked={Boolean(selectedMode?.counts_for_scores)}
                />{" "}
                Cuenta para scores
              </label>
              <label>
                <input
                  type="checkbox"
                  name="moves_real_pilot_position"
                  defaultChecked={Boolean(selectedMode?.moves_real_pilot_position)}
                />{" "}
                Mueve piloto
              </label>
            </div>
            <label className="field">
              <span className="field-label">Notas</span>
              <textarea
                className="textarea"
                name="notes"
                defaultValue={selectedMode?.notes?.toString() ?? ""}
              />
            </label>
            <FormSubmitButton label="Guardar modo" />
          </form>
        </article>

        <article className="panel-card">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Damage rules</span>
              <h2>Damage rule catalog</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Evento</th>
                  <th>Componente</th>
                  <th>Daño</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {damageRules.map((row) => (
                  <tr key={String(row.event_code)}>
                    <td>{String(row.event_code)}</td>
                    <td>{compactText(row.component as string | null)}</td>
                    <td>{compactText(String(row.base_damage ?? "--"))}</td>
                    <td>
                      <a className="inline-link" href={`/rules?damage=${String(row.event_code)}`}>
                        Editar
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <form action={upsertDamageRuleAction} className="stack gap-md top-border">
            <div className="grid-two">
              <label className="field">
                <span className="field-label">Event code</span>
                <input
                  className="input"
                  name="event_code"
                  defaultValue={selectedDamage ? String(selectedDamage.event_code) : ""}
                />
              </label>
              <label className="field">
                <span className="field-label">Component</span>
                <input
                  className="input"
                  name="component"
                  defaultValue={selectedDamage?.component?.toString() ?? ""}
                />
              </label>
              <label className="field">
                <span className="field-label">Base damage</span>
                <input
                  className="input"
                  type="number"
                  step="0.1"
                  name="base_damage"
                  defaultValue={String(selectedDamage?.base_damage ?? "")}
                />
              </label>
            </div>
            <div className="checkbox-row">
              <label>
                <input
                  type="checkbox"
                  name="default_send_to_maintenance"
                  defaultChecked={Boolean(selectedDamage?.default_send_to_maintenance)}
                />{" "}
                Envía a mantenimiento por defecto
              </label>
            </div>
            <label className="field">
              <span className="field-label">Descripción</span>
              <textarea
                className="textarea"
                name="description"
                defaultValue={selectedDamage?.description?.toString() ?? ""}
              />
            </label>
            <FormSubmitButton label="Guardar damage rule" />
          </form>
        </article>
      </section>

      <section className="content-grid two-columns">
        <article className="panel-card">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Operation rules</span>
              <h2>Reglas operativas por tipo</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Grupo</th>
                  <th>NM</th>
                </tr>
              </thead>
              <tbody>
                {operationRules.slice(0, 12).map((row) => (
                  <tr key={String(row.aircraft_type_code)}>
                    <td>{String(row.aircraft_type_code)}</td>
                    <td>{compactText(row.airline_group as string | null)}</td>
                    <td>
                      {compactText(String(row.min_route_nm ?? "--"))} -{" "}
                      {compactText(String(row.max_route_nm ?? "--"))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="top-border">
            <form action={upsertOperationRuleAction} className="stack gap-md">
              <div className="grid-two">
                <label className="field">
                  <span className="field-label">Aircraft type code</span>
                  <input className="input" name="aircraft_type_code" />
                </label>
                <label className="field">
                  <span className="field-label">Airport support</span>
                  <input className="input" name="required_airport_support" />
                </label>
              </div>
              <FormSubmitButton label="Guardar op rule" />
            </form>
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Recent scores</span>
              <h2>Reportes recientes</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Piloto</th>
                  <th>Ruta</th>
                  <th>Procedure</th>
                  <th>Performance</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {scoreReports.map((row) => (
                  <tr key={String(row.reservation_id)}>
                    <td>{compactText(row.pilot_callsign as string | null)}</td>
                    <td>{compactText(row.route_code as string | null)}</td>
                    <td>{formatScore(Number(row.procedure_score ?? Number.NaN))}</td>
                    <td>{formatScore(Number(row.performance_score ?? Number.NaN))}</td>
                    <td>{formatDateTime(row.scored_at as string | null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </div>
  );
}
