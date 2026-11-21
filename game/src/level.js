// One floor of the museum, built from a level layout: the guards on their patrols,
// the cameras on their mounts, the artifacts waiting to be pocketed, and the exit door.
import { LEVELS } from './config.js';

export function createLevel(index) {
  const def = LEVELS[index];
  const guards = def.guards.map((g) => ({
    waypoints: g.waypoints,
    speed: g.speed,
    pause: g.pause,
    x: g.waypoints[0][0],
    y: g.waypoints[0][1],
    waypoint: 1 % g.waypoints.length,
    wait: 0,
    angle: Math.atan2(
      g.waypoints[1 % g.waypoints.length][1] - g.waypoints[0][1],
      g.waypoints[1 % g.waypoints.length][0] - g.waypoints[0][0],
    ),
    state: 'patrol',
    lastSeen: null,
    searchTimer: 0,
    investigate: null,
  }));
  const cameras = def.cameras.map((c) => ({
    x: c.x,
    y: c.y,
    baseAngle: c.baseAngle,
    sweep: c.sweep,
    speed: c.speed,
    angle: c.baseAngle,
    phase: 0,
  }));
  const artifacts = def.artifacts.map((a) => ({ x: a.x, y: a.y, taken: false }));
  return {
    index,
    def,
    guards,
    cameras,
    artifacts,
    blockers: [...def.walls, ...def.cover],
    solids: [...def.walls, ...def.cover],
  };
}
