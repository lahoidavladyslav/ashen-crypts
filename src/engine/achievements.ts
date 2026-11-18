import { rarityRank } from "./loot";
import { ENHANCE_MAX } from "./config";
import type { GameState } from "./state";

export interface AchievementDef {
  id: string;
  name: string;
  description: string;
  unlocked: (state: GameState) => boolean;
}

function hasGear(state: GameState, test: (rank: number, enhance: number) => boolean): boolean {
  return state.heroes.some((hero) =>
    Object.values(hero.gear).some((item) => item && test(rarityRank(item.rarity), item.enhance)),
  );
}

export const ACHIEVEMENTS: readonly AchievementDef[] = [
  { id: "first-blood", name: "First Blood", description: "Slay a monster", unlocked: (s) => s.stats.kills >= 1 },
  { id: "hunter", name: "Hunter", description: "Slay 1,000 monsters", unlocked: (s) => s.stats.kills >= 1000 },
  { id: "slayer", name: "Slayer", description: "Slay 10,000 monsters", unlocked: (s) => s.stats.kills >= 10000 },
  { id: "depth-10", name: "Into the Dark", description: "Reach depth 10", unlocked: (s) => s.bestDepth >= 10 },
  { id: "depth-25", name: "Deep Delver", description: "Reach depth 25", unlocked: (s) => s.bestDepth >= 25 },
  { id: "depth-50", name: "Abyss Walker", description: "Reach depth 50", unlocked: (s) => s.bestDepth >= 50 },
  { id: "depth-75", name: "Heart of the Crypt", description: "Reach depth 75", unlocked: (s) => s.bestDepth >= 75 },
  { id: "boss-1", name: "Kingslayer", description: "Defeat a boss", unlocked: (s) => s.stats.bosses >= 1 },
  { id: "boss-100", name: "Bane of Kings", description: "Defeat 100 bosses", unlocked: (s) => s.stats.bosses >= 100 },
  { id: "party", name: "Full Party", description: "Recruit five heroes", unlocked: (s) => s.heroes.length >= 5 },
  { id: "legendary", name: "Legend", description: "Equip a legendary item", unlocked: (s) => hasGear(s, (rank) => rank >= 4) },
  { id: "enhanced", name: "Master Smith", description: "Enhance an item to the maximum", unlocked: (s) => hasGear(s, (_, enhance) => enhance >= ENHANCE_MAX) },
  { id: "ascend-1", name: "Reborn", description: "Ascend once", unlocked: (s) => s.ascensions >= 1 },
  { id: "ascend-5", name: "Eternal", description: "Ascend five times", unlocked: (s) => s.ascensions >= 5 },
  { id: "trial-1", name: "Trial by Fire", description: "Win a crypt trial", unlocked: (s) => s.stats.trialsWon >= 1 },
  { id: "trial-10", name: "Trial Master", description: "Win 10 crypt trials", unlocked: (s) => s.stats.trialsWon >= 10 },
  { id: "streak-7", name: "Devoted", description: "Reach a 7 day streak", unlocked: (s) => s.streak.count >= 7 },
  { id: "rich", name: "Dragon's Hoard", description: "Earn a billion gold", unlocked: (s) => s.lifetimeGold >= 1e9 },
  { id: "stubborn", name: "Stubborn", description: "Lose 10 battles and keep going", unlocked: (s) => s.stats.wipes >= 10 },
];

export function checkAchievements(state: GameState): string[] {
  const unlocked: string[] = [];
  for (const achievement of ACHIEVEMENTS) {
    if (!state.achievements.includes(achievement.id) && achievement.unlocked(state)) {
      state.achievements.push(achievement.id);
      state.newAchievements.push(achievement.id);
      unlocked.push(achievement.id);
    }
  }
  return unlocked;
}
