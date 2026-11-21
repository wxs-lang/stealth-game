// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between seven screens: title, play, paused, caught, floor
// cleared, game over and victory.
//
// ?seed=N fixes the random pattern. ?shot=start|play|alert|exit (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_ARTIFACT, EVENT_CAUGHT, EVENT_LEVEL, EVENT_OVER, EVENT_SPOTTED, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, createInput } from './input.js';
import {
  SCREEN_CAUGHT,
  SCREEN_LEVEL,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
  createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** Seconds the caught screen stays up before the floor restarts. */
const CAUGHT_SECONDS = 1.4;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, 1.2, world.state.lastBonus ?? { name: '', taken: 0, total: 0, timeBonus: 0, ghost: 0 });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let caughtUntil = 0;
  let time = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${world.state.level.def.name}. Reach the green door unseen.`);
  }

  function finishRun(win) {
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    screen = win ? SCREEN_WIN : SCREEN_OVER;
    announce(win ? `All floors cleared. Score ${world.state.score}. Best ${best}.` : `Caught. Score ${world.state.score}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) startGame();
      else if (screen === SCREEN_LEVEL) screen = SCREEN_PLAY;
      else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // The title's backdrop: the first floor patrols on, harmlessly.
      world.step(STEP, { x: 0, y: 0 }, false, null);
      return;
    }
    if (screen === SCREEN_CAUGHT) {
      if (performance.now() >= caughtUntil) screen = SCREEN_PLAY;
      return;
    }
    const throwAt = input.takeThrow();
    const events = world.step(STEP, input.move(), input.sneaking(), throwAt);
    if (events & EVENT_ARTIFACT) announce(`Relic pocketed. ${world.state.artifactsTaken} taken.`);
    if (events & EVENT_SPOTTED) announce('Spotted! Break line of sight!');
    if (events & EVENT_CAUGHT) {
      if (events & EVENT_OVER) {
        finishRun(false);
      } else {
        screen = SCREEN_CAUGHT;
        caughtUntil = performance.now() + CAUGHT_SECONDS * 1000;
        announce(`Spotted! ${world.state.chances} chances left.`);
      }
    } else if (events & EVENT_WIN) {
      finishRun(true);
    } else if (events & EVENT_LEVEL) {
      screen = SCREEN_LEVEL;
      announce(`${world.state.level.def.name}. Press Space for the next floor.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    time += dt;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY || screen === SCREEN_CAUGHT) {
      accumulator += dt;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY || screen === SCREEN_CAUGHT)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, time, world.state.lastBonus ?? { name: '', taken: 0, total: 0, timeBonus: 0, ghost: 0 });
  }

  // Leaving the tab pauses a running game rather than letting guards close in unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  // A handle for play-testing: the live state and screen, read-only from outside.
  window.__game = {
    state: world.state,
    screen: () => screen,
  };

  announce('The Night Archivist. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
