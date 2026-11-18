import {
  KEY_MAX,
  KEY_REGEN_SECONDS,
  MAX_SHIELDS,
  STREAK_REWARDS,
} from "./config";
import { startBattle } from "./combat";
import type { GameState, Quest } from "./state";
import { dayKey, daysBetween } from "./time";

export function updateKeys(state: GameState, now: number): void {
  const keys = state.keys;
  if (keys.count >= KEY_MAX) {
    keys.nextAt = 0;
    return;
  }
  if (keys.nextAt === 0) keys.nextAt = now + KEY_REGEN_SECONDS * 1000;
  while (keys.count < KEY_MAX && now >= keys.nextAt) {
    keys.count += 1;
    keys.nextAt += KEY_REGEN_SECONDS * 1000;
  }
  if (keys.count >= KEY_MAX) keys.nextAt = 0;
}

export function startTrial(state: GameState, now: number): boolean {
  updateKeys(state, now);
  if (state.keys.count < 1 || state.battle?.kind === "trial") return false;
  state.keys.count -= 1;
  if (state.keys.nextAt === 0) state.keys.nextAt = now + KEY_REGEN_SECONDS * 1000;
  startBattle(state, "trial");
  return true;
}

export function canClaimStreak(state: GameState, now: number): boolean {
  return state.streak.lastClaimDay !== dayKey(now);
}

export interface StreakReward {
  day: number;
  chests: number;
  gold: number;
  shards: number;
  shieldUsed: boolean;
}

export function claimStreak(state: GameState, now: number): StreakReward | null {
  if (!canClaimStreak(state, now)) return null;
  const today = dayKey(now);
  const streak = state.streak;
  let shieldUsed = false;
  if (streak.lastClaimDay === null) {
    streak.count = 1;
  } else {
    const gap = daysBetween(streak.lastClaimDay, today);
    if (gap === 1) streak.count += 1;
    else if (gap === 2 && streak.shields > 0) {
      streak.shields -= 1;
      streak.count += 1;
      shieldUsed = true;
    } else streak.count = 1;
  }
  streak.lastClaimDay = today;

  const position = (streak.count - 1) % STREAK_REWARDS.length;
  const reward = STREAK_REWARDS[position] ?? { chests: 0, farmMinutes: 20 };
  const gold = Math.max(state.farm.goldPerSecond * reward.farmMinutes * 60, 10 * reward.farmMinutes);
  state.gold += gold;
  state.runGold += gold;
  state.lifetimeGold += gold;
  state.chests += reward.chests;
  let shards = 0;
  if (position === STREAK_REWARDS.length - 1) {
    shards = 1;
    state.shards += shards;
    streak.shields = Math.min(MAX_SHIELDS, streak.shields + 1);
  }
  return { day: streak.count, chests: reward.chests, gold, shards, shieldUsed };
}

export function ensureQuests(state: GameState, now: number): void {
  const today = dayKey(now);
  if (state.quests.day === today) return;
  const depth = Math.max(1, state.bestDepth);
  const items: Quest[] = [
    { id: `${today}-kills`, kind: "kills", target: 60 + depth * 2, progress: 0, claimed: false },
    { id: `${today}-bosses`, kind: "bosses", target: 2, progress: 0, claimed: false },
    { id: `${today}-chests`, kind: "chests", target: 2, progress: 0, claimed: false },
  ];
  state.quests = { day: today, items };
}

export function recordQuest(state: GameState, kind: Quest["kind"], amount = 1): void {
  for (const quest of state.quests.items) {
    if (quest.kind === kind && !quest.claimed) {
      quest.progress = Math.min(quest.target, quest.progress + amount);
    }
  }
}

export const QUEST_LABEL: Record<Quest["kind"], string> = {
  kills: "Slay monsters",
  bosses: "Defeat bosses",
  chests: "Open chests",
};

export function claimQuest(state: GameState, id: string): { gold: number; chests: number } | null {
  const quest = state.quests.items.find((item) => item.id === id);
  if (!quest || quest.claimed || quest.progress < quest.target) return null;
  quest.claimed = true;
  const gold = Math.max(state.farm.goldPerSecond * 15 * 60, 150);
  state.gold += gold;
  state.runGold += gold;
  state.lifetimeGold += gold;
  const chests = quest.kind === "bosses" ? 1 : 0;
  state.chests += chests;
  return { gold, chests };
}
