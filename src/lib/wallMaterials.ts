/**
 * wallMaterials.ts
 *
 * Which library materials may NOT be used as wall or roof layers.
 * Dependency-free on purpose so pure search code and node tests can import it.
 *
 * MODELING DECISION (not a physical property): glazing-type materials such as
 * "Glass (envelope aperture)" belong in openings, not in a 500 mm structural
 * wall layer. Edit this list if the material library gains other glazing types.
 */
export const NON_WALL_MATERIAL_IDS: readonly string[] = ['glass'];

export function isNonWallMaterial(materialId: string): boolean {
  return NON_WALL_MATERIAL_IDS.includes(materialId);
}
