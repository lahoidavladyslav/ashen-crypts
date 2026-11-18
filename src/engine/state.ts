import { ASCENSION_START_GOLD, KEY_MAX, type ClassId, type Rarity, type Slot, type Trait } from "./config";

export interface Item {
  id: number;
  slot: Slot;
  rarity: Rarity;
  ilvl: number;
  roll: number;
  enhance: number;
}

export interface HeroState {
  classId: ClassId;
  level: number;
  gear: Partial<Record<Slot, Item>>;
}

export interface Fighter {
  id: number;
  name: string;
  kind: string;
  side: "hero" | "enemy";
  heroIndex: number;
  boss: boolean;
  maxHp: number;
  hp: number;
  atk: number;
  def: number;
  speed: number;
  crit: number;
  timer: number;
  skillCd: number;
  shieldUntil: number;
  trait: Trait | null;
  traitTimer: number;
  summoned: boolean;
}

export type BattleEvent =
  | { type: "hit"; from: number; to: number; amount: number; crit: boolean; skill?: string }
  | { type: "heal"; to: number; amount: number }
  | { type: "skill"; from: number; skill: string }
  | { type: "death"; id: number; boss: boolean }
  | { type: "summon"; id: number }
  | { type: "wave"; wave: number; boss: boolean }
  | { type: "wipe" }
  | { type: "clear"; depth: number; chest: boolean };

export interface Battle {
  events: BattleEvent[];
  kind: "stage" | "trial";
  depth: number;
  power: number;
  wave: number;
  clock: number;
  waveTime: number;
  delay: number;
  heroes: Fighter[];
  enemies: Fighter[];
}

export interface Quest {
  id: string;
  kind: "kills" | "bosses" | "chests";
  target: number;
  progress: number;
  claimed: boolean;
}

export interface GameState {
  version: number;
  rng: number;
  lastTick: number;
  gold: number;
  runGold: number;
  lifetimeGold: number;
  essence: number;
  shards: number;
  ascensions: number;
  depth: number;
  maxDepth: number;
  bestDepth: number;
  autoAdvance: boolean;
  heroes: HeroState[];
  meta: Record<string, number>;
  battle: Battle | null;
  wipeStreak: number;
  rally: { readyAt: number; until: number };
  chests: number;
  chestPity: number;
  nextItemId: number;
  nextFighterId: number;
  farm: { goldPerSecond: number; windowGold: number; windowSeconds: number };
  keys: { count: number; nextAt: number };
  streak: { count: number; lastClaimDay: string | null; shields: number };
  quests: { day: string; items: Quest[] };
  stats: { kills: number; bosses: number; playSeconds: number; wipes: number; trialsWon: number };
  log: string[];
  achievements: string[];
  newAchievements: string[];
}

export const SAVE_VERSION = 1;

export function newState(now: number, seed = now): GameState {
  return {
    version: SAVE_VERSION,
    rng: seed >>> 0,
    lastTick: now,
    gold: ASCENSION_START_GOLD,
    runGold: 0,
    lifetimeGold: 0,
    essence: 0,
    shards: 0,
    ascensions: 0,
    depth: 1,
    maxDepth: 1,
    bestDepth: 1,
    autoAdvance: true,
    heroes: [
      { classId: "knight", level: 1, gear: {} },
      { classId: "pyromancer", level: 1, gear: {} },
      { classId: "cleric", level: 1, gear: {} },
    ],
    meta: {},
    battle: null,
    wipeStreak: 0,
    rally: { readyAt: 0, until: 0 },
    chests: 0,
    chestPity: 0,
    nextItemId: 1,
    nextFighterId: 1,
    farm: { goldPerSecond: 0, windowGold: 0, windowSeconds: 0 },
    keys: { count: KEY_MAX, nextAt: 0 },
    streak: { count: 0, lastClaimDay: null, shields: 0 },
    quests: { day: "", items: [] },
    stats: { kills: 0, bosses: 0, playSeconds: 0, wipes: 0, trialsWon: 0 },
    log: [],
    achievements: [],
    newAchievements: [],
  };
}

export function serialize(state: GameState): string {
  return JSON.stringify({ ...state, battle: null });
}

export function deserialize(raw: string | null, now: number): GameState {
  if (!raw) return newState(now);
  try {
    const data = JSON.parse(raw) as Partial<GameState>;
    if (data.version !== SAVE_VERSION || !Array.isArray(data.heroes)) return newState(now);
    return { ...newState(now), ...data, battle: null } as GameState;
  } catch {
    return newState(now);
  }
}
