/** Gameplay constants in one place so balancing never needs a code search. */
export const TUNING = {
  charge: {
    radius: 150,
    /** Velocity change at the blast centre is pressure / density (px per second). */
    pressure: 1.1,
    damage: 110,
    /** Fraction of the blast pushed upwards, as a ground charge would. */
    lift: 0.3,
    placementSpacing: 26,
    pickRadius: 24,
    /** Detonation delays, as on a real blasting machine: new charges default to one step after the last. */
    delay: { defaultStep: 0.35, step: 0.05, max: 2 },
  },
  barrel: {
    radius: 16,
    blastRadius: 135,
    pressure: 1.0,
    damage: 95,
    /** Damage that sets a barrel off. */
    trigger: 12,
    /** Chain reaction delay, so each link reads separately. */
    delay: 0.12,
  },
  vehicle: {
    /** A wrecked car's fuel tank goes up after this delay. */
    delay: 0.15,
    blastRadius: 110,
    pressure: 0.8,
    damage: 70,
    /** Any blast damage above this stops the engine (the driver bails out). */
    stallDamage: 4,
    /** Tilt beyond which a car can no longer drive. */
    maxTilt: 0.6,
  },
  impact: {
    /** Relative speed below which contacts do no damage (px per second). */
    threshold: 260,
    damagePerSpeed: 0.11,
    /** Minimum intensity (0..1) worth reporting as a hit sound. */
    reportAbove: 0.12,
  },
  shard: {
    minSize: 6,
    burstSpeed: 160,
    spin: 6,
  },
  settle: {
    linear: 8,
    angular: 0.15,
    hold: 0.6,
    timeout: 8,
  },
  collapse: {
    displacement: 30,
    rotation: 0.5,
  },
  /** A protected building counts as damaged when it moves or tilts this much, or loses this share of its strength. */
  protection: {
    displacement: 12,
    rotation: 0.15,
    strengthLoss: 0.5,
  },
  /** A target is down when its clearance above the ground is at most this many px... */
  downTolerance: 6,
  /** ...or at most this fraction of the clearance it started with. */
  downFraction: 0.4,
  debrisBudget: 170,
  outOfBoundsMargin: 160,
} as const;
