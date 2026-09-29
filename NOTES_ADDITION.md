## 10. Fix pack — design-goal ranking (paste into NOTES.md)

- **Why η was dropped from ranking.** At a steady daily cycle the net energy stored over 24 h is about zero, so
  η = (absorbed − losses) / solar equals C·(T_end − T_start) / ∫Q_solar: thermal capacitance times the convergence
  residual. It no longer measures performance. Recommender, Compare and Results now use simulated inside temperatures.
- **Design goals** (`src/lib/rankingObjectives.ts`): Keep warm (max of the coldest hour), Keep cool (min of the hottest
  hour), Stabilize (min diurnal swing). Per-region default goals live in `regionMaterialAvailability.ts`
  (SAMPLE DATA — NOT VALIDATED). Converged designs rank before non-converged ones.
- **Glazing is not a wall material.** `wallMaterials.ts` lists ids (currently `glass`) that the search never uses in
  wall or roof layers. Modeling decision, not a physical property.
- **Search grid.** Total wall thickness is limited to 2x the current wall (editable, clearable). Designs on the edge of
  the grid are flagged: a wider grid might rank higher. Orientation, opening area and glazing are still not varied.
- **Known model limitations (unchanged).** Absorbed solar heat goes straight into the interior node, there is no
  ventilation or shading, floor/ground conduction is not modeled, and the sky-temperature offset is a default value.
  "Keep cool" therefore mostly rewards envelopes that shed heat by conduction. Use results to compare designs, not as
  predicted temperatures.
