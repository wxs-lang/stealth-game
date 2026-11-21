// The screenshot scenes behind ?shot=start|play|alert|exit. Each one stages a real game
// state through the world's own state — the same state the loop plays with — and the
// renderer paints it twice, so the frame is what the game really looks like at that
// moment, and the same seed always gives the same frame.
import { SCREEN_LEVEL, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/**
 * Set `world` to the named scene (start, play, alert or exit; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  const state = world.state;
  if (name === 'play') {
    // Half-seen: the player crouches behind the first shelf while a guard's cone
    // sweeps close, the meter half full, one relic already pocketed.
    world.loadLevel(0);
    state.player.x = 380;
    state.player.y = 330;
    state.player.angle = Math.PI / 2;
    const guard = state.level.guards[0];
    guard.x = 560;
    guard.y = 220;
    guard.angle = Math.atan2(330 - 220, 380 - 560);
    guard.state = 'suspect';
    guard.lastSeen = { x: 380, y: 330 };
    state.meter = 0.55;
    state.level.artifacts[0].taken = true;
    state.artifactsTaken = 1;
    state.score = 100;
    state.levelScore = 100;
    state.elapsed = 47;
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'alert') {
    // Caught in the open: the meter is full, the nearest guard is chasing, the
    // player runs for the shelves with one chance already gone.
    world.loadLevel(1);
    state.player.x = 700;
    state.player.y = 400;
    state.player.angle = Math.PI / 4;
    const guard = state.level.guards[2];
    guard.x = 648;
    guard.y = 348;
    guard.angle = Math.atan2(400 - 348, 700 - 648);
    guard.state = 'chase';
    guard.lastSeen = { x: 700, y: 400 };
    state.meter = 1;
    state.spotted = true;
    state.chances = 2;
    state.score = 100;
    state.elapsed = 132;
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'exit') {
    // The floor cleared unseen: every relic pocketed, the ghost bonus earned.
    world.loadLevel(0);
    state.player.x = 1185;
    state.player.y = 44;
    state.player.angle = -Math.PI / 2;
    for (const artifact of state.level.artifacts) artifact.taken = true;
    state.artifactsTaken = 3;
    state.score = 830;
    state.levelScore = 830;
    state.lastBonus = { name: 'The Reading Room', taken: 3, total: 3, timeBonus: 180, ghost: 150 };
    state.elapsed = 94;
    return { screen: SCREEN_LEVEL, best: 0 };
  }
  // start: the title over the first floor, guards already on patrol.
  world.loadLevel(0);
  for (let step = 0; step < 6 * 60; step += 1) {
    world.step(1 / 60, { x: 0, y: 0 }, false, null);
  }
  state.meter = 0;
  return { screen: SCREEN_TITLE, best: 0 };
}
