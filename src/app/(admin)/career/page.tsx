import { getCareerData } from "@/lib/control-center-data";
import { compactText, formatNumber } from "@/lib/format";

function getRequirementNumber(value: unknown, digits = 0) {
  if (typeof value === "number") return formatNumber(value, digits);
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? formatNumber(parsed, digits) : value;
  }
  return "--";
}

export default async function CareerPage() {
  const { ranks, toursConfigured, rawCounts } = await getCareerData();
  const seeded = rawCounts.requirements > 0 || rawCounts.theoryCatalog > 0 || rawCounts.qualificationCatalog > 0;

  return (
    <div className="stack gap-lg">
      <section className="section-head">
        <div>
          <span className="page-kicker">Career ladder</span>
          <h1>Carrera / Licencias / Ascensos</h1>
          <p>
            Vista de control para los 10 rangos, aeronaves habilitadas, teoría, habilitaciones especiales y umbrales mínimos de ascenso.
          </p>
        </div>
      </section>

      {seeded ? (
        <p className="banner success">
          Configuración detectada. Los tours quedan preparados pero ocultos hasta publicarlos.
        </p>
      ) : (
        <p className="banner warning">
          Aún no existe la nueva capa de carrera en la base. Ejecuta primero el SQL del pack para ver esta página completa.
        </p>
      )}

      <p className="banner info">
        Tours publicados: {toursConfigured ? "Sí" : "No"}. Estado esperado actual: no visibles al usuario final, pero ya configurables desde base de datos.
      </p>

      <section className="career-ladder">
        {ranks.map(({ rank, requirement, aircraft, theoryModules, specialQualifications }) => (
          <article key={String(rank.code)} className="panel-card career-card">
            <div className="panel-header career-card-head">
              <div>
                <span className="section-kicker">Licencia regular</span>
                <h2>
                  {String(rank.name ?? rank.code)}
                </h2>
                <p className="muted">
                  {compactText((requirement?.objective as string | null) ?? null)}
                </p>
              </div>
              <div className="career-rank-badges">
                <span className="status-pill">Orden {String(rank.sort_order ?? "--")}</span>
                <span className="status-pill">{String(rank.code)}</span>
              </div>
            </div>

            <div className="career-grid">
              <div className="career-block">
                <h3>Objetivos para ascender</h3>
                <ul className="bullet-list">
                  <li>Horas mínimas: {getRequirementNumber(requirement?.min_total_hours)}</li>
                  <li>Vuelos mínimos: {getRequirementNumber(requirement?.min_completed_flights)}</li>
                  <li>Promedio mínimo: {getRequirementNumber(requirement?.min_average_score, 1)}</li>
                  <li>Promedio últimas 10: {getRequirementNumber(requirement?.min_last10_average_score, 1)}</li>
                </ul>
              </div>

              <div className="career-block">
                <h3>Requisitos</h3>
                <ul className="bullet-list">
                  <li>Teóricos requeridos: {getRequirementNumber(requirement?.min_theory_passed)}</li>
                  <li>Habilitaciones especiales: {getRequirementNumber(requirement?.min_special_qualifications)}</li>
                  <li>Checkride: {Boolean(requirement?.require_checkride) ? "Sí" : "No"}</li>
                  <li>Examen teórico: {Boolean(requirement?.require_theory_exam) ? "Sí" : "No"}</li>
                </ul>
              </div>
            </div>

            <div className="career-grid">
              <div className="career-block">
                <h3>Aeronaves disponibles / habilitadas</h3>
                <div className="pill-wrap">
                  {aircraft.length ? (
                    aircraft.map((item) => (
                      <span key={String(item.code)} className="status-pill tone-success">
                        {String(item.code)} · {compactText(item.variant_name as string | null)}
                      </span>
                    ))
                  ) : (
                    <span className="muted">Sin aeronaves configuradas.</span>
                  )}
                </div>
              </div>

              <div className="career-block">
                <h3>Habilitaciones especiales</h3>
                <div className="pill-wrap">
                  {specialQualifications.length ? (
                    specialQualifications.map((item) => (
                      <span key={String(item.code)} className="status-pill">
                        {String(item.name ?? item.code)}
                      </span>
                    ))
                  ) : (
                    <span className="muted">Sin habilitaciones especiales.</span>
                  )}
                </div>
              </div>
            </div>

            <div className="career-block top-border">
              <h3>Certificaciones teóricas</h3>
              <div className="pill-wrap">
                {theoryModules.length ? (
                  theoryModules.map((item) => (
                    <span key={String(item.code)} className="status-pill tone-warning">
                      {String(item.title ?? item.code)}
                    </span>
                  ))
                ) : (
                  <span className="muted">Sin teoría configurada.</span>
                )}
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
