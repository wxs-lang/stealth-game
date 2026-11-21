// The game's rules and state, with no drawing and no browser in it: the player, the
// detection meter, the artifacts, the pebbles, the levels and the score. step() advances
// one fixed step and returns what happened as bit flags, so the caller can react without
// the world knowing about screens or sound.
import {
  ARTIFACT_POINTS,
  CAMERA,
  CHANCES,
  DETECTION,
  GHOST_BONUS,
  GUARD,
  LEVELS,
  LEVEL_POINTS,
  PEBBLES_PER_LEVEL,
  PLAYER,
} from './config.js';
import { createLevel } from './level.js';
import { guardSees, sendToNoise, stepGuard } from './guards.js';
import { circleHitsRect, coneSees, hasLineOfSight, moveCircle } from './vision.js';

export const EVENT_ARTIFACT = 1;
export const EVENT_SPOTTED = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_LEVEL = 8;
export const EVENT_WIN = 16;
export const EVENT_OVER = 32;

export function createWorld(random) {
  const player = { x: 0, y: 0, angle: -Math.PI / 2, moving: false, sneaking: false };
  const pebbles = [];
  const state = {
    player,
    pebbles,
    levelIndex: 0,
    level: null,
    meter: 0,
    spotted: false,
    chances: CHANCES,
    pebblesLeft: PEBBLES_PER_LEVEL,
    artifactsTaken: 0,
    score: 0,
    elapsed: 0,
    levelElapsed: 0,
    levelScore: 0,
    caughtFlash: 0,
  };

  function loadLevel(index) {
    state.levelIndex = index;
    state.level = createLevel(index);
    player.x = state.level.def.player.x;
    player.y = state.level.def.player.y;
    player.angle = -Math.PI / 2;
    state.meter = 0;
    state.spotted = false;
    state.pebblesLeft = PEBBLES_PER_LEVEL;
    state.levelElapsed = 0;
    state.levelScore = 0;
    for (const pebble of pebbles) pebble.active = false;
  }

  function reset() {
    state.chances = CHANCES;
    state.artifactsTaken = 0;
    state.score = 0;
    state.elapsed = 0;
    for (let i = 0; i < PEBBLES_PER_LEVEL * 2; i += 1) {
      pebbles.push({ active: false, x: 0, y: 0, tx: 0, ty: 0, t: 0 });
    }
    loadLevel(0);
  }

  function throwPebble(targetX, targetY) {
    if (state.pebblesLeft <= 0) return false;
    const dx = targetX - player.x;
    const dy = targetY - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance > PLAYER.throwRange) return false;
    let pebble = null;
    for (const p of pebbles) if (!p.active) { pebble = p; break; }
    if (pebble === null) return false;
    pebble.active = true;
    pebble.x = player.x;
    pebble.y = player.y;
    pebble.tx = targetX;
    pebble.ty = targetY;
    pebble.t = 0;
    state.pebblesLeft -= 1;
    return true;
  }

  function levelBonus() {
    const timeBonus = Math.max(0, Math.round(240 - state.levelElapsed * 3));
    const ghost = state.spotted ? 0 : GHOST_BONUS;
    return { timeBonus, ghost };
  }

  /**
   * One fixed step. `move` is {x, y} of unit length or zero; `sneak` halves speed and
   * detection; `throwAt` is a point to toss a pebble at, or null. Returns event flags.
   */
  function step(dt, move, sneak, throwAt) {
    let events = 0;
    state.elapsed += dt;
    state.levelElapsed += dt;
    if (state.caughtFlash > 0) state.caughtFlash -= dt;
    const level = state.level;
    const blockers = level.blockers;

    if (throwAt !== null) {
      throwPebble(throwAt.x, throwAt.y);
    }

    // The player moves; sneaking is slower and harder to spot.
    const speed = sneak ? PLAYER.sneakSpeed : PLAYER.speed;
    player.sneaking = sneak;
    player.moving = move.x !== 0 || move.y !== 0;
    if (player.moving) {
      const moved = moveCircle(player.x, player.y, PLAYER.radius, move.x * speed * dt, move.y * speed * dt, level.solids);
      player.x = moved.x;
      player.y = moved.y;
      player.angle = Math.atan2(move.y, move.x);
    }

    // Pebbles fly to their mark, then draw the nearest guard over.
    for (const pebble of pebbles) {
      if (!pebble.active) continue;
      pebble.t += dt;
      const total = 0.45;
      const k = Math.min(1, pebble.t / total);
      pebble.x = pebble.x + (pebble.tx - pebble.x) * k;
      pebble.y = pebble.y + (pebble.ty - pebble.y) * k;
      if (k >= 1) {
        pebble.active = false;
        sendToNoise(level.guards, pebble.tx, pebble.ty);
      }
    }

    // Who sees the player? Every guard's cone and every camera's cone feeds one meter.
    let seenDistance = -1;
    let seenByGuard = null;
    for (const guard of level.guards) {
      const d = guardSees(guard, player.x, player.y, blockers);
      if (d >= 0 && (seenDistance < 0 || d < seenDistance)) {
        seenDistance = d;
        seenByGuard = guard;
      }
    }
    let seenByCamera = false;
    for (const camera of level.cameras) {
      camera.phase += dt * camera.speed;
      camera.angle = camera.baseAngle + Math.sin(camera.phase) * (camera.sweep / 2);
      const d = coneSees(camera.x, camera.y, camera.angle, CAMERA.viewRange, CAMERA.viewHalfAngle, player.x, player.y, blockers);
      if (d >= 0) {
        seenByCamera = true;
        if (seenDistance < 0 || d < seenDistance) seenDistance = d;
      }
    }

    if (seenDistance >= 0) {
      const closeness = 1 - seenDistance / GUARD.viewRange;
      let rate = DETECTION.farRate + (DETECTION.closeRate - DETECTION.farRate) * closeness;
      if (sneak) rate *= DETECTION.sneakMultiplier;
      if (player.moving) rate *= DETECTION.movingMultiplier;
      const before = state.meter;
      state.meter = Math.min(1, state.meter + rate * dt);
      if (before < DETECTION.suspectAt && state.meter >= DETECTION.suspectAt && seenByGuard !== null) {
        // A guard half-saw something: it turns to look.
        seenByGuard.state = 'suspect';
      }
      if (before < 1 && state.meter >= 1) {
        state.spotted = true;
        events |= EVENT_SPOTTED;
        for (const guard of level.guards) {
          if (guard.state !== 'chase') {
            guard.state = 'chase';
            guard.lastSeen = { x: player.x, y: player.y };
          }
        }
      }
    } else {
      state.meter = Math.max(0, state.meter - DETECTION.decayRate * dt);
      if (state.meter < DETECTION.suspectAt) {
        for (const guard of level.guards) {
          if (guard.state === 'suspect') guard.state = 'return';
        }
      }
    }

    // The guards act on what they see (or last saw).
    for (const guard of level.guards) {
      const d = guardSees(guard, player.x, player.y, blockers);
      const result = stepGuard(guard, dt, d, player.x, player.y, level.solids, moveCircle);
      if (result === 'caught') {
        state.chances -= 1;
        state.caughtFlash = 0.6;
        events |= EVENT_CAUGHT;
        if (state.chances <= 0) events |= EVENT_OVER;
        else loadLevel(state.levelIndex);
        return events;
      }
    }

    // Pocketed artifacts score at once.
    for (const artifact of level.artifacts) {
      if (artifact.taken) continue;
      if (Math.hypot(artifact.x - player.x, artifact.y - player.y) < PLAYER.radius + 16) {
        artifact.taken = true;
        state.artifactsTaken += 1;
        state.score += ARTIFACT_POINTS;
        state.levelScore += ARTIFACT_POINTS;
        events |= EVENT_ARTIFACT;
      }
    }

    // The green door: reach it and the floor is done.
    const exit = level.def.exit;
    if (circleHitsRect(player.x, player.y, PLAYER.radius, exit)) {
      const bonus = levelBonus();
      state.score += LEVEL_POINTS + bonus.timeBonus + bonus.ghost;
      state.levelScore += LEVEL_POINTS + bonus.timeBonus + bonus.ghost;
      // The panel for the cleared floor reads this before the next floor loads.
      state.lastBonus = {
        name: level.def.name,
        taken: level.artifacts.filter((a) => a.taken).length,
        total: level.artifacts.length,
        timeBonus: bonus.timeBonus,
        ghost: bonus.ghost,
      };
      if (state.levelIndex + 1 >= LEVELS.length) {
        events |= EVENT_WIN;
      } else {
        events |= EVENT_LEVEL;
        loadLevel(state.levelIndex + 1);
      }
    }
    return events;
  }

  reset();
  return { state, reset, step, throwPebble, levelBonus, loadLevel };
}
