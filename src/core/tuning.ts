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
  /** A shaped precision charge: cuts as hard as a standard one, but over a small radius and with little throw. */
  precision: {
    radius: 85,
    pressure: 0.5,
    damage: 110,
  },
  /**
   * An implosion charge pulls instead of pushing: it cracks the mortar around it
   * and draws the structure in on itself, so it folds onto its own footprint.
   * `pull` is the inward speed per px of distance (per second), so bodies converge instead of overshooting.
   */
  implosion: {
    radius: 130,
    pressure: 0.8,
    pull: 2.2,
    /** Downward speed at the centre (px/s): the core drops first and the walls follow it in. */
    drop: 220,
    damage: 110,
  },
  /** A free-fall bomb: released on Fire, falls under gravity, set off by the detonator or its fuse. */
  bomb: {
    radius: 11,
    blastRadius: 140,
    pressure: 1.05,
    damage: 115,
    /** Seconds after release before the fuse sets it off by itself. */
    fuse: 4,
    /** Blast damage that sets a bomb off (sympathetic detonation). */
    trigger: 12,
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
  /** Mortar and welds between blocks. */
  joints: {
    /** A blast cuts every joint within this share of its radius. */
    cut: 0.6,
    /** A block cracked past this share of its strength comes loose from its neighbours. */
    crackDamage: 0.6,
  },
  /**
   * A protected building counts as damaged when it moves or tilts this much, or loses this share of its strength.
   * `blastReach` is the share of a blast's radius that must not touch it: the faint outer fringe is forgiven.
   */
  protection: {
    displacement: 14,
    rotation: 0.17,
    strengthLoss: 0.58,
    blastReach: 0.85,
  },
  /** Footprint jobs accept this share of the stated containment ratio: a little spill is forgiven. */
  footprintSlack: 0.85,
  /** A target is down when its clearance above the ground is at most this many px... */
  downTolerance: 7,
  /** ...or at most this fraction of the clearance it started with. */
  downFraction: 0.46,
  debrisBudget: 170,
  outOfBoundsMargin: 160,
} as const;
