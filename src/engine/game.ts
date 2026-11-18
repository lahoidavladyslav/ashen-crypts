import {
  BASE_OFFLINE_HOURS,
  FARM_WINDOW_SECONDS,
  MAX_ADVANCE_SECONDS,
  OFFLINE_CHEST_HOURS,
  OFFLINE_CHEST_MAX,
  OFFLINE_EFFICIENCY,
  OFFLINE_THRESHOLD_SECONDS,
} from "./config";
import { startBattle, stepBattle, type BattleHooks } from "./combat";
import { ensureQuests, recordQuest, updateKeys } from "./daily";
import { openChest, type EquipResult } from "./loot";
import { metaBonus } from "./stats";
import type { GameState } from "./state";

export interface OfflineReport {
  seconds: number;
  gold: number;
  chests: number;
  capped: boolean;
}

export function addGold(state: GameState, amount: number): void {
  state.gold += amount;
  state.runGold += amount;
  state.lifetimeGold += amount;
}

const hooks: BattleHooks = {
  onKill: (state, boss) => {
    state.stats.kills += 1;
    recordQuest(state, "kills");
    if (boss) {
      state.stats.bosses += 1;
      recordQuest(state, "bosses");
    }
  },
  onGold: (state, amount) => {
    addGold(state, amount);
    state.farm.windowGold += amount;
  },
  onChest: (state) => {
    state.chests += 1;
  },
};

export function offlineCapHours(state: GameState): number {
  return BASE_OFFLINE_HOURS + metaBonus(state, "lore");
}

function trackFarm(state: GameState, seconds: number): void {
  const farm = state.farm;
  farm.windowSeconds += seconds;
  if (farm.windowSeconds < FARM_WINDOW_SECONDS) return;
  const rate = farm.windowGold / farm.windowSeconds;
  farm.goldPerSecond = farm.goldPerSecond === 0 ? rate : (farm.goldPerSecond + rate) / 2;
  farm.windowGold = 0;
  farm.windowSeconds = 0;
}

export function applyOffline(state: GameState, now: number): OfflineReport {
  const elapsed = (now - state.lastTick) / 1000;
  const capSeconds = offlineCapHours(state) * 3600;
  const counted = Math.min(elapsed, capSeconds);
  const gold = state.farm.goldPerSecond * counted * OFFLINE_EFFICIENCY;
  addGold(state, gold);
  const chests = Math.min(OFFLINE_CHEST_MAX, Math.floor(counted / (OFFLINE_CHEST_HOURS * 3600)));
  state.chests += chests;
  state.lastTick = now;
  startBattle(state, "stage", 1);
  updateKeys(state, now);
  ensureQuests(state, now);
  return { seconds: elapsed, gold, chests, capped: elapsed > capSeconds };
}

export function advance(state: GameState, now: number): OfflineReport | null {
  if (!state.battle) startBattle(state, "stage", 1);
  const elapsed = (now - state.lastTick) / 1000;
  if (elapsed <= 0) {
    state.lastTick = now;
    return null;
  }
  if (elapsed > OFFLINE_THRESHOLD_SECONDS) return applyOffline(state, now);

  const seconds = Math.min(elapsed, MAX_ADVANCE_SECONDS);
  const inStage = state.battle?.kind === "stage";
  const trial = stepBattle(state, seconds, now, hooks);
  if (inStage) trackFarm(state, seconds);
  if (trial?.won) {
    state.chests += 1;
    state.essence += 5 + state.maxDepth;
    state.stats.trialsWon += 1;
  }
  state.stats.playSeconds += seconds;
  state.lastTick = now;
  updateKeys(state, now);
  ensureQuests(state, now);
  return null;
}

export function claimChest(state: GameState): EquipResult | null {
  const result = openChest(state, state.maxDepth);
  if (result) recordQuest(state, "chests");
  return result;
}
