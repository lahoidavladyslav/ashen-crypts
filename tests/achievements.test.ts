import { describe, expect, it } from "vitest";
import { ACHIEVEMENTS, checkAchievements } from "../src/engine/achievements";
import { ENHANCE_MAX } from "../src/engine/config";
import { advance } from "../src/engine/game";
import { newState, type GameState } from "../src/engine/state";
import { goldMultiplier, heroStats } from "../src/engine/stats";

const T0 = new Date(2026, 0, 10, 12, 0, 0).getTime();

function fresh(): GameState {
  return newState(T0, 3);
}

describe("achievements", () => {
  it("have unique ids", () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it("start with nothing unlocked", () => {
    expect(checkAchievements(fresh())).toEqual([]);
  });

  it("unlock once and are announced once", () => {
    const state = fresh();
    state.stats.kills = 1;
    expect(checkAchievements(state)).toEqual(["first-blood"]);
    expect(checkAchievements(state)).toEqual([]);
    expect(state.newAchievements).toEqual(["first-blood"]);
  });

  it("unlock from depth, bosses, party size and prestige", () => {
    const state = fresh();
    state.bestDepth = 25;
    state.stats.bosses = 1;
    state.ascensions = 1;
    state.heroes.push(
      { classId: "rogue", level: 1, gear: {} },
      { classId: "warlock", level: 1, gear: {} },
    );
    const ids = checkAchievements(state);
    expect(ids).toEqual(expect.arrayContaining(["depth-10", "depth-25", "boss-1", "ascend-1", "party"]));
  });

  it("notice legendary and fully enhanced gear", () => {
    const state = fresh();
    state.heroes[0]!.gear.weapon = { id: 1, slot: "weapon", rarity: "legendary", ilvl: 5, roll: 1, enhance: ENHANCE_MAX };
    const ids = checkAchievements(state);
    expect(ids).toEqual(expect.arrayContaining(["legendary", "enhanced"]));
  });

  it("each one adds a small permanent bonus to power and gold", () => {
    const state = fresh();
    const atk = heroStats(state, 0).atk;
    const gold = goldMultiplier(state);
    state.achievements = ["a", "b", "c", "d", "e"];
    expect(heroStats(state, 0).atk).toBeCloseTo(atk * 1.05, 9);
    expect(goldMultiplier(state)).toBeCloseTo(gold + 0.05, 9);
  });

  it("are checked while playing", () => {
    const state = fresh();
    for (const hero of state.heroes) hero.level = 20;
    let now = T0;
    for (let i = 0; i < 40; i++) {
      now += 1000;
      advance(state, now);
    }
    expect(state.achievements).toContain("first-blood");
  });
});
