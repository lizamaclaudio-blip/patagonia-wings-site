export type ReglajeAuditCheck = {
  key: string;
  label: string;
  description: string;
  expected: string;
};

export type ReglajeAuditSection = {
  key: string;
  title: string;
  rules: string[];
  checks: ReglajeAuditCheck[];
};

export const reglajeSections: ReglajeAuditSection[] = [
  {
    key: "network",
    title: "Red y tiempos block-to-block",
    rules: [
      "La base mundial de aeropuertos va separada de la red comercial Patagonia Wings.",
      "Las duraciones deben salir de network_route_block_profiles y no de valores inventados en la web.",
      "Cada ruta debe manejar scheduled_block_min, expected_block_p50 y expected_block_p80.",
      "La regla operativa nueva es dejar al menos 30 minutos de tolerancia en salida y llegada para considerar cumplimiento horario.",
    ],
    checks: [
      {
        key: "network_routes",
        label: "network_routes",
        description: "Tabla base de rutas reales Patagonia Wings.",
        expected: "> 0 filas",
      },
      {
        key: "block_profiles",
        label: "network_route_block_profiles",
        description: "Perfiles de block-to-block y buffers reales.",
        expected: "scheduled_block_min / expected_block_p50 / expected_block_p80 disponibles",
      },
      {
        key: "coverage_view",
        label: "v_hub_rank_route_coverage",
        description: "Validación para evitar hubs muertos por rango.",
        expected: "visible_route_count > 0 por hub/rango inicial",
      },
    ],
  },
  {
    key: "career",
    title: "Carrera y score",
    rules: [
      "La carrera separa horas, score de procedimiento y score de valor de misión.",
      "Los nombres vigentes son Pulso 10, Ruta 10 y Legado.",
      "El ascenso no es automático: el piloto solicita cuando cumple gate.",
      "Las horas transferidas suman al total pero no otorgan ascenso automático.",
    ],
    checks: [
      {
        key: "pilot_scores",
        label: "pw_pilot_scores",
        description: "Resumen vivo de Pulso 10 / Ruta 10 / Legado.",
        expected: "1 fila para el piloto operativo",
      },
      {
        key: "promotion_requests",
        label: "pw_rank_promotion_requests",
        description: "Solicitud y aprobación de ascensos.",
        expected: "tabla accesible",
      },
      {
        key: "score_reports",
        label: "pw_flight_score_reports",
        description: "Ledger y scoring por vuelo.",
        expected: "tabla accesible",
      },
    ],
  },
  {
    key: "ops",
    title: "Operación real",
    rules: [
      "Todo hub inicial debe mostrar al menos una ruta visible por rango.",
      "Las reservas operan con hold fijo de 15 minutos y liberación automática.",
      "Piloto y aeronave quedan reposicionados en el destino al cerrar el vuelo.",
      "La numeración visual usa flight_designator y el identificador interno sigue siendo route_code.",
    ],
    checks: [
      {
        key: "active_reservation_rpc",
        label: "pw_get_active_reservation_for_pilot",
        description: "RPC de reserva activa operativa.",
        expected: "responde sin error",
      },
      {
        key: "dispatch_packages",
        label: "dispatch_packages",
        description: "Cadena reserva → dispatch → in_flight → completed.",
        expected: "tabla accesible",
      },
      {
        key: "flight_designator",
        label: "flight_number / flight_designator",
        description: "Numeración comercial en network_routes.",
        expected: "columnas presentes y legibles",
      },
    ],
  },
];
