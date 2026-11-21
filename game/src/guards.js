// The guards' behaviour: patrol, suspicion, chase, search, investigate, return. A guard
// is a small state machine driven by what it can see and what it last saw; it knows nothing
// about screens or drawing.
import { GUARD } from './config.js';
import { coneSees } from './vision.js';

function moveToward(guard, tx, ty, speed, dt, solids, moveCircle) {
  const dx = tx - guard.x;
  const dy = ty - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 1) return 0;
  const step = Math.min(distance, speed * dt);
  const moved = moveCircle(guard.x, guard.y, GUARD.radius, (dx / distance) * step, (dy / distance) * step, solids);
  guard.x = moved.x;
  guard.y = moved.y;
  guard.angle = Math.atan2(dy, dx);
  return distance - step;
}

/**
 * Advance one guard a step. `seen` is the distance at which this guard sees the player
 * this step (-1 when it does not), or null when the player is not its concern. Returns
 * 'caught' when the guard reaches the player while chasing.
 */
export function stepGuard(guard, dt, seen, playerX, playerY, solids, moveCircle) {
  if (seen >= 0) {
    guard.lastSeen = { x: playerX, y: playerY };
    if (guard.state === 'patrol' || guard.state === 'return') guard.state = 'suspect';
  }

  if (guard.state === 'patrol') {
    const target = guard.waypoints[guard.waypoint];
    if (guard.wait > 0) {
      guard.wait -= dt;
      if (guard.wait <= 0) guard.waypoint = (guard.waypoint + 1) % guard.waypoints.length;
      return null;
    }
    const remaining = moveToward(guard, target[0], target[1], guard.speed, dt, solids, moveCircle);
    if (remaining <= 0.5) guard.wait = guard.pause;
    return null;
  }

  if (guard.state === 'suspect') {
    // Half-seen something: face it, and if it is still there, close in to look.
    if (guard.lastSeen !== null) {
      guard.angle = Math.atan2(guard.lastSeen.y - guard.y, guard.lastSeen.x - guard.x);
      if (seen >= 0) {
        moveToward(guard, playerX, playerY, GUARD.investigateSpeed, dt, solids, moveCircle);
      }
    }
    return null;
  }

  if (guard.state === 'chase') {
    // The player is known: run at the last seen spot, and keep running while seen.
    const target = seen >= 0 ? { x: playerX, y: playerY } : guard.lastSeen;
    if (target === null) {
      guard.state = 'search';
      guard.searchTimer = GUARD.searchTime;
      return null;
    }
    moveToward(guard, target.x, target.y, GUARD.chaseSpeed, dt, solids, moveCircle);
    if (Math.hypot(playerX - guard.x, playerY - guard.y) < GUARD.radius + 13) return 'caught';
    if (seen < 0 && guard.lastSeen !== null && Math.hypot(guard.lastSeen.x - guard.x, guard.lastSeen.y - guard.y) < 8) {
      guard.state = 'search';
      guard.searchTimer = GUARD.searchTime;
    }
    return null;
  }

  if (guard.state === 'search') {
    // Look around the last seen spot, then give up and walk back to the patrol.
    guard.searchTimer -= dt;
    guard.angle += dt * 1.6;
    if (guard.searchTimer <= 0) {
      guard.state = 'return';
      guard.lastSeen = null;
    }
    return null;
  }

  if (guard.state === 'investigate') {
    const target = guard.investigate;
    if (target === null) {
      guard.state = 'return';
      return null;
    }
    const remaining = moveToward(guard, target.x, target.y, GUARD.investigateSpeed, dt, solids, moveCircle);
    if (remaining <= 0.5) {
      guard.investigate = null;
      guard.state = 'search';
      guard.searchTimer = GUARD.investigateTime;
    }
    return null;
  }

  // return: walk back to the nearest patrol waypoint and resume the route.
  let nearest = 0;
  let nearestDistance = Infinity;
  for (let i = 0; i < guard.waypoints.length; i += 1) {
    const d = Math.hypot(guard.waypoints[i][0] - guard.x, guard.waypoints[i][1] - guard.y);
    if (d < nearestDistance) {
      nearestDistance = d;
      nearest = i;
    }
  }
  const target = guard.waypoints[nearest];
  const remaining = moveToward(guard, target[0], target[1], GUARD.returnSpeed, dt, solids, moveCircle);
  if (remaining <= 0.5) {
    guard.waypoint = (nearest + 1) % guard.waypoints.length;
    guard.state = 'patrol';
  }
  return null;
}

/** What this guard sees of the player right now: the distance, or -1. */
export function guardSees(guard, playerX, playerY, blockers) {
  return coneSees(guard.x, guard.y, guard.angle, GUARD.viewRange, GUARD.viewHalfAngle, playerX, playerY, blockers);
}

/** Send the nearest free guard to look at a pebble's landing spot. */
export function sendToNoise(guards, x, y) {
  let best = null;
  let bestDistance = 380;
  for (const guard of guards) {
    if (guard.state === 'chase') continue;
    const d = Math.hypot(x - guard.x, y - guard.y);
    if (d < bestDistance) {
      bestDistance = d;
      best = guard;
    }
  }
  if (best !== null) {
    best.investigate = { x, y };
    best.state = 'investigate';
  }
}
