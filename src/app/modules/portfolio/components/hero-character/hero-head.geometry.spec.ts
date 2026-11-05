import { headTarget } from './hero-head.geometry';

describe('original illustration head tracking', () => {
  const center = { x: 500, y: 200 };

  it('turns right and down toward the cursor', () => {
    const pose = headTarget(center, { x: 700, y: 400 }, 1000);
    expect(pose.yaw).toBeGreaterThan(0);
    expect(pose.pitch).toBeLessThan(0);
    expect(pose.tilt).toBeGreaterThan(0);
  });

  it('limits motion so the head stays joined to the neck', () => {
    const pose = headTarget(center, { x: 100000, y: -100000 }, 500);
    expect(Math.abs(pose.yaw)).toBeLessThanOrEqual(6);
    expect(Math.abs(pose.pitch)).toBeLessThanOrEqual(4);
    expect(Math.abs(pose.tilt)).toBeLessThanOrEqual(2);
  });

  it('returns to the exact original pose when the pointer leaves', () => {
    expect(headTarget(center, null, 1000)).toEqual({
      pitch: 0,
      tilt: 0,
      yaw: 0,
    });
    expect(headTarget(center, center, 0)).toEqual({
      pitch: 0,
      tilt: 0,
      yaw: 0,
    });
  });
});
