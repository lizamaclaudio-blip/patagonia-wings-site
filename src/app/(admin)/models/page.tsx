import {
  upsertAircraftModelAction,
  upsertAircraftTypeAction,
  upsertOperationRuleAction,
} from "@/app/(admin)/actions";
import { FormSubmitButton } from "@/components/admin/FormSubmitButton";
import { getModelsData } from "@/lib/control-center-data";
import { compactText } from "@/lib/format";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ModelsPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const modelCode = typeof searchParams.model === "string" ? searchParams.model : "";
  const typeCode = typeof searchParams.type === "string" ? searchParams.type : "";
  const ruleCode = typeof searchParams.rule === "string" ? searchParams.rule : "";
  const saved = typeof searchParams.saved === "string" ? searchParams.saved : "";

  const { models, types, variants, operationRules } = await getModelsData();
  const selectedModel =
    models.find((row) => String(row.code) === modelCode) ?? models[0] ?? null;
  const selectedType =
    types.find((row) => String(row.code) === typeCode) ?? types[0] ?? null;
  const selectedRule =
    operationRules.find((row) => String(row.aircraft_type_code) === ruleCode) ??
    operationRules[0] ??
    null;

  return (
    <div className="stack gap-lg">
      <section className="section-head">
        <div>
          <span className="page-kicker">Catalog</span>
          <h1>Modelos / Tipos de aeronave</h1>
          <p>Catálogo base, tipos simulador y reglas operativas por familia.</p>
        </div>
      </section>

      {saved ? <p className="banner success">Catálogo actualizado.</p> : null}

      <section className="content-grid two-columns">
        <article className="panel-card">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Modelos</span>
              <h2>Aircraft models</h2>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {models.map((row) => (
                  <tr key={String(row.code)}>
                    <td>{String(row.code)}</td>
                    <td>{compactText(row.display_name as string | null)}</td>
                    <td>{compactText(row.display_category as string | null)}</td>
                    <td>
                      <a className="inline-link" href={`/models?model=${String(row.code)}`}>
                        Editar
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form action={upsertAircraftModelAction} className="stack gap-md top-border">
            <div className="grid-two">
              <label className="field">
                <span className="field-label">Código</span>
                <input
                  className="input"
                  name="code"
                  defaultValue={selectedModel ? String(selectedModel.code) : ""}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Fabricante</span>
                <input
                  className="input"
                  name="manufacturer"
                  defaultValue={selectedModel?.manufacturer?.toString() ?? ""}
                />
              </label>
              <label className="field">
                <span className="field-label">Familia</span>
                <input
                  className="input"
                  name="family"
                  defaultValue={selectedModel?.family?.toString() ?? ""}
                />
              </label>
              <label className="field">
                <span className="field-label">Variante</span>
                <input
                  className="input"
                  name="variant_name"
                  defaultValue={selectedModel?.variant_name?.toString() ?? ""}
                />
              </label>
              <label className="field">
                <span className="field-label">Display name</span>
                <input
                  className="input"
                  name="display_name"
                  defaultValue={selectedModel?.display_name?.toString() ?? ""}
                />
              </label>
              <label className="field">
                <span className="field-label">Categoría</span>
                <input
                  className="input"
                  name="category"
                  defaultValue={selectedModel?.category?.toString() ?? ""}
                />
              </label>
              <label className="field">
                <span className="field-label">Display categoría</span>
                <input
                  className="input"
                  name="display_category"
                  defaultValue={selectedModel?.display_category?.toString() ?? ""}
                />
              </label>
              <label className="field">
                <span className="field-label">ICAO</span>
                <input
                  className="input"
                  name="icao_code"
                  defaultValue={selectedModel?.icao_code?.toString() ?? ""}
                />
              </label>
            </div>

            <div className="checkbox-row">
              <label>
                <input
                  type="checkbox"
                  name="is_active"
                  defaultChecked={selectedModel ? Boolean(selectedModel.is_active) : true}
                />{" "}
                Activo
              </label>
            </div>

            <FormSubmitButton label="Guardar modelo" />
          </form>
        </article>

        <article className="panel-card">
          <div className="panel-header">
            <div>
              <span className="section-kicker">Tipos</span>
              <h2>Aircraft types</h2>
            </div>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Provider</th>
                  <th>Sim</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {types.map((row) => (
                  <tr key={String(row.code)}>
                    <td>{String(row.code)}</td>
                    <td>{compactText(row.addon_provider as string | null)}</td>
                    <td>{compactText(row.simulator as string | null)}</td>
                    <td>
                      <a className="inline-link" href={`/models?type=${String(row.code)}`}>
                        Editar
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <form action={upsertAircraftTypeAction} className="stack gap-md top-border">
            <div className="grid-two">
              <label className="field">
                <span className="field-label">Código tipo</span>
                <input
                  className="input"
                  name="code"
                  defaultValue={selectedType ? String(selectedType.code) : ""}
                  required
                />
              </label>
              <label className="field">
                <span className="field-label">Fabricante</span>
                <input
                  className="input"
                  name="manufacturer"
                  defaultValue={selectedType?.manufacturer?.toString() ?? ""}
                />
              </label>
              <label className="field">
                <span className="field-label">Familia</span>
                <input
                  className="input"
                  name="family"
                  defaultValue={selectedType?.family?.toString() ?? ""}
                />
              </label>
              <label className="field">
                <span className="field-label">Variante</span>
                <input
                  className="input"
                  name="variant_name"
                  defaultValue={selectedType?.variant_name?.toString() ?? ""}
                />
              </label>
              <label className="field">
                <span className="field-label">Simulator</span>
                <input
                  className="input"
                  name="simulator"
                  defaultValue={selectedType?.simulator?.toString() ?? ""}
                />
              </label>
              <label className="field">
                <span className="field-label">Addon provider</span>
                <input
                  className="input"
                  name="addon_provider"
                  defaultValue={selectedType?.addon_provider?.toString() ?? ""}
                />
              </label>
              <label className="field">
                <span className="field-label">ICAO equiv</span>
                <input
                  className="input"
                  name="icao_equiv"
                  defaultValue={selectedType?.icao_equiv?.toString() ?? ""}
                />
              </label>
              <label className="field">
                <span className="field-label">Categoría</span>
                <input
                  className="input"
                  name="category"
                  defaultValue={selectedType?.category?.toString() ?? ""}
                />
              </label>
            </div>

            <div className="checkbox-row">
              <label>
                <input
                  type="checkbox"
                  name="is_active"
                  defaultChecked={selectedType ? Boolean(selectedType.is_active) : true}
                />{" "}
                Activo
              </label>
            </div>

            <FormSubmitButton label="Guardar tipo" />
          </form>
        </article>
      </section>

      <section className="panel-card">
        <div className="panel-header">
          <div>
            <span className="section-kicker">Reglas operativas</span>
            <h2>Compatibilidades / planning</h2>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Grupo</th>
                <th>NM min-max</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {operationRules.map((row) => (
                <tr key={String(row.aircraft_type_code)}>
                  <td>{String(row.aircraft_type_code)}</td>
                  <td>{compactText(row.airline_group as string | null)}</td>
                  <td>
                    {compactText(String(row.min_route_nm ?? "--"))} -{" "}
                    {compactText(String(row.max_route_nm ?? "--"))}
                  </td>
                  <td>
                    <a className="inline-link" href={`/models?rule=${String(row.aircraft_type_code)}`}>
                      Editar
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form action={upsertOperationRuleAction} className="stack gap-md top-border">
          <div className="grid-two">
            <label className="field">
              <span className="field-label">Aircraft type code</span>
              <input
                className="input"
                name="aircraft_type_code"
                defaultValue={selectedRule ? String(selectedRule.aircraft_type_code) : ""}
              />
            </label>
            <label className="field">
              <span className="field-label">Airport support</span>
              <input
                className="input"
                name="required_airport_support"
                defaultValue={selectedRule?.required_airport_support?.toString() ?? ""}
              />
            </label>
            <label className="field">
              <span className="field-label">Airline group</span>
              <input
                className="input"
                name="airline_group"
                defaultValue={selectedRule?.airline_group?.toString() ?? ""}
              />
            </label>
            <label className="field">
              <span className="field-label">Cruise kts</span>
              <input
                className="input"
                type="number"
                name="planning_cruise_kts"
                defaultValue={String(selectedRule?.planning_cruise_kts ?? "")}
              />
            </label>
            <label className="field">
              <span className="field-label">NM mínimo</span>
              <input
                className="input"
                type="number"
                name="min_route_nm"
                defaultValue={String(selectedRule?.min_route_nm ?? "")}
              />
            </label>
            <label className="field">
              <span className="field-label">NM máximo</span>
              <input
                className="input"
                type="number"
                name="max_route_nm"
                defaultValue={String(selectedRule?.max_route_nm ?? "")}
              />
            </label>
          </div>
          <div className="checkbox-row">
            <label>
              <input
                type="checkbox"
                name="allow_cross_border"
                defaultChecked={Boolean(selectedRule?.allow_cross_border)}
              />{" "}
              Permite internacional
            </label>
            <label>
              <input
                type="checkbox"
                name="allow_transoceanic"
                defaultChecked={Boolean(selectedRule?.allow_transoceanic)}
              />{" "}
              Permite transoceánico
            </label>
          </div>
          <FormSubmitButton label="Guardar regla operativa" />
        </form>

        <div className="inline-note">
          Variantes registradas: {variants.length}. Las compatibilidades/habilitaciones
          finas por regla/piloto no están totalmente parametrizadas en una sola tabla.
        </div>
      </section>
    </div>
  );
}
