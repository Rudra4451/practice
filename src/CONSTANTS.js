/* ==========================================================================
   Apex Horizon - Central Game Constants (extracted from all modules)
   ========================================================================== */

// ─── World Boundaries ────────────────────────────────────────────────────────
export const WORLD_SIZE = 4000;
export const WORLD_HALF = 2000;

// ─── Zone Quadrant Thresholds ────────────────────────────────────────────────
export const ZONE_CITY_X_MIN = -2000;
export const ZONE_CITY_X_MAX = 0;
export const ZONE_CITY_Z_MIN = 0;
export const ZONE_CITY_Z_MAX = 2000;

export const ZONE_SPEED_X_MIN = 0;
export const ZONE_SPEED_X_MAX = 2000;

export const ZONE_BEACH_Z_MAX = 0;
export const ZONE_BEACH_Z_MIN = -2000;

// ─── Physics Engine ──────────────────────────────────────────────────────────
export const GRAVITY = -9.82;
export const PHYSICS_MAX_BODIES = 150;
export const PHYSICS_SOLVER_ITERATIONS = 8;
export const PHYSICS_FIXED_STEP = 1 / 60;

// ─── Car Physics Defaults ────────────────────────────────────────────────────
export const WHEEL_RADIUS_NORMAL = 0.35;
export const WHEEL_RADIUS_OFFROAD = 0.5;
export const CHASSIS_HALF_WIDTH = 1.0;
export const CHASSIS_HALF_HEIGHT = 0.5;
export const CHASSIS_HALF_LENGTH = 2.0;
export const SUSPENSION_REST_LENGTH = 0.3;
export const MAX_SUSPENSION_FORCE = 100000;
export const MAX_SUSPENSION_TRAVEL = 0.3;
export const ROLL_INFLUENCE = 0.01;
export const ANGULAR_VELOCITY_CAP = 5.0;

// Default suspension per class (overridden per car in CAR_ROSTER.physics)
export const SUSPENSION_DEFAULTS = {
  stiffness: 30,
  dampingRelaxation: 2.3,
  dampingCompression: 4.4
};

// ─── RPM & Gears ─────────────────────────────────────────────────────────────
export const IDLE_RPM = 900;
export const MAX_RPM = 9000;
export const GEAR_SPEED_LIMITS = [45, 80, 130, 185, 250, 430];

// ─── Nitro ───────────────────────────────────────────────────────────────────
export const NITRO_DURATION = 3.0;
export const NITRO_COOLDOWN = 13.0;
export const NITRO_FORCE_MULTIPLIER = 2.0;

// ─── Friction Spec Targets (gripLevel × multiplier ≈ target) ─────────────────
// Spec: asphalt 1.4, wet asphalt 0.7, sand 0.5, mud 0.3, water 0.2
export const FRICTION = {
  ASPHALT: 1.0,        // gripLevel * 1.0 = gripLevel (~1.4)
  RACING_ASPHALT: 1.05, // Slightly grippier
  SAND: 0.36,          // gripLevel * 0.36 ≈ 0.50
  MUD: 0.22,           // gripLevel * 0.22 ≈ 0.30
  WATER: 0.14,         // gripLevel * 0.14 ≈ 0.20
  WET_PENALTY: 0.50,   // 50% reduction in rain
};

// ─── NPC Traffic ─────────────────────────────────────────────────────────────
export const NPC_CAR_POOL_SIZE = 20;
export const NPC_RECYCLE_DISTANCE = 300;
export const NPC_RESPAWN_MIN_DIST = 100;
export const NPC_RESPAWN_MAX_DIST = 220;
export const NPC_SPEED_MIN = 40;
export const NPC_SPEED_MAX = 60;
export const NPC_STUCK_SPEED_THRESHOLD = 0.5;
export const NPC_STUCK_TIME_LIMIT = 3.0;
export const TRAFFIC_LIGHT_CYCLE_SECONDS = 8.0;

// ─── Pedestrians ─────────────────────────────────────────────────────────────
export const PEDESTRIAN_POOL_SIZE = 30;
export const PEDESTRIAN_WALK_SPEED = 1.2;
export const PEDESTRIAN_FLEE_MULTIPLIER = 2.0;
export const PEDESTRIAN_FLEE_RADIUS = 5.0;
export const PEDESTRIAN_Z_MIN = 80;
export const PEDESTRIAN_Z_MAX = 1950;
export const PEDESTRIAN_X_MIN = -2000;
export const PEDESTRIAN_X_MAX = -50;

// ─── Speedway / Drag Strip ───────────────────────────────────────────────────
export const DRAG_START_X = 200;
export const DRAG_END_X = 1700;
export const DRAG_LINE_Z = 500;
export const DRAG_STRIP_HALF_WIDTH = 18;
export const DRAG_RESTART_COOLDOWN = 2.0;
export const SPEED_TRAP_COOLDOWN = 3.0;

// ─── Credits & Economy ───────────────────────────────────────────────────────
export const CREDITS_CAP = 9_999_999;
export const CREDITS_PER_100M = 5;
export const CREDITS_SPEEDWAY_BONUS = 100;
export const CREDITS_SPEEDWAY_INTERVAL = 10.0;

// ─── Day/Night ───────────────────────────────────────────────────────────────
export const DAY_NIGHT_CYCLE_DURATION = 600;
export const HEADLIGHT_AUTO_THRESHOLD = 0.1; // sunY below this → headlights on

// ─── Rain/Weather ────────────────────────────────────────────────────────────
export const RAIN_PARTICLE_COUNT = 10000;

// ─── Camera ──────────────────────────────────────────────────────────────────
export const CAMERA_SNAP_DISTANCE = 20;
export const CAMERA_CHASE_OFFSET_BACK = 6.2;
export const CAMERA_CHASE_OFFSET_UP = 2.3;
export const CAMERA_CHASE_LERP = 0.08;

// ─── City Zone ───────────────────────────────────────────────────────────────
export const CITY_BUILDING_COUNT = 80;
export const CITY_BLOCK_SPACING = 450;
export const CITY_LANE_WIDTH = 14;

// ─── Graphics Quality Tiers ──────────────────────────────────────────────────
export const QUALITY_TIERS = {
  low: {
    shadows: false,
    pixelRatio: 1,
    shadowMapSize: 256,
    bloom: false,
  },
  medium: {
    shadows: true,
    pixelRatio: 1.5,
    shadowMapSize: 512,
    bloom: false,
  },
  high: {
    shadows: true,
    pixelRatio: 2,
    shadowMapSize: 1024,
    bloom: true,
  }
};
