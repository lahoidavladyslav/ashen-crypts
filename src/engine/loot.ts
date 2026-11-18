import { CHEST_PITY, DROP_CHANCE, RARITIES, SLOTS, type Rarity } from "./config";
import { between, nextFloat } from "./rng";
import { classOf, itemPower, metaBonus } from "./stats";
import type { GameState, Item } from "./state";

const ORDER: readonly Rarity[] = RARITIES.map((entry) => entry.id);

export function rarityRank(rarity: Rarity): number {
  return ORDER.indexOf(rarity);
}

function pickRarity(state: GameState, minimum: Rarity): Rarity {
  const eligible = RARITIES.filter((entry) => rarityRank(entry.id) >= rarityRank(minimum));
  const total = eligible.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = nextFloat(state) * total;
  for (const entry of eligible) {
    roll -= entry.weight;
    if (roll <= 0) return entry.id;
  }
  return eligible[eligible.length - 1]?.id ?? "common";
}

export function rollItem(state: GameState, depth: number, minimum: Rarity = "common"): Item {
  const slot = SLOTS[Math.floor(nextFloat(state) * SLOTS.length)]?.id ?? "weapon";
  return {
    id: state.nextItemId++,
    slot,
    rarity: pickRarity(state, minimum),
    ilvl: depth + Math.floor(nextFloat(state) * 3),
    roll: between(state, 0.9, 1.1),
    enhance: 0,
  };
}

export function dropChance(state: GameState): number {
  return DROP_CHANCE * (1 + metaBonus(state, "scavenger"));
}

export function salvageValue(item: Item): number {
  return Math.floor(itemPower(item) / 4) + 1;
}

const LOG_LIMIT = 8;

function writeLog(state: GameState, item: Item, heroIndex: number | null): void {
  const hero = heroIndex === null ? undefined : state.heroes[heroIndex];
  const where = hero ? `equipped by ${classOf(hero.classId).name}` : "salvaged";
  state.log.unshift(`${item.rarity}|${item.rarity} ${item.slot}, level ${item.ilvl}: ${where}`);
  state.log.length = Math.min(state.log.length, LOG_LIMIT);
}

export interface EquipResult {
  item: Item;
  heroIndex: number | null;
  equipped: boolean;
  essence: number;
}

/** Gives the item to the hero whose item in that slot is weakest; worse items are salvaged. */
export function equipOrSalvage(state: GameState, item: Item): EquipResult {
  let target = -1;
  let weakest = Infinity;
  state.heroes.forEach((hero, index) => {
    const current = hero.gear[item.slot];
    const power = current ? itemPower(current) : 0;
    if (power < weakest) {
      weakest = power;
      target = index;
    }
  });
  const hero = state.heroes[target];
  if (hero && itemPower(item) > weakest) {
    const old = hero.gear[item.slot];
    hero.gear[item.slot] = item;
    const essence = old ? salvageValue(old) : 0;
    state.essence += essence;
    writeLog(state, item, target);
    return { item, heroIndex: target, equipped: true, essence };
  }
  const essence = salvageValue(item);
  state.essence += essence;
  writeLog(state, item, null);
  return { item, heroIndex: null, equipped: false, essence };
}

export function openChest(state: GameState, depth: number): EquipResult | null {
  if (state.chests < 1) return null;
  state.chests -= 1;
  state.chestPity += 1;
  const guaranteed = state.chestPity >= CHEST_PITY;
  const item = rollItem(state, depth, guaranteed ? "epic" : "uncommon");
  if (rarityRank(item.rarity) >= rarityRank("epic")) state.chestPity = 0;
  return equipOrSalvage(state, item);
}
