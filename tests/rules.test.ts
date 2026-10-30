import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/core/events';
import { parseLevel, parseLevelPack } from '../src/core/level';
import { createRng } from '../src/core/math';
import {
  emptyProgress,
  isLevelUnlocked,
  parseProgress,
  recordScore,
  recordStars,
  totalStars,
  updateSettings,
  worldStars,
  worldStatus,
} from '../src/core/progress';
import { parseWorlds } from '../src/core/world';
import { scoreLevel } from '../src/core/scoring';
import { difficultyOf } from '../src/core/difficulty';
import { loadCampaign } from '../src/content/levels';
import { shatter } from '../src/core/shatter';
import { circleTouches, polygonArea, polygonCentroid, rectVertices, splitConvex } from '../src/core/shapes';
import { MATERIALS } from '../src/core/materials';
import { TUNING } from '../src/core/tuning';
import { LocalSaveRepository, type KeyValueStore } from '../src/infrastructure/local-save';

const validLevel = {
  id: 'w1-01',
  name: 'A',
  world: 1,
  order: 1,
  charges: { max: 2, par: 1 },
  bonusCollapse: 0.5,
  zones: [{ x: 0, y: 400, w: 100, h: 80 }],
  blocks: [{ x: 500, y: 300, w: 40, h: 40, material: 'wood', target: true }],
  solution: { charges: [{ x: 50, y: 450 }] },
};

describe('level parsing', () => {
  it('accepts a valid level and fills defaults', () => {
    const r = parseLevel(validLevel);
    expect(r.ok && r.value.barrels).toEqual([]);
    expect(r.ok && r.value.blocks[0]?.angle).toBe(0);
  });

  it.each([
    ['unknown material', { blocks: [{ ...validLevel.blocks[0], material: 'cheese' }] }, 'blocks[0].material'],
    ['no target', { blocks: [{ ...validLevel.blocks[0], target: false }] }, 'blocks'],
    ['target on the ground', { blocks: [{ ...validLevel.blocks[0], y: 455 }] }, 'blocks[0]'],
    ['par above max', { charges: { max: 1, par: 2 } }, 'charges.par'],
    ['no zones', { zones: [] }, 'zones'],
    ['solution too long', { solution: { charges: [{ x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }] } }, 'solution'],
    ['car off its route', { cars: [{ x: 10, y: 300, w: 50, h: 20, from: 100, to: 200, speed: 50 }] }, 'cars[0].x'],
    [
      'grounded target car',
      { cars: [{ x: 150, y: 470, w: 50, h: 20, from: 100, to: 200, speed: 50, target: true }] },
      'cars[0]',
    ],
  ])('rejects %s with its path', (_name, patch, path) => {
    const r = parseLevel({ ...validLevel, ...patch });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.path).toContain(path);
  });

  it('rejects duplicate ids in a pack and sorts by world and order', () => {
    expect(parseLevelPack([validLevel, validLevel]).ok).toBe(false);
    const pack = parseLevelPack([{ ...validLevel, id: 'b', order: 2 }, validLevel]);
    expect(pack.ok && pack.value.map((l) => l.id)).toEqual(['w1-01', 'b']);
  });
});

describe('world parsing', () => {
  it('sorts cities and rejects duplicates or blanks', () => {
    const a = { world: 2, key: 'paris', city: 'Paris', country: 'FR', unlockStars: 5 };
    const b = { world: 1, key: 'ankara', city: 'Ankara', country: 'TR', unlockStars: 0 };
    const r = parseWorlds([a, b]);
    expect(r.ok && r.value.map((w) => w.key)).toEqual(['ankara', 'paris']);
    expect(parseWorlds([a, a]).ok).toBe(false);
    expect(parseWorlds([{ ...a, city: '' }]).ok).toBe(false);
  });
});

describe('scoring', () => {
  const base = {
    targetsDown: 1,
    targetsTotal: 1,
    chargesUsed: 1,
    chargesMax: 2,
    blocksCollapsed: 6,
    blocksTotal: 10,
    protectedTotal: 1,
    protectedDamaged: 0,
    duration: 3,
    footprint: undefined,
    dominoes: 0,
    demolished: {},
  };
  const rules = { par: 1, bonusCollapse: 0.5 };
  it('awards a star per play style on top of success', () => {
    expect(scoreLevel(base, rules).stars).toBe(3);
    expect(scoreLevel({ ...base, chargesUsed: 2 }, rules).stars).toBe(2);
    expect(scoreLevel({ ...base, blocksCollapsed: 1 }, rules).stars).toBe(2);
    expect(scoreLevel({ ...base, chargesUsed: 2, blocksCollapsed: 1 }, rules).stars).toBe(1);
  });

  it('lets a domino finish stand in for either other style', () => {
    const brute = { ...base, chargesUsed: 2 };
    expect(scoreLevel({ ...brute, dominoes: 1 }, rules)).toMatchObject({ stars: 3, styles: { surgical: false, demolition: true, domino: true } });
    expect(scoreLevel({ ...brute, blocksCollapsed: 1, dominoes: 1 }, rules).stars).toBe(2);
    expect(scoreLevel({ ...brute, blocksCollapsed: 1 }, rules).stars).toBe(1);
  });

  it('never gives more than three stars', () => {
    expect(scoreLevel({ ...base, dominoes: 2 }, rules).stars).toBe(3);
  });

  it('fails the job while a target stands, however much of the structure came down', () => {
    const most = scoreLevel({ ...base, targetsDown: 0, dominoes: 1 }, { par: 1, bonusCollapse: 0.5 });
    expect(most).toMatchObject({ cleared: false, stars: 0, score: 0, failure: 'target-standing' });
    const all = scoreLevel({ ...base, targetsDown: 0, blocksCollapsed: base.blocksTotal }, { par: 1, bonusCollapse: 0.5 });
    expect(all).toMatchObject({ cleared: false, stars: 0, score: 0, collapseRatio: 1 });
  });

  it('fails the job when debris spills off the site, even with every target down', () => {
    const r = scoreLevel({ ...base, footprint: { achieved: 0.5, required: 0.8 } }, { par: 1, bonusCollapse: 0.5 });
    expect(r).toMatchObject({ cleared: false, failure: 'debris-outside', stars: 0, score: 0 });
  });

  it('gives no stars when too little came down', () => {
    const r = scoreLevel({ ...base, targetsDown: 0, blocksCollapsed: 2 }, { par: 1, bonusCollapse: 0.5 });
    expect(r).toMatchObject({ cleared: false, failure: 'target-standing', stars: 0, score: 0, underPar: true });
  });

  it('fails the job when a protected building is damaged, even with every target down', () => {
    const r = scoreLevel({ ...base, protectedDamaged: 1 }, { par: 1, bonusCollapse: 0.5 });
    expect(r).toMatchObject({ cleared: false, failure: 'collateral-damage', stars: 0, score: 0 });
  });

  it('scores spare charges and collapse', () => {
    // 1000 base + 300 for one unused charge + 500 × 0.6 collapse.
    expect(scoreLevel(base, { par: 1, bonusCollapse: 0.5 }).score).toBe(1600);
  });
});

describe('progress', () => {
  it('keeps the best score only, and reads saves made before scores existed', () => {
    let p = recordScore(emptyProgress(), 'a', 1500);
    p = recordScore(p, 'a', 900);
    expect(p.best.a).toBe(1500);
    const legacy = parseProgress({ version: 1, stars: { a: 2 }, settings: {} });
    expect(legacy.ok && legacy.value.best).toEqual({});
  });

  it('keeps the best stars only', () => {
    let p = recordStars(emptyProgress(), 'a', 2);
    p = recordStars(p, 'a', 1);
    expect(p.stars.a).toBe(2);
    expect(totalStars(recordStars(p, 'b', 3))).toBe(5);
  });

  const city = (world: number, unlockStars = 0) => ({ world, key: `c${world}`, city: `C${world}`, country: 'X', unlockStars });
  const campaign = () => {
    const pack = parseLevelPack([
      validLevel,
      { ...validLevel, id: 'w1-02', order: 2 },
      { ...validLevel, id: 'w2-01', world: 2 },
    ]);
    if (!pack.ok) throw new Error('pack');
    return { worlds: [city(1), city(2, 2), city(3)], levels: pack.value };
  };

  it('unlocks levels in order', () => {
    const c = campaign();
    expect(isLevelUnlocked(emptyProgress(), c, 'w1-01')).toBe(true);
    expect(isLevelUnlocked(emptyProgress(), c, 'w1-02')).toBe(false);
    expect(isLevelUnlocked(recordStars(emptyProgress(), 'w1-01', 1), c, 'w1-02')).toBe(true);
  });

  it('opens a city once the previous city is finished and its stars are earned', () => {
    const c = campaign();
    const oneLevel = recordStars(emptyProgress(), 'w1-01', 3);
    expect(worldStatus(oneLevel, c, 2)).toEqual({ kind: 'locked', needsStars: 0, needsPrevious: true });
    const finished = recordStars(recordStars(emptyProgress(), 'w1-01', 1), 'w1-02', 1);
    expect(worldStars(finished, c, 1)).toBe(2);
    expect(worldStatus(finished, c, 2)).toEqual({ kind: 'open' });
    expect(isLevelUnlocked(finished, c, 'w2-01')).toBe(true);
    const finishedLow = recordStars(recordStars(emptyProgress(), 'w1-01', 1), 'w1-02', 0);
    expect(worldStatus(finishedLow, c, 2)).toMatchObject({ kind: 'locked', needsPrevious: true });
    expect(worldStatus(emptyProgress(), c, 3)).toEqual({ kind: 'coming-soon' });
  });

  it('round-trips and repairs individual bad settings', () => {
    const p = updateSettings(recordStars(emptyProgress(), 'a', 3), { sfxVolume: 0.2 });
    expect(parseProgress(JSON.parse(JSON.stringify(p)))).toEqual({ ok: true, value: p });
    const repaired = parseProgress({ ...p, settings: { ...p.settings, sfxVolume: 7 } });
    expect(repaired.ok && repaired.value.settings.sfxVolume).toBe(emptyProgress().settings.sfxVolume);
  });

  it('rejects unknown versions and bad stars', () => {
    expect(parseProgress({ version: 99, stars: {} }).ok).toBe(false);
    expect(parseProgress({ version: 1, stars: { a: 5 } }).ok).toBe(false);
  });
});

describe('local save', () => {
  const memory = (): KeyValueStore & { data: Map<string, string> } => {
    const data = new Map<string, string>();
    return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
  };

  it('falls back to the backup when the primary is corrupt', () => {
    const store = memory();
    const repo = new LocalSaveRepository(store);
    repo.save(recordStars(emptyProgress(), 'a', 1));
    repo.save(recordStars(emptyProgress(), 'a', 2));
    store.data.set('fuse-and-fall/progress', '{broken');
    expect(repo.load().stars.a).toBe(1);
  });

  it('sets an unreadable save aside instead of overwriting it', () => {
    const store = memory();
    // Written by a newer version of the game, say, after a downgrade: neither copy can be read.
    const newer = JSON.stringify({ ...recordStars(emptyProgress(), 'a', 3), version: 2 });
    store.data.set('fuse-and-fall/progress', newer);
    store.data.set('fuse-and-fall/progress.bak', newer);
    const repo = new LocalSaveRepository(store);
    expect(repo.load()).toEqual(emptyProgress());
    repo.save(recordStars(emptyProgress(), 'b', 1));
    expect(store.data.get('fuse-and-fall/progress.unreadable')).toBe(newer);
    // The first unreadable save is the one kept; later saves do not replace it.
    store.data.set('fuse-and-fall/progress', '{broken');
    repo.save(emptyProgress());
    expect(store.data.get('fuse-and-fall/progress.unreadable')).toBe(newer);
    expect(repo.load()).toEqual(emptyProgress());
  });

  it('survives storage that throws', () => {
    const repo = new LocalSaveRepository({
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    });
    expect(() => repo.save(emptyProgress())).not.toThrow();
    expect(repo.load()).toEqual(emptyProgress());
  });
});

describe('shatter', () => {
  const block = {
    position: { x: 100, y: 100 },
    angle: 0,
    w: 60,
    h: 30,
    velocity: { x: 10, y: 0 },
    angularVelocity: 0,
  };
  const worldArea = (shards: ReturnType<typeof shatter>) => shards.reduce((a, s) => a + polygonArea(s.vertices), 0);

  it('breaks into the material fragment count of irregular pieces and conserves area', () => {
    const shards = shatter({ ...block, material: 'concrete' }, undefined, createRng(1));
    expect(shards).toHaveLength(MATERIALS.concrete.fragments.count);
    expect(worldArea(shards)).toBeCloseTo(60 * 30);
    // Not a neat grid: some cut edge runs at an angle.
    const slanted = shards.some((s) =>
      s.vertices.some((v, i) => {
        const w = s.vertices[(i + 1) % s.vertices.length];
        return w !== undefined && Math.abs(w.x - v.x) > 0.5 && Math.abs(w.y - v.y) > 0.5;
      }),
    );
    expect(slanted).toBe(true);
  });

  it('never makes pieces below the minimum size', () => {
    const shards = shatter({ ...block, w: 12, h: 12, material: 'glass' }, undefined, createRng(1));
    expect(shards).toHaveLength(1);
    const many = shatter({ ...block, w: 120, h: 40, material: 'glass' }, undefined, createRng(4));
    for (const s of many) expect(polygonArea(s.vertices)).toBeGreaterThanOrEqual(TUNING.shard.minSize ** 2 * 2);
  });

  it('places each piece at its centroid, so the pieces cover the parent exactly', () => {
    const shards = shatter({ ...block, material: 'wood' }, undefined, createRng(9));
    for (const s of shards) expect(Math.abs(polygonCentroid(s.vertices).x)).toBeLessThan(1e-6);
  });

  it('is deterministic for the same seed', () => {
    const a = shatter({ ...block, material: 'wood' }, { x: 0, y: 100 }, createRng(7));
    const b = shatter({ ...block, material: 'wood' }, { x: 0, y: 100 }, createRng(7));
    expect(a).toEqual(b);
  });

  it('throws debris away from the blast', () => {
    const shards = shatter({ ...block, velocity: { x: 0, y: 0 }, material: 'wood' }, { x: 0, y: 100 }, createRng(3));
    const meanVx = shards.reduce((a, s) => a + s.velocity.x, 0) / shards.length;
    expect(meanVx).toBeGreaterThan(0);
  });
});

describe('shapes', () => {
  it('splits a convex polygon into two that add up', () => {
    const [a, b] = splitConvex(rectVertices(40, 20), { x: 0, y: 0 }, { x: 1, y: 1 });
    expect(polygonArea(a) + polygonArea(b)).toBeCloseTo(800);
  });

  it('detects blast contact with polygons, inside and near an edge', () => {
    const tri = { kind: 'poly', vertices: [{ x: -10, y: -10 }, { x: 10, y: -10 }, { x: 0, y: 10 }] } as const;
    expect(circleTouches({ x: 0, y: 0 }, 1, tri, { x: 0, y: 0 }, 0)).toBe(true);
    expect(circleTouches({ x: 0, y: -14 }, 5, tri, { x: 0, y: 0 }, 0)).toBe(true);
    expect(circleTouches({ x: 0, y: -30 }, 5, tri, { x: 0, y: 0 }, 0)).toBe(false);
  });
});

describe('event bus', () => {
  it('delivers to subscribers until they unsubscribe', () => {
    const bus = new EventBus<{ ping: number }>();
    const seen: number[] = [];
    const off = bus.on('ping', (n) => seen.push(n));
    bus.emit('ping', 1);
    off();
    bus.emit('ping', 2);
    expect(seen).toEqual([1]);
  });
});

describe('difficulty', () => {
  const campaign = loadCampaign();
  const tierOf = (id: string) => {
    const l = campaign.levels.find((x) => x.id === id);
    if (!l) throw new Error(id);
    return difficultyOf(l);
  };
  it('starts every city gently and climbs towards its finale', () => {
    expect(tierOf('w1-01')).toBe('easy');
    expect(tierOf('w1-10')).toBe('hard');
    expect(tierOf('w5-01')).toBe('medium');
    expect(tierOf('w7-10')).toBe('expert');
  });
});
