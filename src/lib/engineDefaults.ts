/**
 * Default reference values for the TerraShelter thermal calculation engine.
 * 
 * CRITICAL COMPLIANCE NOTICE:
 * Every placeholder/default engineering numeric value here is visibly tagged
 * "Default reference value — verify before deployment".
 * Users must verify local building parameters, site wind conditions, and
 * infiltration rates prior to actual shelter engineering deployment.
 */

export const DEFAULT_ENGINE_NOTICE =
  'Default reference value — verify before deployment' as const;

/**
 * Air infiltration rate V̇ through gaps, envelope cracks, and openings.
 * Default: 0.005 m³/s
 * Reference basis: Corresponds to approximately 0.5 to 0.6 air changes per hour (ACH)
 * for a typical compact shelter volume (~30–36 m³), representing a reasonably well-sealed
 * rural or transitional shelter without active mechanical ventilation.
 * // TODO: NEEDS DOMAIN VALIDATION — measure actual ACH via blower door or tracer gas testing on prototype.
 */
export const DEFAULT_INFILTRATION_RATE = 0.005; // m³/s — Default reference value — verify before deployment

/**
 * Standard atmospheric air density ρ at typical ambient conditions (~20°C, 101.325 kPa).
 * Default: 1.204 kg/m³
 * Reference basis: ASHRAE Fundamentals standard sea-level dry air density.
 * Note: At high-altitude sites (such as Ladakh, ~3,500m elevation), air density drops to ~0.80–0.85 kg/m³.
 * // TODO: NEEDS DOMAIN VALIDATION — altitude adjustment should be integrated from latitude/longitude or barometric pressure.
 */
export const DEFAULT_AIR_DENSITY = 1.204; // kg/m³ — Default reference value — verify before deployment

/**
 * Specific heat capacity of air at constant pressure c_p.
 * Default: 1005 J/(kg·K)
 * Reference basis: Standard thermodynamic value for dry air at ambient temperatures.
 */
export const DEFAULT_AIR_SPECIFIC_HEAT = 1005; // J/(kg·K) — Default reference value — verify before deployment

/**
 * Interior surface combined convective and radiative heat transfer coefficient h_i.
 * Default: 7.69 W/(m²·K)
 * Reference basis: ISO 6946 / ASHRAE interior surface thermal resistance R_si = 0.13 m²·K/W
 * (h_i = 1 / R_si ≈ 7.69 W/m²·K for still indoor air on vertical surfaces).
 */
export const DEFAULT_H_INTERIOR = 7.69; // W/(m²·K) — Default reference value — verify before deployment

/**
 * Exterior surface heat transfer coefficient h_o.
 * Default: 25.0 W/(m²·K)
 * Reference basis: ISO 6946 / ASHRAE exterior surface thermal resistance R_se = 0.04 m²·K/W
 * (h_o = 1 / R_se = 25.0 W/m²·K for moderate wind conditions ~4 m/s).
 */
export const DEFAULT_H_EXTERIOR = 25.0; // W/(m²·K) — Default reference value — verify before deployment

/**
 * Effective clear-sky temperature depression below ambient dry-bulb temperature.
 * Default: 8.0 °C (T_sky = T_ambient - 8.0 °C)
 * Reference basis: Typical clear-sky nocturnal radiative depression (ranges between 6°C and 12°C
 * based on atmospheric humidity, clearness index, and Swinbank / Martin-Berdahl sky models).
 * // TODO: NEEDS DOMAIN VALIDATION — calculate dynamic sky emissivity based on dewpoint/humidity profile.
 */
export const DEFAULT_SKY_TEMP_OFFSET_C = 8.0; // °C — Default reference value — verify before deployment

/**
 * Numerical integration time step Δt.
 * Default: 3600 seconds (1 hour)
 * Reference basis: Aligns directly with the 24 hourly ambient climate data points.
 */
export const DEFAULT_TIME_STEP_SECONDS = 3600; // seconds (1 hour)
