import {
  CLASSES,
  ACHIEVEMENT_BONUS,
  ENHANCE_BONUS,
  ITEM_POWER_DIVISOR,
  LEVEL_MILESTONES,
  LEVEL_STAT_GROWTH,
  META,
  MILESTONE_BONUS,
  RALLY_BONUS,
  RARITIES,
  RESOLVE_MAX,
  RESOLVE_PER_WIPE,
  type ClassDef,
} from "./config";
import type { GameState, Item } from "./state";

export interface HeroStats {
  hp: number;
  atk: number;
  def: number;
  speed: number;
  crit: number;
}

export function classOf(id: string): ClassDef {
  const found = CLASSES.find((item) => item.id === id);
  if (!found) throw new Error(`unknown class ${id}`);
  return found;
}

export function levelScale(level: number): number {
  const milestones = LEVEL_MILESTONES.filter((threshold) => level >= threshold).length;
  return LEVEL_STAT_GROWTH ** (level - 1) * MILESTONE_BONUS ** milestones;
}

export function itemPower(item: Item): number {
  const rarity = RARITIES.find((entry) => entry.id === item.rarity)?.multiplier ?? 1;
  return item.ilvl * rarity * item.roll * (1 + ENHANCE_BONUS * item.enhance);
}

function itemMultiplier(item: Item | undefined): number {
  return item ? 1 + itemPower(item) / ITEM_POWER_DIVISOR : 1;
}

export function metaLevel(state: GameState, id: string): number {
  return state.meta[id] ?? 0;
}

export function metaBonus(state: GameState, id: string): number {
  const def = META.find((entry) => entry.id === id);
  return def ? def.perLevel * metaLevel(state, id) : 0;
}

export function resolveBonus(state: GameState): number {
  return Math.min(RESOLVE_MAX, state.wipeStreak * RESOLVE_PER_WIPE);
}

export function achievementBonus(state: GameState): number {
  return ACHIEVEMENT_BONUS * state.achievements.length;
}

export function heroStats(state: GameState, index: number): HeroStats {
  const hero = state.heroes[index];
  if (!hero) throw new Error(`no hero at ${index}`);
  const def = classOf(hero.classId);
  const scale = levelScale(hero.level);
  const resolve = (1 + resolveBonus(state)) * (1 + achievementBonus(state));
  const charm = itemMultiplier(hero.gear.charm) - 1;
  return {
    hp: def.hp * scale * itemMultiplier(hero.gear.armor) * (1 + metaBonus(state, "vitality")) * resolve,
    atk: def.atk * scale * itemMultiplier(hero.gear.weapon) * (1 + metaBonus(state, "might")) * resolve,
    def: def.def * scale * itemMultiplier(hero.gear.armor),
    speed: def.speed * (1 + charm * 0.3),
    crit: Math.min(0.8, def.crit + charm * 0.05),
  };
}

export function rallyActive(state: GameState, now: number): boolean {
  return now < state.rally.until;
}

export function rallyMultiplier(state: GameState, now: number): number {
  return rallyActive(state, now) ? 1 + RALLY_BONUS : 1;
}

export function goldMultiplier(state: GameState): number {
  return 1 + metaBonus(state, "greed") + achievementBonus(state);
}
