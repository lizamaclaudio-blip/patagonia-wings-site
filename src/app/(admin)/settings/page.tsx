import {
  updateIntegrationProviderAction,
  upsertAcarsReleaseAction,
} from "@/app/(admin)/actions";
import { FormSubmitButton } from "@/components/admin/FormSubmitButton";
import { getSettingsData } from "@/lib/control-center-data";
import { compactText, formatDate } from "@/lib/format";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SettingsPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const providerCode =
    typeof searchParams.provider === "string" ? searchParams.provider : "";
  const saved = typeof searchParams.saved === "string" ? searchParams.saved : "";

  const { providers, releases, airlines } = await getSettingsData();
  const selectedProvider =
    providers.find((row) => String(row.provider_code) === providerCode) ??
    providers[0] ??
    null;

  return (
    <div className="stack gap-lg">
      <section className="section-head">
        <div>
          <span className="page-kicker">Settings</span>
          <h1>Configuración general</h1>
          <p>Parámetros administrativos reales disponibles hoy en la base.</p>
        </div>
      </section>

      {saved ? <p className="banner success">Configuración actualizada.</p> : null}

      <section className="content-grid two-columns">
        <article className="panel-card">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Integraciones</span>
              <h2>Providers</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Status</th>
                  <th>Auth</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {providers.map((row) => (
                  <tr key={String(row.provider_code)}>
                    <td>{compactText(row.provider_code as string | null)}</td>
                    <td>{compactText(row.status as string | null)}</td>
                    <td>{compactText(row.auth_strategy as string | null)}</td>
                    <td>
                      <a
                        className="inline-link"
                        href={`/settings?provider=${String(row.provider_code)}`}
                      >
                        Editar
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selectedProvider ? (
            <form action={updateIntegrationProviderAction} className="stack gap-md top-border">
              <input
                type="hidden"
                name="provider_code"
                value={String(selectedProvider.provider_code)}
              />
              <div className="grid-two">
                <label className="field">
                  <span className="field-label">Display name</span>
                  <input
                    className="input"
                    name="display_name"
                    defaultValue={selectedProvider.display_name?.toString() ?? ""}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Status</span>
                  <input
                    className="input"
                    name="status"
                    defaultValue={selectedProvider.status?.toString() ?? ""}
                  />
                </label>
                <label className="field">
                  <span className="field-label">Auth strategy</span>
                  <input
                    className="input"
                    name="auth_strategy"
                    defaultValue={selectedProvider.auth_strategy?.toString() ?? ""}
                  />
                </label>
              </div>
              <label className="field">
                <span className="field-label">Notas</span>
                <textarea
                  className="textarea"
                  name="notes"
                  defaultValue={selectedProvider.notes?.toString() ?? ""}
                />
              </label>
              <FormSubmitButton label="Guardar provider" />
            </form>
          ) : null}
        </article>

        <article className="panel-card">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Releases</span>
              <h2>ACARS releases</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Versión</th>
                  <th>Fecha</th>
                  <th>Mandatory</th>
                  <th>Activa</th>
                </tr>
              </thead>
              <tbody>
                {releases.map((row) => (
                  <tr key={String(row.id)}>
                    <td>{compactText(row.version as string | null)}</td>
                    <td>{formatDate(row.release_date as string | null)}</td>
                    <td>{String(Boolean(row.mandatory))}</td>
                    <td>{String(Boolean(row.is_active))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form action={upsertAcarsReleaseAction} className="stack gap-md top-border">
            <div className="grid-two">
              <label className="field">
                <span className="field-label">Versión</span>
                <input className="input" name="version" placeholder="4.0.2" />
              </label>
              <label className="field">
                <span className="field-label">Release date</span>
                <input className="input" type="date" name="release_date" />
              </label>
              <label className="field">
                <span className="field-label">Download URL</span>
                <input className="input" name="download_url" />
              </label>
            </div>
            <div className="checkbox-row">
              <label>
                <input type="checkbox" name="mandatory" /> Mandatory
              </label>
              <label>
                <input type="checkbox" name="is_active" defaultChecked /> Activa
              </label>
            </div>
            <label className="field">
              <span className="field-label">Notas</span>
              <textarea className="textarea" name="notes" />
            </label>
            <FormSubmitButton label="Crear release" />
          </form>
        </article>
      </section>

      <section className="panel-card">
        <div className="panel-header">
          <div>
            <span className="section-kicker">Airlines</span>
            <h2>Branding / referencia</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Código</th>
                <th>Nombre</th>
              </tr>
            </thead>
            <tbody>
              {airlines.map((row, index) => (
                <tr key={String(row.id ?? index)}>
                  <td>{compactText(row.id as string | null)}</td>
                  <td>{compactText(row.code as string | null)}</td>
                  <td>{compactText(row.name as string | null)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
