# TerraShelter Implementation Notes & Assumptions

This document records architectural decisions, assumptions, and items requiring clarification for user review regarding the initial foundation phase of TerraShelter.

---

## 1. Region-Agnostic Architecture & State Synchronization

- **Single Source of Truth (`ShelterConfig`)**:
  Both "Quick Mode" and "Advanced Mode" operate on the exact same React Context state (`ShelterContext.tsx`). There is no duplicate data structure or mode-specific state fork.
- **Preset Treatment**:
  Presets (`src/data/regionPresets.ts`) are strictly UI convenience bundles. They carry the prominent notice: `"SAMPLE DATA — NOT VALIDATED, FOR DEMO ONLY"`.
  When a preset is clicked in Quick Mode, it populates the general `ShelterConfig` object (climate profile, dimensions, and default material). From that point onward, the data is treated identically to any manually entered or CSV-uploaded data.
- **No Hardcoded Regional Branching**:
  Zero code branches exist on region names or climates. All calculations and future simulation engines will receive only the numeric physical properties (ambient temperature array, irradiance array, wall layer matrices, geometry vectors).

---

## 2. Reference Value Tagging & Disclaimers

- Every placeholder or default material value in `src/data/defaultMaterials.ts` is explicitly labeled:
  `"Default reference value — verify before deployment"`
- The UI features a dedicated `<VerificationBadge />` component next to material properties and inputs to ensure users understand that literature estimates must be verified against actual lab/field material samples before engineering design.

---

## 3. Assumptions Made

1. **Geometry Shape**:
   - Only `shape: 'rectangular_box'` is implemented in this phase, typed as an extensible union `ShelterShape = 'rectangular_box'` to allow adding domes, pitched roofs, or cylinder models in the future without breaking consumers.
2. **Diurnal Cycle Granularity**:
   - The ambient climate profile is structured as exactly 24 hourly values (0:00 to 23:00). Interpolation to sub-hourly timesteps (e.g. 10-minute or 1-minute steps for numerical differential equations) is assumed to be handled by the future calculation solver.
3. **Composite Layer Direction**:
   - Wall and roof layers are ordered from exterior surface (Layer 1) to interior surface (Layer N).
4. **Openings Representation**:
   - Modeled as an array of opening entries (`count`, `areaEach_m2`, `type: 'plain_glass' | 'insulated' | 'open_gap'`). In Quick Mode, presets preload realistic opening arrangements (e.g. South-facing solar gain window for cold Ladakh desert; recessed/shaded openings for hot arid).
5. **No Calculations in Current Phase**:
   - In strict compliance with instructions, thermal simulations, finite difference matrices, charts, and 3D renderings are omitted. Navigation items for "Results" and "Compare" display "Coming soon" badges and tooltips without referencing any phase numbers.

---

## 4. Open Questions & Future Clarifications

- `// TODO: clarify with user`: For the upcoming calculation engine, will the simulation use a 1D transient finite-difference multi-node layer model, or a lumped-capacitance nodal thermal network (e.g., ISO 13790 / RC network)?
- `// TODO: clarify with user`: For solar radiation on tilted surfaces and walls, will the engine compute beam and diffuse components using anisotropic sky models (Perez / Hay-Davies) based on the latitude and horizontal irradiance provided, or will users have an option to enter direct normal irradiance (DNI) / diffuse horizontal irradiance (DHI)?
- `// TODO: clarify with user`: Infiltration and natural ventilation air change rates (ACH) — should this be a separate user input in the envelope parameters or derived from the opening gaps?

---

## 5. Missing Input Parameters for Thermal Calculation Engine (`src/lib/thermalEngine.ts`)

The thermal calculation engine implemented in `src/lib/thermalEngine.ts` requires several parameters that are not currently provided on `ShelterConfig`, `Material`, `WallLayer`, `ShelterOpening`, or `AmbientDataPoint` in `src/types/shelter.ts`. Per architectural constraints, existing types were NOT silently modified. These parameters are passed as explicit arguments or noted with `// TODO: NEEDS DOMAIN VALIDATION` comments.

Here is the exhaustive inventory of missing fields for review before future type extensions:

### 1. Infiltration & Air Properties (Formulas 6 & 9)
- `infiltrationRate` ($\dot{V}$, m³/s): Air infiltration volume rate through cracks, openings, and gaps.
  - *Current handling*: Passed as explicit argument to `simulateTemperatureOverTime` and `calculateInfiltrationLoss`.
  - *Proposed type location*: `ShelterGeometry` (e.g. `infiltration_m3s` or air change rate `infiltration_ach`) or derived from `ShelterOpening`.
- `airDensity` ($\rho$, kg/m³): Density of air inside the shelter (typically ~1.2 kg/m³ at sea level, but lower at high altitudes such as Ladakh ~0.8–0.9 kg/m³).
  - *Current handling*: Passed as explicit argument.
  - *Proposed type location*: `AmbientClimateConfig` or simulation constants config.
- `airSpecificHeat` ($c_p$, J/kg·K): Specific heat capacity of air (~1005 J/kg·K).
  - *Current handling*: Passed as explicit argument.
  - *Proposed type location*: `AmbientClimateConfig` or simulation constants config.

### 2. Surface Convective Heat Transfer Coefficients (Formulas 3, 4, 9)
- `hInterior` ($h_i$, W/m²·K): Interior convective + radiative surface film heat transfer coefficient (typically ~7.7 to 8.3 W/m²·K in building standards like ASHRAE/ISO 6946 for vertical walls, and ~5.9 to 10 W/m²·K for roofs).
  - *Current handling*: Passed as explicit argument.
  - *Proposed type location*: `WallLayer`, `ShelterGeometry`, or simulation environment configuration.
- `hExterior` ($h_o$, W/m²·K): Exterior convective surface film heat transfer coefficient (typically ~15 to 25 W/m²·K depending on ambient wind speed).
  - *Current handling*: Passed as explicit argument.
  - *Proposed type location*: `WallLayer`, `AmbientDataPoint` (wind-dependent), or simulation environment configuration.

### 3. Night Sky Radiation Properties (Formulas 7 & 9)
- `skyTempOffsetC` ($\Delta T_{sky}$, °C): Effective sky temperature depression below ambient temperature ($T_{sky} = T_{ambient} - \Delta T_{sky}$, typically 6 to 15°C depending on cloud cover and humidity).
  - *Current handling*: Passed as explicit argument to `simulateTemperatureOverTime`.
  - *Proposed type location*: `AmbientDataPoint` or `AmbientClimateConfig`.
- Sky View Factor ($F_{sky}$): View factor from shelter surfaces to the sky vault (1.0 for an unobstructed flat roof; ~0.5 for vertical walls viewing the horizon).
  - *Current handling*: Radiative loss is currently evaluated for the horizontal roof surface area only.

### 4. Glazing & Optical Properties (Formulas 1, 2, 9)
- `transmittance` ($\tau$, 0 to 1): Solar transmittance / solar heat gain coefficient (SHGC) of fenestration or glazing apertures.
  - *Current handling*: Defaulted to $\tau = 1$ in `simulateTemperatureOverTime` per Formula 2 rule ("if no glazing, τ = 1"), as `Material` and `ShelterOpening` currently lack a numeric transmittance property.
  - *Proposed type location*: `Material` or `ShelterOpening` (e.g. `solarTransmittance?: number`).
- Solar Incidence Angle ($\theta$, radians): Angle between direct sun rays and surface normal.
  - *Current handling*: Assumed normal incidence ($\theta = 0$, $\cos(\theta) = 1$) on horizontal roof surface per Formula 1 specification, as `AmbientDataPoint` only supplies horizontal irradiance `irradiance_wm2` without sun azimuth/elevation vectors.
  - *Proposed type location*: Derived in future solar geometry modules from `latitude`, `hour`, `orientation_deg`, and surface tilt.

### 5. Openings Thermal Modeling (Formulas 5, 6, 9)
- Window/Opening U-Value ($U_{opening}$, W/m²·K): Conduction heat transfer through fenestration (`plain_glass`, `insulated`).
  - *Current handling*: Not evaluated in Formula 5 or 9; only infiltration is considered per Formula 6.
  - *Proposed type location*: `ShelterOpening`.
- Opening Area Deduction:
  - *Current handling*: Currently, gross wall area is used for envelope conduction. Whether opening area should be subtracted from gross wall area requires domain clarification.

### 6. Simulation Initial Conditions & Time Controls (Formula 9)
- `initialTempC` ($T_{in}(0)$, °C): Starting indoor air temperature.
  - *Current handling*: Passed as explicit argument to `simulateTemperatureOverTime`.
  - *Proposed type location*: Simulation execution options / Results UI state.
- `timeStepSeconds` ($\Delta t$, s): Numerical Euler integration time step.
  - *Current handling*: Passed as explicit argument to `simulateTemperatureOverTime`.
  - *Proposed type location*: Simulation execution options / Results UI state.

---

## 6. Physical & Envelope Aggregation Assumptions (`src/lib/thermalEngine.ts` & `src/components/results/ResultsView.tsx`)

This section documents the specific aggregation and physical assumptions made in the thermal calculation engine and Results tab:

1. **Solar Exposure Surface Assumption**:
   - `calculateSolarGain()` is evaluated using the horizontal roof surface area ($A_{roof} = \text{length\_m} \times \text{width\_m}$).
   - *Rationale*: The `AmbientDataPoint` schema specifies `irradiance_wm2` as "Total solar irradiance on horizontal surface (W/m²)". In the absence of direct normal (DNI) / diffuse horizontal (DHI) splitting and 3D solar azimuth tracking for each vertical wall orientation, the horizontal roof is the direct physical receiver of this horizontal flux.
2. **Multi-Assembly Envelope U-Value Area-Weighted Aggregation**:
   - **Engine-Level Placement**: Note that this combination is calculated directly inside `src/lib/thermalEngine.ts` within `simulateTemperatureOverTime()` (not in the UI layer), in order to supply the single `uValue` and `area` arguments expected by Formula 5 (`calculateHeatLoss`).
   - Formula 4 computes multi-layer U-values for walls ($U_{wall}$) and roofs ($U_{roof}$) separately.
   - For total envelope conductive heat loss (Formula 5), the overall heat transfer coefficient is aggregated by area-weighting:
     $$UA_{total} = U_{wall} \times A_{wall} + U_{roof} \times A_{roof}$$
     $$A_{total} = A_{wall} + A_{roof}$$
     $$U_{overall} = \frac{UA_{total}}{A_{total}}$$
   - *Rationale*: Under the single-node lumped assumption ($T_{in}$ and $T_{ambient}$ identical for both assemblies), $Q_{loss} = U_{overall} \times A_{total} \times (T_{in} - T_{ambient})$ algebraically equals the physical sum of wall heat loss ($U_{wall} A_{wall} \Delta T$) and roof heat loss ($U_{roof} A_{roof} \Delta T$).
3. **Floor / Ground Conduction Entirely Unmodeled (Candidate for Future Phase)**:
   - Ground-coupled heat conduction through the floor slab / earth foundation is **currently entirely unmodeled**.
   - `ShelterGeometry` defines footprint dimensions, but `ShelterConfig` has no `floorLayers` schema, and no ground/soil temperature ($T_{ground}$) is tracked in `AmbientClimateConfig`.
   - In cold climates (e.g. Ladakh high-altitude desert), uninsulated earth contact can account for 15–30% of total conduction losses. This is flagged as a key candidate for a future phase (requiring `floorLayers: WallLayer[]` and a ground temperature profile or F-factor per ISO 13370 / ASHRAE 90.1).
4. **Openings Area and Conduction**:
   - Gross wall area ($2 \times (\text{length\_m} + \text{width\_m}) \times \text{height\_m}$) is used for wall conduction. Fenestration conduction is not separately modeled as `ShelterOpening` does not define U-values or thermal breaks; window/aperture heat transfer is represented via infiltration (Formula 6).
5. **Thermal Capacitance ($C$) Inclusions**:
   - Capacitance elements include all composite wall layers, all roof layers, and indoor air mass ($\text{volume} \times \rho_{air} \times c_{p,air}$).
6. **Night Sky Radiative Loss Surface**:
   - Radiative cooling (Formula 7) is applied to the horizontal roof area facing the night sky ($A = \text{length\_m} \times \text{width\_m}$), using the outermost roof layer's emissivity $\varepsilon$ and effective sky temperature $T_{sky} = T_{ambient} - 8.0^\circ\text{C}$.
7. **Simulation Initial Condition**:
   - Initial inside temperature $T_{in}(0)$ defaults to the hour-0 ambient temperature reading (`config.ambientClimate.hourlyProfile[0].temperature_C`), representing an unconditioned equilibrium starting state before diurnal solar loading.
8. **Simulation Time Step**:
   - Set to $\Delta t = 3600\text{ s}$ (1 hour), matching the 24 hourly discrete readings in `AmbientClimateConfig.hourlyProfile`.

---

## 7. Multi-Variant Comparison Architecture & Assumptions (`src/components/compare/CompareView.tsx`)

This section documents the design decisions and physical assumptions governing the multi-variant comparison module:

1. **Strict Climate & Engine Parameter Invariance**:
   - To ensure rigorous scientific comparability, all design variants are subjected to identical boundary conditions:
     - Ambient climate profile (`config.ambientClimate.hourlyProfile` across 24 hours).
     - Starting initial temperature $T_{in}(0) = T_{ambient}(0)$.
     - Engineering reference defaults from `src/lib/engineDefaults.ts` (infiltration $\dot{V} = 0.005\text{ m}^3/\text{s}$, air density $\rho = 1.204\text{ kg/m}^3$, specific heat $c_p = 1005\text{ J/kg}\cdot\text{K}$, film coefficients $h_i = 7.69\text{ W/m}^2\cdot\text{K}$ and $h_o = 25.0\text{ W/m}^2\cdot\text{K}$, and nocturnal sky offset $\Delta T_{sky} = 8.0^\circ\text{C}$).
2. **Comparison Modes**:
   - **Compare Materials Mode**: Geometry ($L, W, H, \text{azimuth}$) is locked across all variants, while wall and roof materials/thicknesses vary. This isolates the effect of thermal conductivity ($k$), density ($\rho$), specific heat capacity ($c$), and solar absorptivity/emissivity on diurnal damping and thermal lag.
   - **Compare Geometry Mode**: Material assemblies are locked across all variants, while dimensions and azimuth vary. This isolates the effect of surface-area-to-volume ratio ($A/V$), solar aperture area, and indoor air volume on thermal response.
3. **Variant State & Isolation**:
   - Variants are maintained within local state in `CompareView`, initialized by cloning the current active workspace `ShelterConfig`.
   - The user can explore 2 to 4 variants (`2 <= count <= 4`).
   - Editing variants in the Compare tab does not mutate the active workspace config unless explicitly designed.
4. **Per-Variant Error Containment**:
   - Simulations execute independently via `simulateTemperatureOverTime()`. If an individual variant has an invalid input (e.g. non-positive dimension or missing material), an error is captured and displayed on that specific variant card without interrupting the simulation or charting of valid variants.
5. **Efficiency Ranking ($\eta$, Formula 10)**:
   - Variants are ranked in descending order by efficiency score $\eta$:
     $$\eta = \frac{\int Q_{absorbed} \, dt - \int (Q_{loss} + Q_{infil} + Q_{rad}) \, dt}{\int Q_{solar} \, dt}$$
   - The top-performing variant is visibly highlighted with Rank #1 and an "Optimal" badge. Key takeaways summarize peak temperature dampening and diurnal temperature swing reductions compared to the lowest-ranked variant.

---

## 8. Real-Data Climate API Integration (OpenStreetMap Nominatim & NASA POWER)

This section documents the integration of live public climate and geocoding services implemented in `src/lib/climateApi.ts` and `src/components/advanced/LocationSearch.tsx`:

### 1. Geocoding Service (OpenStreetMap Nominatim)
- **Endpoint**: `https://nominatim.openstreetmap.org/search?q={query}&format=json&limit=5`
- **Authentication**: Free, no API key required.
- **CORS & Headers**:
  - OpenStreetMap Nominatim returns `access-control-allow-origin: *`, enabling direct client-side fetch from browsers.
  - Rate limiting policy is strictly enforced in code via `throttleNominatim()` (minimum 1.1 seconds between requests).
  - Explicit header `User-Agent: TerraShelter/1.0 (climate research app)` is supplied; in browser runtimes, standard browser user-agents automatically satisfy Nominatim policy.

### 2. Climate Data Service (NASA POWER Point Hourly API)
- **Endpoint**: `https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=T2M,ALLSKY_SFC_SW_DWN&community=RE&longitude={lon}&latitude={lat}&start={YYYYMMDD}&end={YYYYMMDD}&format=JSON`
- **Authentication**: Free, no API key required.
- **CORS**: Returns `access-control-allow-origin: *`, enabling direct client-side browser retrieval with zero backend proxies.
- **Parameters & Units**:
  - `T2M`: Temperature at 2 Meters (°C). Directly mapped to `AmbientDataPoint.temperature_C`.
  - `ALLSKY_SFC_SW_DWN`: All Sky Surface Shortwave Downward Irradiance (raw unit string: `"Wh/m^2"`).
    - *Physical Equivalence*: Over an hourly discrete time interval ($\Delta t = 1\text{ hour}$), 1 Watt-hour of radiant energy corresponds to an average power flux of 1 Watt ($1\text{ Wh} / 1\text{ h} = 1\text{ W}$). Thus, $1\text{ Wh/m}^2$ accumulated over an hour equals an average radiant flux of $1\text{ W/m}^2$.
    - *Mapping*: Values map directly 1:1 to `AmbientDataPoint.irradiance_wm2` without arbitrary scaling factors. Values are clamped to $\ge 0$ to eliminate nocturnal sensor noise.

### 3. Live Empirical Test Results (Leh, Ladakh — 34.1642°N, 77.5848°E)
The live API integration was tested against Leh, Ladakh for both winter and summer solstice conditions:
- **Winter Solstice Test (2024-01-15)**:
  - 24 hourly data points retrieved.
  - Min Temperature: $-17.90^\circ\text{C}$ (Hour 06:00, pre-dawn nocturnal radiative cooling).
  - Peak Temperature: $-4.05^\circ\text{C}$ (Hour 13:00).
  - Peak Solar Irradiance: $585.53\text{ W/m}^2$ (Hour 11:00).
- **Summer Solstice Test (2024-06-21)**:
  - 24 hourly data points retrieved.
  - Min Temperature: $-0.20^\circ\text{C}$ (Hour 03:00).
  - Peak Temperature: $+12.81^\circ\text{C}$ (Hour 12:00).
  - Peak Solar Irradiance: $644.38\text{ W/m}^2$ (Hour 11:00).

### 4. Elevation Scope Handling
- NASA POWER returns coordinates in GeoJSON format `[longitude, latitude, elevation]` where elevation is grid surface elevation in meters above sea level (`4532.61 m` for the Leh, Ladakh cell).
- Because `AmbientClimateConfig` in `src/types/shelter.ts` does not contain an `elevation` property, elevation is intentionally omitted from the UI to avoid displaying an unmodeled field or fabricating types.

### 5. Edge Cases & Safeguards
- **Data Latency**: NASA POWER hourly MERRA-2 assimilation data incurs a ~2–3 month processing latency. Requests for dates newer than ~90 days ago may return empty parameter objects; the UI defaults to stable historical dates (e.g. 2024 solstices) and surfaces clear user guidance when recent dates lack coverage.
- **Fill Values**: NASA POWER uses `-999.0` as a missing-data sentinel. Any hour containing a value $\le -900$ is flagged as missing and rejected, returning `null` with a clear user alert rather than corrupting calculations.
- **Network Failures**: Network exceptions or offline states fail gracefully without throwing unhandled errors or writing fabricated fallback data to `ShelterContext`.

---

## 9. Parametric 3D Shelter Viewer & Visual Appearance Assumptions (`Phase 5A`)

This section documents the physical models, schematic fallbacks, visual appearance mappings, and architectural decisions governing the Three.js 3D shelter viewer (`ShelterViewer.tsx` and `ThreeDView.tsx`):

### 1. Envelope Outline & Multi-Layer Stacking Conventions
- **Envelope Bounding Box**: The primary geometry dimensions (`length_m × width_m × height_m`) in `ShelterGeometry` define the **exterior envelope outline**.
- **Inward Layer Build-Up**:
  - `config.wallLayers[0]` and `config.roofLayers[0]` are treated as the outermost (exterior-facing) layers, and index $N-1$ is innermost (interior-facing), consistent with the convention established in Section 3 Item 3 and Section 6 Item 6.
  - Wall layer shells and roof deck layers extend **inward** in one consistent direction into the interior building volume from the exterior outline.
  - Cutaway view is explicitly labeled: `"Layer order as listed (Layer 1 exterior to Layer N interior)"` and `"Dimensions (L × W × H) define exterior envelope outline; layer thickness extends inward"`.
- **Roof Geometry Fallback**: `ShelterGeometry` specifies `shape: 'rectangular_box'` with no pitch, slope, gable, or overhang parameters. The roof is modeled schematically as a flat planar deck spanning `length_m × width_m` at elevation `height_m`. Labeled: *"Roof geometry is schematic: flat roof modeled from length × width (pitch/overhang not in data model)"*.

### 2. Aperture / Opening Sizing & Clamping Safeguards
- **Proportional Derivation**: `ShelterOpening` defines only `areaEach_m2` and `count`, without individual width/height dimensions or coordinates. Openings are derived using a standard 1:1.2 aspect ratio ($w = \sqrt{A / 1.2}$, $h = 1.2 \times w$).
- **Placement**: Openings are placed on the default front wall ($+Z$ wall, facing the default camera view).
- **Clamping Warning**: If a derived opening dimension exceeds the available wall envelope ($H_{wall} - 0.4\text{m}$ or length spacing), it is clamped to fit, and the viewer renders a prominent warning badge: `"drawn size differs from areaEach_m2"`. The system never silently draws a different area than the data specifies.

### 3. Temperature Tint & Lumped Model Fidelity
- **Uniform Tint**: Per Formula 9 in `src/lib/thermalEngine.ts`, TerraShelter uses a single-node lumped capacitance model. The simulated inside temperature $T_{in}(t)$ represents one bulk indoor air temperature for the entire interior. The 3D viewer displays a uniform temperature tint across the envelope, explicitly labeled:
  `"Lumped model: one inside temperature for the whole shelter. The tint is uniform, not an internal gradient."`
- **Dynamic Extrema Scaling**: Color mapping interpolates smoothly along a continuous blue $\rightarrow$ cyan $\rightarrow$ yellow $\rightarrow$ red gradient between $T_{min} = \min_t T_{in}(t)$ and $T_{max} = \max_t T_{in}(t)$ of the current simulation run. If $T_{max} == T_{min}$, division by zero is guarded and the ratio defaults to 0.5.

### 4. Honest Heat-Flow Vector Scaling
- **Neutral Anchors**: The thermal calculation engine does not compute per-surface, directional, or localized heat flows. Heat flow arrows are therefore anchored in neutral 3D positions adjacent to the shelter rather than specific surfaces.
- **Common Scale Maximum**: To ensure honest relative physical magnitudes, all three heat-flow arrows ($Q_{loss}$, $Q_{infil}$, $Q_{rad}$) are scaled against a single common maximum across all three series across the 24-hour run:
  $$\text{maxFlow} = \max\left(\max_t |Q_{loss}|, \max_t |Q_{infil}|, \max_t |Q_{rad}|, 10^{-6}\right)$$
  $$\text{length}(t) = \text{baseMaxArrowLen} \times \frac{|Q(t)|}{\text{maxFlow}}$$
- **Heat Gain Direction**: If an instantaneous heat flow is negative (e.g. ambient warmer than inside, causing conduction heat gain), the vector arrow reverses direction and is labeled `"(gain)"`.

### 5. Design Performance & Mass Computation Scope
- **U-Value Exact Engine Calls**: Assembly U-values are computed by directly calling the engine function:
  ```ts
  calculateUValueMultiLayer(
    hInterior: number,
    layers: WallLayer[],
    materials: Material[],
    hExterior: number
  ): number
  ```
- **Capacitance Mass Derivation Scope**: `ResultsView.tsx` does not utilize an external shared mass calculation helper; mass elements are derived inline inside `simulateTemperatureOverTime()` in `src/lib/thermalEngine.ts`. In strict compliance with Amendment H, thermal mass is not re-derived; the design info panel presents multi-layer U-values, total assembly thicknesses, and material properties directly.

### 6. Compass Azimuth & Fixed Scene Illumination
- **Compass Definition**: `orientation_deg` definition from `src/types/shelter.ts` (`Compass azimuth degrees (0 = North, 90 = East, 180 = South, 270 = West)`) is strictly respected. Clockwise rotation around $+Y$ maps 0° to $-Z$ (North) and 90° to $+X$ (East), verified by unit tests in `src/lib/geometry3d.test.ts`.
- **Fixed Illumination**: Scene lighting uses fixed ambient and directional Three.js lights, completely independent of the hour scrubber. No dynamic sun path math, shadows, or fake daylight cycles are introduced.

### 7. Visual Material Appearance
- Color, roughness, and metalness mappings in `src/lib/materialAppearance.ts` carry the mandatory header comment: `"VISUAL ONLY — not a physical property."` Any material not in the predefined registry receives neutral gray (`#94a3b8`) with the legend notice `"no appearance defined"`.

---

## 10. Steady Daily Cycle Simulation Wrapper (`Phase 5A.1`)

### 1. Problem & Solution
- In transient lumped-capacitance simulations, heavy thermal mass shelters (such as 400 mm adobe) require multiple diurnal cycles to settle from an arbitrary initial start temperature.
- `simulateSteadyCycle.ts` wraps `simulateTemperatureOverTime()` and iteratively simulates 24-hour cycles until the day-start inside temperature converges within `STEADY_CYCLE_TOLERANCE_C = 0.01 °C` (or up to `STEADY_CYCLE_MAX_DAYS = 60`).

### 2. Exact End-of-Day State
- The engine records the thermodynamic state *before* each Euler step.
- To obtain the exact state after 24 hours, the wrapper runs the engine on a copy of the configuration with one extra ambient point appended (hour 24, identical to hour 0's temperature and irradiance, 25 points total).
- `results[24].tempC` provides the exact state at $t = 86400\text{ s}$ without introducing a 1-step lag or duplicating physics.
- The returned series retains only the first 24 entries (`results.slice(0, 24)`).

---

## 11. Lean Parametric Design Recommender (`Phase 5B`)

### 1. Zero Hardcoding & Physics-Driven Search
- There is zero hardcoded mapping from region to recommended design.
- Every candidate is simulated under identical climate and engine defaults via `simulateSteadyCycle()`.
- If different regions select different winners, it is purely because simulation results and base configurations differ.
- Region Showcase evaluates all 3 presets (`cold_high_altitude_desert`, `hot_arid_climate`, `temperate_climate`) on independent `ShelterConfig` copies without mutating the active React context state.

### 2. Search Grid Parameters ("Default search grid — not a standard")
- **Wall Assemblies**:
  - Single-layer: each available material at thicknesses $[0.5, 0.75, 1.0, 1.5, 2.0] \times t_{base}$.
  - Two-layer composites: unordered pairs $\{A, B\}$ of different available materials, each with thicknesses $[0.5, 0.75, 1.0, 1.5, 2.0] \times t_{base}$.
- **Roof Assembly**: Kept identical to active configuration unless "Also vary roof" is selected.
- **Geometry**: Floor area ($L \times W$) is strictly conserved. Aspect ratios vary over $\{\text{current}, 1:1, 3:2, 2:1\}$ and height over $[0.8, 1.0, 1.2] \times H_{base}$.
- **Non-Varied Parameters**: Orientation azimuth, window area, and glazing type are held constant because the engine does not model solar incidence angle vectors or fenestration conduction U-values.
- **Evaluation**: Capped at 3000 candidates with deterministic stride subsampling if the permutation space exceeds 3000. Chunked execution via `setTimeout(0)` (~200 per chunk) maintains a responsive UI.

### 3. Number-Only Explanations
- Explanation strings are strictly computed numbers: U-values, thermal capacitance, min/avg/max inside temperatures, diurnal swing, and efficiency score $\eta$. No subjective or qualitative claims are generated.

### 4. Context State Actions
- "Apply to active config" uses existing `ShelterContext` actions: `setWallLayers()`, `setRoofLayers()`, and `updateGeometry()`.

---

## 12. Sensitivity Analysis (`Phase 6`)

One-at-a-time re-runs of `simulateSteadyCycle()` with the same engine defaults as `evaluateCandidate`. Perturbation fractions `[0.1, 0.25, 0.5]` are an analysis setting, not a physical uncertainty. No new physics.

Each input (low = `1 − f`, high = `1 + f`):

1. **Wall thickness** — scales `thickness_m` on every `config.wallLayers` entry.
2. **Roof thickness** — scales `thickness_m` on every `config.roofLayers` entry.
3. **Height** — scales `config.geometry.height_m`.
4. **Wall conductivity k** — cloned wall-layer materials; scales `conductivity_k`.
5. **Wall density** — cloned wall-layer materials; scales `density`.
6. **Wall specific heat** — cloned wall-layer materials; scales `specificHeat_c`.
7. **Roof solar absorptivity α** — cloned material of `roofLayers[0]` only; scales `solarAbsorptivity`, clipped at 1.
8. **Roof emissivity ε** — cloned material of `roofLayers[0]` only; scales `thermalEmissivity`, clipped at 1.
9. **Infiltration rate** — engine argument `infiltrationRate` (`DEFAULT_INFILTRATION_RATE × factor`).
10. **Sky temperature offset** — engine argument `skyTempOffsetC` (`DEFAULT_SKY_TEMP_OFFSET_C × factor`).
11. **Exterior film coefficient h_o** — engine argument `hExterior` (`DEFAULT_H_EXTERIOR × factor`).
12. **Solar irradiance** — scales `irradiance_wm2` on every hour of `ambientClimate.hourlyProfile`.

---

## 13. Printable Report (`Phase 7`)

The Report tab (`src/components/report/ReportView.tsx`) is a paper-style summary of the active `ShelterConfig`. All numbers come from existing library functions (`simulateSteadyCycle`, `evaluateCandidate`, `generateCandidates` / `rankCandidates`, `runSensitivity`). No new physics. Print uses `window.print()` plus an `@media print` rule in `src/index.css` that hides `header`, `aside`, and `.no-print`. Search uses `alsoVaryRoof = false` and `defaultMaxTotalWallThickness_m`. Absolute temperatures remain illustrative.

Phase 7.1: restyled Report and Sensitivity tabs for visual consistency with the rest of the app; print/PDF output unaffected — still renders as a white document via print-only CSS overrides.



