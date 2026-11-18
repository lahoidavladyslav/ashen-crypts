export type ClassId = "knight" | "pyromancer" | "cleric" | "rogue" | "warlock";
export type Slot = "weapon" | "armor" | "charm";
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type SkillId = "shieldWall" | "fireball" | "prayer" | "backstab" | "drain";

export interface ClassDef {
  id: ClassId;
  name: string;
  role: string;
  hp: number;
  atk: number;
  def: number;
  speed: number;
  crit: number;
  costBase: number;
  unlockDepth: number;
  skill: SkillId;
  skillName: string;
  skillText: string;
  skillCooldown: number;
}

export const CLASSES: readonly ClassDef[] = [
  { id: "knight", name: "Knight", role: "Tank", hp: 120, atk: 8, def: 8, speed: 0.9, crit: 0.05, costBase: 10, unlockDepth: 1, skill: "shieldWall", skillName: "Shield Wall", skillText: "Draws all attacks and halves damage for 5s", skillCooldown: 14 },
  { id: "pyromancer", name: "Pyromancer", role: "Damage", hp: 70, atk: 14, def: 2, speed: 0.8, crit: 0.1, costBase: 14, unlockDepth: 1, skill: "fireball", skillName: "Fireball", skillText: "Burns every enemy for 2.5x attack", skillCooldown: 12 },
  { id: "cleric", name: "Cleric", role: "Healer", hp: 90, atk: 7, def: 4, speed: 0.8, crit: 0.05, costBase: 18, unlockDepth: 1, skill: "prayer", skillName: "Prayer", skillText: "Heals the whole party for 2.5x attack", skillCooldown: 16 },
  { id: "rogue", name: "Rogue", role: "Burst", hp: 80, atk: 11, def: 3, speed: 1.4, crit: 0.25, costBase: 60, unlockDepth: 8, skill: "backstab", skillName: "Backstab", skillText: "A guaranteed critical hit for 4x on the toughest enemy", skillCooldown: 9 },
  { id: "warlock", name: "Warlock", role: "Sustain", hp: 85, atk: 12, def: 3, speed: 0.9, crit: 0.08, costBase: 200, unlockDepth: 20, skill: "drain", skillName: "Soul Drain", skillText: "Hits for 3x attack and heals the caster by that amount", skillCooldown: 11 },
];

export type Trait = "armored" | "regen" | "enrage" | "summoner" | "thick";

export const TRAITS: Record<Trait, { name: string; text: string }> = {
  armored: { name: "Armored", text: "Triple defense. Fire and drain hurt less." },
  regen: { name: "Regenerating", text: "Heals 2% of its health every second." },
  enrage: { name: "Enraging", text: "Hits harder every 5 seconds." },
  summoner: { name: "Summoner", text: "Calls a minion every 8 seconds." },
  thick: { name: "Colossal", text: "Fifty percent more health." },
};
const BOSS_TRAITS: readonly Trait[] = ["armored", "regen", "enrage", "summoner", "thick"];

export const ENRAGE_STEP_SECONDS = 5;
export const ENRAGE_STEP_BONUS = 0.1;
export const ENRAGE_MAX_STEPS = 20;
export const REGEN_PER_SECOND = 0.02;
export const SUMMON_SECONDS = 8;
export const SUMMON_CAP = 4;
export const SOFT_ENRAGE_AFTER_SECONDS = 60;

export const WAVES_PER_DEPTH = 10;
export const LEVEL_COST_GROWTH = 1.14;
export const LEVEL_STAT_GROWTH = 1.075;
export const LEVEL_MILESTONES: readonly number[] = [10, 25, 50, 100, 200];
export const MILESTONE_BONUS = 1.5;

export const ENEMY_HP_GROWTH = 1.22;
export const ENEMY_ATK_GROWTH = 1.17;
export const ENEMY_GOLD_GROWTH = 1.14;

export const TICK_SECONDS = 0.1;
export const MAX_ADVANCE_SECONDS = 5;
export const WAVE_DELAY_SECONDS = 0.6;
export const CRIT_MULTIPLIER = 1.6;

export const RALLY_COOLDOWN_SECONDS = 60;
export const RALLY_SECONDS = 10;
export const RALLY_BONUS = 0.5;

export const RESOLVE_PER_WIPE = 0.12;
export const RESOLVE_MAX = 1.0;

export const RARITIES: readonly { id: Rarity; name: string; multiplier: number; weight: number }[] = [
  { id: "common", name: "Common", multiplier: 1, weight: 60 },
  { id: "uncommon", name: "Uncommon", multiplier: 1.3, weight: 28 },
  { id: "rare", name: "Rare", multiplier: 1.7, weight: 9 },
  { id: "epic", name: "Epic", multiplier: 2.3, weight: 2.5 },
  { id: "legendary", name: "Legendary", multiplier: 3.2, weight: 0.5 },
];

export const SLOTS: readonly { id: Slot; name: string; effect: string }[] = [
  { id: "weapon", name: "Weapon", effect: "attack" },
  { id: "armor", name: "Armor", effect: "health and defense" },
  { id: "charm", name: "Charm", effect: "speed and critical chance" },
];

export const DROP_CHANCE = 0.05;
export const CHEST_PITY = 10;
export const ITEM_POWER_DIVISOR = 100;
export const ENHANCE_BONUS = 0.1;
export const ENHANCE_MAX = 15;

export const FARM_WINDOW_SECONDS = 60;
export const OFFLINE_EFFICIENCY = 0.6;
export const BASE_OFFLINE_HOURS = 8;
export const OFFLINE_THRESHOLD_SECONDS = 60;
export const OFFLINE_CHEST_HOURS = 2;
export const OFFLINE_CHEST_MAX = 4;

export const ASCENSION_MIN_DEPTH = 25;
export const ASCENSION_START_GOLD = 20;

export interface MetaDef {
  id: string;
  name: string;
  description: string;
  perLevel: number;
  baseCost: number;
}

export const META: readonly MetaDef[] = [
  { id: "greed", name: "Greed", description: "+25% gold per level", perLevel: 0.25, baseCost: 1 },
  { id: "might", name: "Might", description: "+25% attack per level", perLevel: 0.25, baseCost: 1 },
  { id: "vitality", name: "Vitality", description: "+25% health per level", perLevel: 0.25, baseCost: 1 },
  { id: "scavenger", name: "Scavenger", description: "+25% item drops per level", perLevel: 0.25, baseCost: 2 },
  { id: "lore", name: "Ancient Lore", description: "+2 offline hours per level", perLevel: 2, baseCost: 3 },
];
export const META_COST_GROWTH = 1.6;

export const ACHIEVEMENT_BONUS = 0.01;

export const KEY_MAX = 3;
export const KEY_REGEN_SECONDS = 6 * 3600;
export const TRIAL_POWER = 1.4;

export const STREAK_REWARDS: readonly { chests: number; farmMinutes: number }[] = [
  { chests: 0, farmMinutes: 20 },
  { chests: 0, farmMinutes: 30 },
  { chests: 1, farmMinutes: 30 },
  { chests: 0, farmMinutes: 60 },
  { chests: 1, farmMinutes: 60 },
  { chests: 1, farmMinutes: 90 },
  { chests: 2, farmMinutes: 120 },
];
export const MAX_SHIELDS = 2;

export function enemyHp(depth: number): number {
  return 30 * ENEMY_HP_GROWTH ** (depth - 1);
}
export function enemyAtk(depth: number): number {
  return 3 * ENEMY_ATK_GROWTH ** (depth - 1);
}
export function enemyGold(depth: number): number {
  return 3 * ENEMY_GOLD_GROWTH ** (depth - 1);
}
export function enemyDef(depth: number): number {
  return 2 + depth * 0.6;
}

const ENEMY_NAMES = ["Skeleton", "Ghoul", "Cultist", "Wraith", "Bone Knight", "Plague Rat", "Shade"];
const BOSS_NAMES = ["Gravewarden", "The Pale Matron", "Lord Cinder", "Hollow King", "Marrow Colossus"];

export function enemyName(depth: number, index: number): string {
  return ENEMY_NAMES[(depth + index) % ENEMY_NAMES.length] ?? "Skeleton";
}
export function bossTrait(depth: number): Trait {
  return BOSS_TRAITS[Math.floor((depth - 1) / WAVES_PER_DEPTH) % BOSS_TRAITS.length] ?? "armored";
}

export function bossName(depth: number): string {
  return BOSS_NAMES[Math.floor((depth - 1) / WAVES_PER_DEPTH) % BOSS_NAMES.length] ?? "Gravewarden";
}
