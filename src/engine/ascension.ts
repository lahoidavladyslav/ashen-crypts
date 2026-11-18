import { ASCENSION_MIN_DEPTH, ASCENSION_START_GOLD } from "./config";
import { startBattle } from "./combat";
import type { GameState, HeroState } from "./state";

export function ascensionGain(state: GameState): number {
  if (state.maxDepth < ASCENSION_MIN_DEPTH) return 0;
  return Math.floor((state.maxDepth - ASCENSION_MIN_DEPTH + 1) ** 1.5 / 2) + 1;
}

export function ascend(state: GameState): number {
  const gain = ascensionGain(state);
  if (gain < 1) return 0;
  state.shards += gain;
  state.ascensions += 1;
  state.gold = ASCENSION_START_GOLD;
  state.runGold = 0;
  state.depth = 1;
  state.maxDepth = 1;
  state.wipeStreak = 0;
  state.heroes = state.heroes.map<HeroState>((hero) => ({ ...hero, level: 1 }));
  state.farm = { goldPerSecond: 0, windowGold: 0, windowSeconds: 0 };
  startBattle(state, "stage", 1);
  return gain;
}
