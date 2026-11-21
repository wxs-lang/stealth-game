// Line of sight and vision cones, with no drawing and no browser in it. Walls and cover
// are rectangles; a sightline is blocked when the segment from the watcher to the target
// crosses any of them. A target is seen when it is inside the cone's range and opening
// angle and the sightline is clear.
function angleDifference(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Does the segment (x1,y1)-(x2,y2) cross the rectangle? (Slab test.) */
export function segmentHitsRect(x1, y1, x2, y2, r) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let tMin = 0;
  let tMax = 1;
  if (dx === 0) {
    if (x1 < r.x || x1 > r.x + r.w) return false;
  } else {
    let t1 = (r.x - x1) / dx;
    let t2 = (r.x + r.w - x1) / dx;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  if (dy === 0) {
    if (y1 < r.y || y1 > r.y + r.h) return false;
  } else {
    let t1 = (r.y - y1) / dy;
    let t2 = (r.y + r.h - y1) / dy;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }
  return true;
}

/** True when no wall or cover stands between the two points. */
export function hasLineOfSight(x1, y1, x2, y2, blockers) {
  for (let i = 0; i < blockers.length; i += 1) {
    if (segmentHitsRect(x1, y1, x2, y2, blockers[i])) return false;
  }
  return true;
}

/**
 * Is the target (tx,ty) inside the watcher's cone? Returns the distance when seen,
 * or -1 when outside the range, outside the angle, or behind a blocker.
 */
export function coneSees(watcherX, watcherY, angle, range, halfAngle, tx, ty, blockers) {
  const dx = tx - watcherX;
  const dy = ty - watcherY;
  const distance = Math.hypot(dx, dy);
  if (distance > range) return -1;
  if (distance > 1 && Math.abs(angleDifference(Math.atan2(dy, dx), angle)) > halfAngle) return -1;
  if (!hasLineOfSight(watcherX, watcherY, tx, ty, blockers)) return -1;
  return distance;
}

/** Does a circle of `radius` at (x,y) overlap the rectangle? */
export function circleHitsRect(x, y, radius, r) {
  const cx = Math.max(r.x, Math.min(x, r.x + r.w));
  const cy = Math.max(r.y, Math.min(y, r.y + r.h));
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy < radius * radius;
}

/**
 * How far a ray from (x,y) in direction (dx,dy) travels before it enters a rectangle,
 * or Infinity when it never does. Used to clip a vision cone against walls and cover.
 */
export function rayHitsRect(x, y, dx, dy, r) {
  let tMin = 0;
  let tMax = Infinity;
  if (dx === 0) {
    if (x < r.x || x > r.x + r.w) return Infinity;
  } else {
    let t1 = (r.x - x) / dx;
    let t2 = (r.x + r.w - x) / dx;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return Infinity;
  }
  if (dy === 0) {
    if (y < r.y || y > r.y + r.h) return Infinity;
  } else {
    let t1 = (r.y - y) / dy;
    let t2 = (r.y + r.h - y) / dy;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return Infinity;
  }
  return tMin;
}

/** The nearest distance a ray travels before hitting any rectangle, or Infinity. */
export function rayDistance(x, y, dx, dy, rects) {
  let best = Infinity;
  for (let i = 0; i < rects.length; i += 1) {
    const t = rayHitsRect(x, y, dx, dy, rects[i]);
    if (t < best) best = t;
  }
  return best;
}

/**
 * Move a circle one axis at a time against solid rectangles, sliding along them:
 * returns the position the circle ends at.
 */
export function moveCircle(x, y, radius, dx, dy, solids) {
  let nx = x + dx;
  for (let i = 0; i < solids.length; i += 1) {
    if (circleHitsRect(nx, y, radius, solids[i])) {
      nx = dx > 0 ? solids[i].x - radius : solids[i].x + solids[i].w + radius;
    }
  }
  let ny = y + dy;
  for (let i = 0; i < solids.length; i += 1) {
    if (circleHitsRect(nx, ny, radius, solids[i])) {
      ny = dy > 0 ? solids[i].y - radius : solids[i].y + solids[i].h + radius;
    }
  }
  return { x: nx, y: ny };
}
