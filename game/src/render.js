// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Vision cones are ray-cast against walls and cover, so light stops at cover the
// way sight does. Flat shapes, canvas text for the HUD and the panels.
import { CAMERA, CHANCES, FIELD, FONT, GUARD, PALETTE } from './config.js';
import { rayDistance } from './vision.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_LEVEL = 'level';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

/** Rays across a cone when ray-casting its outline. */
const CONE_RAYS = 26;
const PANEL = { width: 620, top: 150, line: 32, bottom: 64 };

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const timeLabel = cachedLabel('');
  const scoreLabel = cachedLabel('Score ');
  const bestLabel = cachedLabel('Best ');

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function drawFloor() {
    context.fillStyle = PALETTE.floor;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    // Faint floor tiles, for depth without noise.
    context.strokeStyle = PALETTE.floorLine;
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 80; x < FIELD.width; x += 80) {
      context.moveTo(x, 0);
      context.lineTo(x, FIELD.height);
    }
    for (let y = 80; y < FIELD.height; y += 80) {
      context.moveTo(0, y);
      context.lineTo(FIELD.width, y);
    }
    context.stroke();
  }

  /** A vision cone clipped by walls and cover, as a filled polygon of ray endpoints. */
  function drawCone(x, y, angle, range, halfAngle, blockers, fill, edge) {
    context.beginPath();
    context.moveTo(x, y);
    for (let i = 0; i <= CONE_RAYS; i += 1) {
      const a = angle - halfAngle + (2 * halfAngle * i) / CONE_RAYS;
      const dx = Math.cos(a);
      const dy = Math.sin(a);
      const hit = rayDistance(x, y, dx, dy, blockers);
      const reach = Math.min(range, hit);
      context.lineTo(x + dx * reach, y + dy * reach);
    }
    context.closePath();
    context.fillStyle = fill;
    context.fill();
    context.strokeStyle = edge;
    context.lineWidth = 1.5;
    context.stroke();
  }

  function drawWallsAndCover(level) {
    for (const wall of level.def.walls) {
      context.fillStyle = PALETTE.wall;
      context.fillRect(wall.x, wall.y, wall.w, wall.h);
      context.fillStyle = PALETTE.wallTop;
      context.fillRect(wall.x, wall.y, wall.w, 4);
    }
    for (const shelf of level.def.cover) {
      context.fillStyle = PALETTE.shelf;
      context.fillRect(shelf.x, shelf.y, shelf.w, shelf.h);
      context.fillStyle = PALETTE.shelfEdge;
      context.fillRect(shelf.x, shelf.y, shelf.w, 3);
      context.fillRect(shelf.x, shelf.y + shelf.h - 3, shelf.w, 3);
      // Book spines along a shelf, in three muted colours.
      const vertical = shelf.h > shelf.w;
      const books = [PALETTE.shelfBookA, PALETTE.shelfBookB, PALETTE.shelfBookC];
      const span = vertical ? shelf.h : shelf.w;
      for (let at = 8; at < span - 8; at += 14) {
        context.fillStyle = books[Math.floor(at / 14) % 3];
        if (vertical) context.fillRect(shelf.x + 5, shelf.y + at, shelf.w - 10, 9);
        else context.fillRect(shelf.x + at, shelf.y + 5, 9, shelf.h - 10);
      }
    }
  }

  function drawExit(level, time) {
    const exit = level.def.exit;
    const pulse = 0.5 + 0.5 * Math.sin(time * 3);
    context.fillStyle = PALETTE.exitGlow;
    context.fillRect(exit.x - 26, exit.y - 6, exit.w + 52, exit.h + 44);
    context.fillStyle = PALETTE.exit;
    context.fillRect(exit.x, exit.y, exit.w, exit.h);
    context.fillStyle = '#0b0e14';
    context.fillRect(exit.x + 10, exit.y + 8, exit.w - 20, exit.h - 8);
    context.fillStyle = `rgba(88, 214, 141, ${0.55 + 0.35 * pulse})`;
    context.font = `bold 15px ${FONT}`;
    context.textAlign = 'center';
    context.fillText('EXIT', exit.x + exit.w / 2, exit.y + exit.h + 18);
  }

  function drawArtifacts(level, time) {
    for (const artifact of level.artifacts) {
      if (artifact.taken) continue;
      const pulse = 0.5 + 0.5 * Math.sin(time * 4 + artifact.x);
      context.fillStyle = PALETTE.artifactGlow;
      context.beginPath();
      context.arc(artifact.x, artifact.y, 20 + 5 * pulse, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = PALETTE.artifact;
      context.beginPath();
      context.arc(artifact.x, artifact.y, 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#0b0e14';
      context.beginPath();
      context.arc(artifact.x, artifact.y, 4, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawPebbles(state) {
    for (const pebble of state.pebbles) {
      if (!pebble.active) continue;
      context.fillStyle = PALETTE.pebble;
      context.beginPath();
      context.arc(pebble.x, pebble.y, 4, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawGuards(level, time) {
    for (const guard of level.guards) {
      const alert = guard.state === 'chase';
      drawCone(
        guard.x,
        guard.y,
        guard.angle,
        GUARD.viewRange,
        GUARD.viewHalfAngle,
        level.blockers,
        alert ? PALETTE.guardConeAlert : PALETTE.guardCone,
        alert ? 'rgba(255, 80, 60, 0.6)' : PALETTE.guardConeEdge,
      );
      // The guard: a dark-red disc, a cap brim, and a direction tick.
      context.fillStyle = PALETTE.guard;
      context.beginPath();
      context.arc(guard.x, guard.y, GUARD.radius, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = '#5e1f1f';
      context.beginPath();
      context.arc(guard.x, guard.y, GUARD.radius - 5, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#ffd25a';
      context.lineWidth = 2.5;
      context.beginPath();
      context.moveTo(guard.x, guard.y);
      context.lineTo(guard.x + Math.cos(guard.angle) * (GUARD.radius + 6), guard.y + Math.sin(guard.angle) * (GUARD.radius + 6));
      context.stroke();
      if (alert) {
        text('!', guard.x, guard.y - GUARD.radius - 8, 22, PALETTE.danger, 'center');
      } else if (guard.state === 'suspect' || guard.state === 'investigate') {
        text('?', guard.x, guard.y - GUARD.radius - 8, 22, PALETTE.gold, 'center');
      }
    }
  }

  function drawCameras(level) {
    for (const camera of level.cameras) {
      drawCone(
        camera.x,
        camera.y,
        camera.angle,
        CAMERA.viewRange,
        CAMERA.viewHalfAngle,
        level.blockers,
        PALETTE.cameraCone,
        'rgba(255, 120, 90, 0.4)',
      );
      context.fillStyle = PALETTE.camera;
      context.fillRect(camera.x - 9, camera.y - 6, 18, 12);
      context.strokeStyle = '#ff785a';
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(camera.x, camera.y);
      context.lineTo(camera.x + Math.cos(camera.angle) * 20, camera.y + Math.sin(camera.angle) * 20);
      context.stroke();
    }
  }

  function drawPlayer(state, time) {
    const player = state.player;
    // The lantern's warm pool of light around the player.
    const glow = context.createRadialGradient(player.x, player.y, 8, player.x, player.y, 90);
    glow.addColorStop(0, PALETTE.playerLantern);
    glow.addColorStop(1, 'rgba(255, 214, 130, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(player.x, player.y, 90, 0, Math.PI * 2);
    context.fill();
    // The archivist: a teal disc with a hood point, blinking when sneaking is off.
    const blink = player.sneaking ? 1 : 0.6 + 0.4 * Math.sin(time * 2);
    context.globalAlpha = blink;
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(player.x, player.y, 13, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1;
    context.fillStyle = '#0b2a3a';
    context.beginPath();
    context.arc(player.x + Math.cos(player.angle) * 5, player.y + Math.sin(player.angle) * 5, 5, 0, Math.PI * 2);
    context.fill();
  }

  function drawHud(state) {
    const level = state.level;
    context.textBaseline = 'top';
    text(`${level.def.name}  ·  Floor ${state.levelIndex + 1} of 3`, 24, 16, 20, PALETTE.text, 'left');
    const minutes = Math.floor(state.elapsed / 60);
    const seconds = Math.floor(state.elapsed % 60);
    const timerText = timeLabel(`${minutes}:${String(seconds).padStart(2, '0')}`);
    context.fillStyle = 'rgba(11, 14, 20, 0.7)';
    context.fillRect(FIELD.width / 2 - 40, 10, 80, 28);
    text(timerText, FIELD.width / 2, 16, 20, PALETTE.muted, 'center');
    // Artifacts, pebbles and score on the right.
    let taken = 0;
    for (const artifact of level.artifacts) if (artifact.taken) taken += 1;
    text(`Relics ${taken}/${level.artifacts.length}   Pebbles ${state.pebblesLeft}   Score ${state.score}`, FIELD.width - 24, 16, 20, PALETTE.text, 'right');
    // Chances as lantern dots under the level name, clear of the exit door.
    for (let i = 0; i < CHANCES; i += 1) {
      context.fillStyle = i < state.chances ? PALETTE.gold : PALETTE.wall;
      context.beginPath();
      context.arc(28 + i * 22, 54, 6, 0, Math.PI * 2);
      context.fill();
    }
    // The detection meter: an eye bar across the top centre, loud when it fills.
    const meter = state.meter;
    const barWidth = 260;
    const barX = (FIELD.width - barWidth) / 2;
    const barY = 48;
    context.fillStyle = 'rgba(11, 14, 20, 0.7)';
    context.fillRect(barX - 8, barY - 8, barWidth + 16, 26);
    context.fillStyle = '#2a3040';
    context.fillRect(barX, barY, barWidth, 10);
    const fillColor = meter < 0.35 ? PALETTE.gold : meter < 1 ? '#ff9a3c' : PALETTE.danger;
    context.fillStyle = fillColor;
    context.fillRect(barX, barY, barWidth * meter, 10);
    if (meter > 0.02) {
      const label = meter >= 1 ? 'SPOTTED!' : meter >= 0.35 ? 'They saw something…' : 'Hiding…';
      text(label, FIELD.width / 2, barY + 16, 15, fillColor, 'center');
    }
    text('WASD move · Shift sneak · Click throws a pebble · P pause', FIELD.width / 2, FIELD.height - 26, 15, PALETTE.muted, 'center');
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = 'rgba(11, 14, 20, 0.72)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 76, 46, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 36, 22, PALETTE.gold, 'center');
  }

  function drawField(state, time) {
    drawFloor();
    drawExit(state.level, time);
    drawArtifacts(state.level, time);
    drawGuards(state.level, time);
    drawCameras(state.level);
    drawWallsAndCover(state.level);
    drawPebbles(state);
    drawPlayer(state, time);
  }

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, time, levelSummary) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    const level = state.level;
    if (screen === SCREEN_TITLE) {
      drawField(state, time);
      const lines = [
        level.def.intro,
        'Move with WASD or arrows. Hold Shift to sneak, unseen and slow.',
        'Click to throw a pebble and pull a guard away. Pocket the gold relics.',
        '',
        bestLabel(best),
      ];
      drawPanel('The Night Archivist', lines, 'Press Space or click to begin');
      return;
    }
    drawField(state, time);
    drawHud(state);
    if (screen === SCREEN_CAUGHT) {
      context.fillStyle = 'rgba(255, 60, 40, 0.18)';
      context.fillRect(0, 0, FIELD.width, FIELD.height);
      text('SPOTTED!', FIELD.width / 2, 300, 64, PALETTE.danger, 'center');
      text(state.chances > 0 ? `${state.chances} ${state.chances === 1 ? 'chance' : 'chances'} left` : '', FIELD.width / 2, 370, 24, PALETTE.text, 'center');
    } else if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The guards will wait for you.'], 'Press P to resume');
    } else if (screen === SCREEN_LEVEL) {
      const lines = [
        `${levelSummary.name} cleared.`,
        `Relics ${levelSummary.taken} of ${levelSummary.total}  ·  Time bonus ${levelSummary.timeBonus}`,
        levelSummary.ghost > 0 ? `Ghost bonus ${levelSummary.ghost} — never spotted` : 'Spotted once — no ghost bonus this floor',
        '',
        scoreLabel(state.score),
      ];
      drawPanel('Floor cleared', lines, 'Press Space for the next floor');
    } else if (screen === SCREEN_OVER) {
      const lines = ['', scoreLabel(state.score), bestLabel(best)];
      drawPanel('Caught for the last time', lines, 'Press Space to try again');
    } else if (screen === SCREEN_WIN) {
      const lines = [
        `Every relic ${state.artifactsTaken} pocketed, every floor crossed.`,
        '',
        scoreLabel(state.score),
        bestLabel(best),
      ];
      drawPanel('The archive is yours', lines, 'Press Space to play again');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
