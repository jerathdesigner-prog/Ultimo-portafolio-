import type { Point } from '../hero-eyes/hero-eyes.geometry';

/** Small CSS rotations around the neck preserve the original 2D silhouette. */
export function headTarget(
  center: Point,
  pointer: Point | null,
  width: number,
) {
  if (!pointer || width <= 0) {
    return { pitch: 0, tilt: 0, yaw: 0 };
  }
  const reach = width * 0.35;
  const x = Math.max(-1, Math.min(1, (pointer.x - center.x) / reach));
  const y = Math.max(-1, Math.min(1, (pointer.y - center.y) / reach));
  return { pitch: -y * 4, tilt: x * 2, yaw: x * 6 };
}
