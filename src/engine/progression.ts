import {
  CLASSES,
  ENHANCE_MAX,
  LEVEL_COST_GROWTH,
  META,
  META_COST_GROWTH,
  SLOTS,
  type ClassId,
  type Slot,
} from "./config";
import { refreshHeroStats } from "./combat";
import { classOf, metaLevel } from "./stats";
import type { GameState } from "./state";

export const MAX_PARTY = 5;

export function levelCost(state: GameState, index: number, count = 1): number {
  const hero = state.heroes[index];
  if (!hero) return Infinity;
  const first = classOf(hero.classId).costBase * LEVEL_COST_GROWTH ** (hero.level - 1);
  return (first * (LEVEL_COST_GROWTH ** count - 1)) / (LEVEL_COST_GROWTH - 1);
}

export function maxLevels(state: GameState, index: number): number {
  const hero = state.heroes[index];
  if (!hero) return 0;
  const first = classOf(hero.classId).costBase * LEVEL_COST_GROWTH ** (hero.level - 1);
  if (state.gold < first) return 0;
  return Math.floor(
    Math.log((state.gold * (LEVEL_COST_GROWTH - 1)) / first + 1) / Math.log(LEVEL_COST_GROWTH),
  );
}

export function buyLevels(state: GameState, index: number, quantity: number | "max"): number {
  const count = quantity === "max" ? maxLevels(state, index) : quantity;
  const hero = state.heroes[index];
  if (!hero || count <= 0) return 0;
  const cost = levelCost(state, index, count);
  if (cost > state.gold) return 0;
  state.gold -= cost;
  hero.level += count;
  refreshHeroStats(state);
  return count;
}

export function averageLevel(state: GameState): number {
  return state.heroes.reduce((sum, hero) => sum + hero.level, 0) / Math.max(1, state.heroes.length);
}

export function hireCost(classId: ClassId): number {
  return classOf(classId).costBase * 40;
}

export function canHire(state: GameState, classId: ClassId): boolean {
  const def = classOf(classId);
  return (
    state.heroes.length < MAX_PARTY &&
    !state.heroes.some((hero) => hero.classId === classId) &&
    state.bestDepth >= def.unlockDepth &&
    state.gold >= hireCost(classId)
  );
}

export function hireHero(state: GameState, classId: ClassId): boolean {
  if (!canHire(state, classId)) return false;
  state.gold -= hireCost(classId);
  state.heroes.push({ classId, level: Math.max(1, Math.floor(averageLevel(state) * 0.7)), gear: {} });
  refreshHeroStats(state);
  return true;
}

export function hireable(state: GameState): ClassId[] {
  return CLASSES.filter(
    (def) => !state.heroes.some((hero) => hero.classId === def.id) && state.bestDepth >= def.unlockDepth,
  ).map((def) => def.id);
}

export function enhanceCost(level: number): number {
  return Math.ceil(3 * 1.45 ** level);
}

export function enhance(state: GameState, index: number, slot: Slot): boolean {
  const item = state.heroes[index]?.gear[slot];
  if (!item || item.enhance >= ENHANCE_MAX) return false;
  const cost = enhanceCost(item.enhance);
  if (state.essence < cost) return false;
  state.essence -= cost;
  item.enhance += 1;
  refreshHeroStats(state);
  return true;
}

export function metaCost(state: GameState, id: string): number {
  const def = META.find((entry) => entry.id === id);
  return def ? Math.ceil(def.baseCost * META_COST_GROWTH ** metaLevel(state, id)) : Infinity;
}

export function buyMeta(state: GameState, id: string): boolean {
  const cost = metaCost(state, id);
  if (!Number.isFinite(cost) || state.shards < cost) return false;
  state.shards -= cost;
  state.meta[id] = metaLevel(state, id) + 1;
  refreshHeroStats(state);
  return true;
}

export const SLOT_IDS: readonly Slot[] = SLOTS.map((slot) => slot.id);
