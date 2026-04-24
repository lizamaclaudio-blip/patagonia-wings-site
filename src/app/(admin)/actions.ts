"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { requireAdminContext } from "@/lib/auth/access";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

function getString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getNullableString(formData: FormData, key: string) {
  const value = getString(formData, key);
  return value.length ? value : null;
}

function getNumber(formData: FormData, key: string) {
  const value = getString(formData, key);
  if (!value.length) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function getBoolean(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function getStatusRedirect(basePath: string, suffix: string) {
  return `${basePath}${basePath.includes("?") ? "&" : "?"}${suffix}`;
}

export async function updatePilotAction(formData: FormData) {
  await requireAdminContext();
  const admin = createAdminSupabaseClient();

  const id = getString(formData, "id");
  const callsign = getString(formData, "callsign");

  await admin
    .from("pilot_profiles")
    .update({
      first_name: getNullableString(formData, "first_name"),
      last_name: getNullableString(formData, "last_name"),
      base_hub: getNullableString(formData, "base_hub"),
      current_airport_icao: getNullableString(formData, "current_airport_icao"),
      rank_code: getNullableString(formData, "rank_code"),
      career_rank_code: getNullableString(formData, "career_rank_code"),
      total_hours: getNumber(formData, "total_hours"),
      career_hours: getNumber(formData, "career_hours"),
      transferred_hours: getNumber(formData, "transferred_hours"),
      status: getNullableString(formData, "status"),
      is_active: getBoolean(formData, "is_active"),
      active_qualifications: getNullableString(formData, "active_qualifications"),
      active_certifications: getNullableString(formData, "active_certifications"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (callsign) {
    await admin
      .from("pilot_accounts")
      .update({
        access_enabled: getBoolean(formData, "access_enabled") ? 1 : 0,
      })
      .eq("callsign", callsign);
  }

  revalidatePath("/pilots");
  redirect(getStatusRedirect(`/pilots?edit=${id}`, "saved=pilot"));
}

export async function upsertHubAction(formData: FormData) {
  await requireAdminContext();
  const admin = createAdminSupabaseClient();

  const hubCode = getString(formData, "hub_code").toUpperCase();

  await admin.from("pw_hubs").upsert(
    {
      hub_code: hubCode,
      airport_ident: getString(formData, "airport_ident").toUpperCase(),
      hub_name: getString(formData, "hub_name"),
      city_name: getNullableString(formData, "city_name"),
      country_name: getNullableString(formData, "country_name"),
      is_primary: getBoolean(formData, "is_primary"),
      is_active: getBoolean(formData, "is_active"),
      sort_order: getNumber(formData, "sort_order") ?? 0,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "hub_code" }
  );

  revalidatePath("/hubs");
  redirect(getStatusRedirect(`/hubs?edit=${hubCode}`, "saved=hub"));
}

export async function upsertAircraftAction(formData: FormData) {
  await requireAdminContext();
  const admin = createAdminSupabaseClient();

  const id = getString(formData, "id");

  await admin
    .from("aircraft_fleet")
    .update({
      registration: getString(formData, "registration").toUpperCase(),
      home_hub_icao: getNullableString(formData, "home_hub_icao")?.toUpperCase(),
      current_airport_icao: getNullableString(
        formData,
        "current_airport_icao"
      )?.toUpperCase(),
      status: getNullableString(formData, "status"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  await admin.from("aircraft_condition").upsert(
    {
      aircraft_id: id,
      maintenance_required: getBoolean(formData, "maintenance_required"),
      maintenance_reason: getNullableString(formData, "maintenance_reason"),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "aircraft_id" }
  );

  revalidatePath("/fleet");
  redirect(getStatusRedirect(`/fleet?edit=${id}`, "saved=aircraft"));
}

export async function returnAircraftHomeAction(formData: FormData) {
  await requireAdminContext();
  const admin = createAdminSupabaseClient();

  const id = getString(formData, "id");
  const homeHub = getString(formData, "home_hub_icao").toUpperCase();

  await admin
    .from("aircraft_fleet")
    .update({
      current_airport_icao: homeHub,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath("/fleet");
  redirect(getStatusRedirect(`/fleet?edit=${id}`, "saved=returned"));
}

export async function upsertAircraftModelAction(formData: FormData) {
  await requireAdminContext();
  const admin = createAdminSupabaseClient();

  const code = getString(formData, "code").toUpperCase();

  await admin.from("aircraft_models").upsert(
    {
      code,
      manufacturer: getNullableString(formData, "manufacturer"),
      family: getNullableString(formData, "family"),
      variant_name: getNullableString(formData, "variant_name"),
      display_name: getNullableString(formData, "display_name"),
      icao_code: getNullableString(formData, "icao_code"),
      airframe_code: getNullableString(formData, "airframe_code"),
      category: getNullableString(formData, "category"),
      engine_layout: getNullableString(formData, "engine_layout"),
      propulsion: getNullableString(formData, "propulsion"),
      display_category: getNullableString(formData, "display_category"),
      is_active: getBoolean(formData, "is_active"),
    },
    { onConflict: "code" }
  );

  revalidatePath("/models");
  redirect(getStatusRedirect(`/models?model=${code}`, "saved=model"));
}

export async function upsertAircraftTypeAction(formData: FormData) {
  await requireAdminContext();
  const admin = createAdminSupabaseClient();

  const code = getString(formData, "code").toUpperCase();

  await admin.from("aircraft_types").upsert(
    {
      code,
      manufacturer: getNullableString(formData, "manufacturer"),
      family: getNullableString(formData, "family"),
      variant_name: getNullableString(formData, "variant_name"),
      simulator: getNullableString(formData, "simulator"),
      addon_provider: getNullableString(formData, "addon_provider"),
      icao_equiv: getNullableString(formData, "icao_equiv"),
      category: getNullableString(formData, "category"),
      sort_order: getNumber(formData, "sort_order") ?? 0,
      is_active: getBoolean(formData, "is_active"),
    },
    { onConflict: "code" }
  );

  revalidatePath("/models");
  redirect(getStatusRedirect(`/models?type=${code}`, "saved=type"));
}

export async function upsertOperationRuleAction(formData: FormData) {
  await requireAdminContext();
  const admin = createAdminSupabaseClient();

  const aircraftTypeCode = getString(formData, "aircraft_type_code").toUpperCase();

  await admin.from("aircraft_type_operation_rules").upsert(
    {
      aircraft_type_code: aircraftTypeCode,
      required_airport_support: getNullableString(
        formData,
        "required_airport_support"
      ),
      airline_group: getNullableString(formData, "airline_group"),
      min_route_nm: getNumber(formData, "min_route_nm"),
      max_route_nm: getNumber(formData, "max_route_nm"),
      allow_cross_border: getBoolean(formData, "allow_cross_border"),
      allow_transoceanic: getBoolean(formData, "allow_transoceanic"),
      planning_cruise_kts: getNumber(formData, "planning_cruise_kts"),
      climb_descent_buffer_min: getNumber(formData, "climb_descent_buffer_min"),
      taxi_out_avg_min: getNumber(formData, "taxi_out_avg_min"),
      taxi_in_avg_min: getNumber(formData, "taxi_in_avg_min"),
      schedule_pad_min: getNumber(formData, "schedule_pad_min"),
      turnaround_min: getNumber(formData, "turnaround_min"),
    },
    { onConflict: "aircraft_type_code" }
  );

  revalidatePath("/models");
  revalidatePath("/rules");
  redirect(getStatusRedirect(`/models?rule=${aircraftTypeCode}`, "saved=rule"));
}

export async function updateReservationAction(formData: FormData) {
  await requireAdminContext();
  const admin = createAdminSupabaseClient();

  const id = getString(formData, "id");

  await admin
    .from("flight_reservations")
    .update({
      status: getNullableString(formData, "status"),
      aircraft_registration: getNullableString(
        formData,
        "aircraft_registration"
      )?.toUpperCase(),
      destination_ident: getNullableString(formData, "destination_ident")?.toUpperCase(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  revalidatePath("/operations");
  redirect(getStatusRedirect(`/operations?edit=${id}`, "saved=reservation"));
}

export async function upsertFlightModeAction(formData: FormData) {
  await requireAdminContext();
  const admin = createAdminSupabaseClient();

  const code = getString(formData, "code").toUpperCase();

  await admin.from("pw_flight_modes").upsert(
    {
      code,
      name: getNullableString(formData, "name"),
      counts_hours: getBoolean(formData, "counts_hours"),
      counts_for_scores: getBoolean(formData, "counts_for_scores"),
      moves_real_pilot_position: getBoolean(
        formData,
        "moves_real_pilot_position"
      ),
      moves_real_aircraft_position: getBoolean(
        formData,
        "moves_real_aircraft_position"
      ),
      uses_special_aircraft_pool: getBoolean(
        formData,
        "uses_special_aircraft_pool"
      ),
      notes: getNullableString(formData, "notes"),
    },
    { onConflict: "code" }
  );

  revalidatePath("/rules");
  redirect(getStatusRedirect(`/rules?mode=${code}`, "saved=flight-mode"));
}

export async function upsertDamageRuleAction(formData: FormData) {
  await requireAdminContext();
  const admin = createAdminSupabaseClient();

  const eventCode = getString(formData, "event_code").toUpperCase();

  await admin.from("aircraft_damage_rule_catalog").upsert(
    {
      event_code: eventCode,
      component: getNullableString(formData, "component"),
      base_damage: getNumber(formData, "base_damage"),
      default_send_to_maintenance: getBoolean(
        formData,
        "default_send_to_maintenance"
      ),
      description: getNullableString(formData, "description"),
    },
    { onConflict: "event_code" }
  );

  revalidatePath("/rules");
  redirect(getStatusRedirect(`/rules?damage=${eventCode}`, "saved=damage"));
}

export async function updateHoursTransferRequestAction(formData: FormData) {
  const context = await requireAdminContext();
  const admin = createAdminSupabaseClient();
  const id = getString(formData, "id");

  await admin
    .from("pw_hours_transfer_requests")
    .update({
      request_status: getNullableString(formData, "request_status"),
      reviewed_by:
        (typeof context.profile?.callsign === "string"
          ? context.profile.callsign
          : context.user.email) ?? null,
      reviewed_at: new Date().toISOString(),
      notes: getNullableString(formData, "notes"),
    })
    .eq("id", id);

  revalidatePath("/requests");
  redirect(getStatusRedirect(`/requests?transfer=${id}`, "saved=transfer"));
}

export async function updatePromotionRequestAction(formData: FormData) {
  const context = await requireAdminContext();
  const admin = createAdminSupabaseClient();
  const id = getString(formData, "id");

  await admin
    .from("pw_rank_promotion_requests")
    .update({
      request_status: getNullableString(formData, "request_status"),
      reviewed_by:
        (typeof context.profile?.callsign === "string"
          ? context.profile.callsign
          : context.user.email) ?? null,
      reviewed_at: new Date().toISOString(),
      review_notes: getNullableString(formData, "review_notes"),
    })
    .eq("id", id);

  revalidatePath("/requests");
  redirect(getStatusRedirect(`/requests?promotion=${id}`, "saved=promotion"));
}

export async function updateIntegrationProviderAction(formData: FormData) {
  await requireAdminContext();
  const admin = createAdminSupabaseClient();

  const providerCode = getString(formData, "provider_code");

  await admin
    .from("integration_providers")
    .update({
      display_name: getNullableString(formData, "display_name"),
      status: getNullableString(formData, "status"),
      auth_strategy: getNullableString(formData, "auth_strategy"),
      notes: getNullableString(formData, "notes"),
      updated_at: new Date().toISOString(),
    })
    .eq("provider_code", providerCode);

  revalidatePath("/settings");
  redirect(getStatusRedirect(`/settings?provider=${providerCode}`, "saved=provider"));
}

export async function upsertAcarsReleaseAction(formData: FormData) {
  await requireAdminContext();
  const admin = createAdminSupabaseClient();

  const id = getString(formData, "id");

  await admin.from("acars_releases").upsert(
    {
      id: id || undefined,
      version: getNullableString(formData, "version"),
      download_url: getNullableString(formData, "download_url"),
      notes: getNullableString(formData, "notes"),
      mandatory: getBoolean(formData, "mandatory"),
      is_active: getBoolean(formData, "is_active"),
      release_date:
        getNullableString(formData, "release_date") ??
        new Date().toISOString().slice(0, 10),
    },
    id ? { onConflict: "id" } : undefined
  );

  revalidatePath("/settings");
  redirect(getStatusRedirect("/settings", "saved=release"));
}
