// Every tuning number, colour and level layout in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends on
// the screen size. Walls and cover are rectangles: both block movement, both block sight.
export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 13,
  speed: 155,
  sneakSpeed: 88,
  /** How far a thrown pebble may land from the player. */
  throwRange: 300,
};

export const GUARD = {
  radius: 13,
  patrolSpeed: 58,
  chaseSpeed: 122,
  investigateSpeed: 85,
  returnSpeed: 70,
  /** Vision cone: how far a guard sees, and half its opening angle. */
  viewRange: 240,
  viewHalfAngle: 0.55,
  /** Seconds a guard pauses at each patrol waypoint. */
  waypointPause: 1.1,
  /** Seconds a guard searches the last seen spot before giving up. */
  searchTime: 2.5,
  /** Seconds a guard stands at a pebble's landing spot. */
  investigateTime: 2.5,
};

export const CAMERA = {
  viewRange: 240,
  viewHalfAngle: 0.5,
  /** Radians per second the camera sweeps. */
  sweepSpeed: 0.45,
};

export const DETECTION = {
  /** Fill per second when the player is seen point blank; falls off with distance. */
  closeRate: 1.7,
  farRate: 0.35,
  /** Multipliers on the fill rate. */
  sneakMultiplier: 0.45,
  movingMultiplier: 1.15,
  /** Drain per second once the player is out of every sightline. */
  decayRate: 0.5,
  /** The meter level at which a guard turns to investigate what it half-saw. */
  suspectAt: 0.35,
};

export const ARTIFACT_POINTS = 100;
export const LEVEL_POINTS = 200;
export const GHOST_BONUS = 150;
export const PEBBLES_PER_LEVEL = 5;
export const CHANCES = 3;

export const PALETTE = {
  backdrop: '#0b0e14',
  floor: '#1a1f2b',
  floorLine: '#232a3a',
  wall: '#3d4557',
  wallTop: '#565f75',
  shelf: '#4a3b28',
  shelfEdge: '#6b5636',
  shelfBookA: '#7a5a3a',
  shelfBookB: '#5a6b7a',
  shelfBookC: '#7a4a4a',
  crate: '#5a4a30',
  crateEdge: '#7a6742',
  player: '#4fc3f7',
  playerLantern: 'rgba(255, 214, 130, 0.10)',
  guard: '#c94f4f',
  guardCone: 'rgba(255, 210, 90, 0.16)',
  guardConeEdge: 'rgba(255, 210, 90, 0.45)',
  guardConeAlert: 'rgba(255, 80, 60, 0.22)',
  camera: '#8a93a3',
  cameraCone: 'rgba(255, 120, 90, 0.13)',
  exit: '#58d68d',
  exitGlow: 'rgba(88, 214, 141, 0.18)',
  artifact: '#f2c94c',
  artifactGlow: 'rgba(242, 201, 76, 0.20)',
  pebble: '#d8cdb2',
  panel: '#202634',
  text: '#eef1f5',
  muted: '#9aa3b5',
  danger: '#ff6b5e',
  gold: '#f2c94c',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'night-archivist.best';

/** A wall or cover rectangle: { x, y, w, h }. */
function rect(x, y, w, h) {
  return { x, y, w, h };
}

const BORDER = [
  rect(0, 0, 1280, 24),
  rect(0, 696, 1280, 24),
  rect(0, 0, 24, 720),
  rect(1256, 0, 24, 720),
];

/**
 * The three floors of the museum, easiest first. Each level is one screen: the whole
 * floor is visible at once, so the player can always read the patrols before moving.
 */
export const LEVELS = [
  {
    name: 'The Reading Room',
    intro: 'Slip past the night watch. Reach the green door unseen.',
    player: { x: 84, y: 636 },
    exit: rect(1150, 24, 70, 34),
    walls: [
      ...BORDER,
      rect(180, 300, 120, 24),
      rect(900, 540, 120, 24),
    ],
    cover: [
      rect(300, 140, 40, 300),
      rect(560, 300, 40, 300),
      rect(820, 120, 40, 280),
      rect(420, 480, 260, 40),
      rect(980, 460, 180, 40),
    ],
    guards: [
      { waypoints: [[380, 220], [880, 220]], speed: 55, pause: 1.2 },
      { waypoints: [[1080, 320], [1080, 580]], speed: 50, pause: 1.0 },
    ],
    cameras: [],
    artifacts: [{ x: 340, y: 620 }, { x: 700, y: 420 }, { x: 1160, y: 200 }],
  },
  {
    name: 'The Gallery',
    intro: 'A camera sweeps the hall now. Mind the red cone too.',
    player: { x: 84, y: 636 },
    exit: rect(1150, 24, 70, 34),
    walls: [
      ...BORDER,
      rect(150, 420, 140, 24),
      rect(980, 200, 140, 24),
    ],
    cover: [
      rect(260, 120, 40, 260),
      rect(520, 380, 40, 260),
      rect(780, 120, 40, 260),
      rect(1040, 380, 40, 260),
      rect(380, 240, 220, 40),
      rect(700, 520, 220, 40),
    ],
    guards: [
      { waypoints: [[300, 480], [760, 480]], speed: 60, pause: 1.0 },
      { waypoints: [[900, 200], [1180, 200]], speed: 60, pause: 1.0 },
      { waypoints: [[640, 640], [640, 320]], speed: 55, pause: 1.2 },
    ],
    cameras: [
      { x: 640, y: 30, baseAngle: Math.PI / 2, sweep: 1.2, speed: 0.45 },
    ],
    artifacts: [{ x: 300, y: 84 }, { x: 920, y: 620 }, { x: 1180, y: 420 }],
  },
  {
    name: 'The Vault',
    intro: 'Four guards, two cameras, one door. Make it count.',
    player: { x: 84, y: 636 },
    exit: rect(80, 24, 70, 34),
    walls: [
      ...BORDER,
      rect(180, 500, 120, 24),
      rect(1000, 180, 120, 24),
    ],
    cover: [
      rect(240, 140, 40, 240),
      rect(480, 360, 40, 260),
      rect(720, 140, 40, 240),
      rect(960, 360, 40, 260),
      rect(340, 300, 200, 40),
      rect(740, 540, 200, 40),
    ],
    guards: [
      { waypoints: [[300, 220], [900, 220]], speed: 65, pause: 0.9 },
      { waypoints: [[1080, 300], [1080, 600]], speed: 60, pause: 1.0 },
      { waypoints: [[420, 620], [900, 620]], speed: 60, pause: 1.0 },
      { waypoints: [[640, 120], [640, 420]], speed: 55, pause: 1.2 },
    ],
    cameras: [
      { x: 320, y: 30, baseAngle: Math.PI / 2, sweep: 1.1, speed: 0.5 },
      { x: 960, y: 690, baseAngle: -Math.PI / 2, sweep: 1.1, speed: 0.5 },
    ],
    artifacts: [{ x: 180, y: 120 }, { x: 1180, y: 640 }, { x: 640, y: 320 }],
  },
];
