import { describe, expect, it } from "vitest";
import { ascend, ascensionGain } from "../src/engine/ascension";
import { castRally, spawnEnemies, startBattle, stepBattle } from "../src/engine/combat";
import { CHEST_PITY, ENEMY_HP_GROWTH, META, WAVES_PER_DEPTH } from "../src/engine/config";
import {
  canClaimStreak,
  claimQuest,
  claimStreak,
  ensureQuests,
  startTrial,
  updateKeys,
} from "../src/engine/daily";
import { formatDuration, formatNumber } from "../src/engine/format";
import { addGold, advance, applyOffline, claimChest } from "../src/engine/game";
import { equipOrSalvage, openChest, rarityRank, rollItem } from "../src/engine/loot";
import {
  buyLevels,
  buyMeta,
  canHire,
  enhance,
  enhanceCost,
  hireHero,
  levelCost,
  maxLevels,
} from "../src/engine/progression";
import { deserialize, newState, serialize, type GameState, type Item } from "../src/engine/state";
import { heroStats, itemPower, levelScale, resolveBonus } from "../src/engine/stats";

const T0 = new Date(2026, 0, 10, 12, 0, 0).getTime();
const SECOND = 1000;
const DAY = 86_400_000;

function fresh(): GameState {
  const state = newState(T0, 99);
  ensureQuests(state, T0);
  startBattle(state, "stage");
  return state;
}

function item(slot: Item["slot"], ilvl: number, rarity: Item["rarity"] = "common"): Item {
  return { id: ilvl, slot, rarity, ilvl, roll: 1, enhance: 0 };
}

function run(state: GameState, seconds: number): void {
  let now = state.lastTick;
  for (let i = 0; i < seconds; i++) {
    now += SECOND;
    advance(state, now);
  }
}

describe("stats", () => {
  it("levels scale stats and milestones add a bonus", () => {
    expect(levelScale(1)).toBe(1);
    expect(levelScale(9)).toBeCloseTo(1.075 ** 8, 9);
    expect(levelScale(10)).toBeCloseTo(1.075 ** 9 * 1.5, 9);
  });

  it("gear raises the matching stats", () => {
    const state = fresh();
    const base = heroStats(state, 0);
    state.heroes[0]!.gear.weapon = item("weapon", 50);
    state.heroes[0]!.gear.armor = item("armor", 50);
    const geared = heroStats(state, 0);
    expect(geared.atk).toBeGreaterThan(base.atk);
    expect(geared.hp).toBeGreaterThan(base.hp);
    expect(geared.def).toBeGreaterThan(base.def);
  });

  it("rarity and enhancement raise item power", () => {
    const plain = item("weapon", 20);
    expect(itemPower(item("weapon", 20, "epic"))).toBeGreaterThan(itemPower(plain));
    expect(itemPower({ ...plain, enhance: 5 })).toBeCloseTo(itemPower(plain) * 1.5, 9);
  });

  it("critical chance never exceeds the cap", () => {
    const state = fresh();
    state.heroes[0]!.gear.charm = item("charm", 5000, "legendary");
    expect(heroStats(state, 0).crit).toBeLessThanOrEqual(0.8);
  });
});

describe("leveling", () => {
  it("bulk cost equals one by one", () => {
    const state = fresh();
    let sum = 0;
    const hero = state.heroes[0]!;
    const start = hero.level;
    for (let i = 0; i < 5; i++) {
      sum += levelCost(state, 0);
      hero.level += 1;
    }
    hero.level = start;
    expect(levelCost(state, 0, 5)).toBeCloseTo(sum, 6);
  });

  it("max levels never overspends and is tight", () => {
    const state = fresh();
    state.gold = 5000;
    const count = maxLevels(state, 0);
    expect(levelCost(state, 0, count)).toBeLessThanOrEqual(5000);
    expect(levelCost(state, 0, count + 1)).toBeGreaterThan(5000);
  });

  it("buying spends gold and raises the level", () => {
    const state = fresh();
    state.gold = 1000;
    expect(buyLevels(state, 0, 3)).toBe(3);
    expect(state.heroes[0]!.level).toBe(4);
    expect(state.gold).toBeLessThan(1000);
  });

  it("refuses when too expensive", () => {
    const state = fresh();
    state.gold = 1;
    expect(buyLevels(state, 0, 1)).toBe(0);
    expect(state.heroes[0]!.level).toBe(1);
  });

  it("keeps the current hp ratio when stats grow in battle", () => {
    const state = fresh();
    state.battle!.heroes[0]!.hp = state.battle!.heroes[0]!.maxHp / 2;
    state.gold = 1e6;
    buyLevels(state, 0, 10);
    const fighter = state.battle!.heroes[0]!;
    expect(fighter.hp / fighter.maxHp).toBeCloseTo(0.5, 6);
  });
});

describe("hiring", () => {
  it("needs depth, gold and a free slot", () => {
    const state = fresh();
    state.gold = 1e9;
    expect(canHire(state, "rogue")).toBe(false);
    state.bestDepth = 8;
    expect(canHire(state, "rogue")).toBe(true);
    expect(hireHero(state, "rogue")).toBe(true);
    expect(hireHero(state, "rogue")).toBe(false);
    expect(state.heroes).toHaveLength(4);
  });

  it("new heroes start close to the party level", () => {
    const state = fresh();
    for (const hero of state.heroes) hero.level = 40;
    state.bestDepth = 8;
    state.gold = 1e12;
    hireHero(state, "rogue");
    expect(state.heroes[3]!.level).toBe(28);
  });
});

describe("combat", () => {
  it("a strong party wins waves, earns gold and advances", () => {
    const state = fresh();
    for (const hero of state.heroes) hero.level = 30;
    state.gold = 0;
    run(state, 120);
    expect(state.depth).toBeGreaterThan(1);
    expect(state.stats.kills).toBeGreaterThan(10);
    expect(state.gold).toBeGreaterThan(0);
    expect(state.chests).toBeGreaterThan(0);
  });

  it("a weak party wipes and gets stronger with resolve", () => {
    const state = fresh();
    state.depth = 40;
    state.maxDepth = 40;
    startBattle(state, "stage");
    run(state, 90);
    expect(state.stats.wipes).toBeGreaterThan(0);
    expect(state.wipeStreak).toBeGreaterThan(0);
    expect(resolveBonus(state)).toBeGreaterThan(0);
  });

  it("resolve is capped and raises stats", () => {
    const state = fresh();
    const base = heroStats(state, 0).atk;
    state.wipeStreak = 3;
    expect(heroStats(state, 0).atk).toBeCloseTo(base * (1 + 0.36), 9);
    state.wipeStreak = 100;
    expect(resolveBonus(state)).toBe(1);
  });

  it("clearing the boss resets resolve", () => {
    const state = fresh();
    for (const hero of state.heroes) hero.level = 40;
    state.wipeStreak = 4;
    run(state, 150);
    expect(state.wipeStreak).toBe(0);
  });

  it("boss waves have a boss and two adds", () => {
    const enemies = spawnEnemies(5, WAVES_PER_DEPTH);
    expect(enemies).toHaveLength(3);
    expect(enemies.filter((e) => e.boss)).toHaveLength(1);
    expect(enemies[0]!.maxHp).toBeGreaterThan(enemies[1]!.maxHp * 5);
  });

  it("enemies get tougher with depth", () => {
    const a = spawnEnemies(3, 1)[0]!;
    const b = spawnEnemies(4, 1)[0]!;
    expect(b.maxHp / a.maxHp).toBeCloseTo(ENEMY_HP_GROWTH, 6);
  });

  it("rally boosts damage for a while and then has a cooldown", () => {
    const state = fresh();
    expect(castRally(state, T0)).toBe(true);
    expect(castRally(state, T0 + 10 * SECOND)).toBe(false);
    expect(heroStats(state, 1).atk).toBeGreaterThan(0);
    expect(castRally(state, T0 + 61 * SECOND)).toBe(true);
  });

  it("is deterministic for the same seed", () => {
    const a = fresh();
    const b = fresh();
    for (const state of [a, b]) for (const hero of state.heroes) hero.level = 12;
    run(a, 60);
    run(b, 60);
    expect(a.stats.kills).toBe(b.stats.kills);
    expect(a.gold).toBeCloseTo(b.gold, 9);
  });

  it("does not stop when auto advance is off, it farms the same depth", () => {
    const state = fresh();
    state.autoAdvance = false;
    for (const hero of state.heroes) hero.level = 30;
    run(state, 120);
    expect(state.depth).toBe(1);
    expect(state.stats.bosses).toBeGreaterThan(0);
  });
});

describe("loot", () => {
  it("rolls items for the depth and rarity floor", () => {
    const state = fresh();
    for (let i = 0; i < 50; i++) {
      const rolled = rollItem(state, 30, "epic");
      expect(rarityRank(rolled.rarity)).toBeGreaterThanOrEqual(rarityRank("epic"));
      expect(rolled.ilvl).toBeGreaterThanOrEqual(30);
    }
  });

  it("equips an upgrade on the weakest hero and salvages the old item", () => {
    const state = fresh();
    state.heroes[0]!.gear.weapon = item("weapon", 10);
    state.heroes[1]!.gear.weapon = item("weapon", 20);
    state.heroes[2]!.gear.weapon = item("weapon", 15);
    const result = equipOrSalvage(state, item("weapon", 30));
    expect(result.equipped).toBe(true);
    expect(result.heroIndex).toBe(0);
    expect(state.heroes[0]!.gear.weapon!.ilvl).toBe(30);
    expect(state.essence).toBeGreaterThan(0);
  });

  it("salvages an item that is worse than everything equipped", () => {
    const state = fresh();
    for (const hero of state.heroes) hero.gear.armor = item("armor", 50);
    const result = equipOrSalvage(state, item("armor", 5));
    expect(result.equipped).toBe(false);
    expect(state.essence).toBeGreaterThan(0);
  });

  it("every tenth chest is at least epic", () => {
    const state = fresh();
    state.chests = 200;
    let lastEpic = 0;
    for (let i = 1; i <= 100; i++) {
      const before = state.chestPity;
      const result = openChest(state, 20)!;
      if (rarityRank(result.item.rarity) >= rarityRank("epic")) lastEpic = i;
      expect(i - lastEpic).toBeLessThan(CHEST_PITY + 1);
      expect(state.chestPity).toBeLessThanOrEqual(before + 1);
    }
  });

  it("does nothing without chests", () => {
    expect(claimChest(fresh())).toBeNull();
  });

  it("gear can be enhanced with essence", () => {
    const state = fresh();
    state.heroes[0]!.gear.weapon = item("weapon", 20);
    expect(enhance(state, 0, "weapon")).toBe(false);
    state.essence = enhanceCost(0);
    expect(enhance(state, 0, "weapon")).toBe(true);
    expect(state.heroes[0]!.gear.weapon!.enhance).toBe(1);
    expect(state.essence).toBe(0);
  });
});

describe("offline", () => {
  it("pays the farm rate at reduced efficiency, capped", () => {
    const state = fresh();
    state.farm.goldPerSecond = 100;
    const before = state.gold;
    const report = applyOffline(state, T0 + 20 * 3600 * SECOND);
    expect(report.capped).toBe(true);
    expect(state.gold - before).toBeCloseTo(100 * 8 * 3600 * 0.6, 3);
  });

  it("long absences leave chests, at most four", () => {
    const state = fresh();
    expect(applyOffline(state, T0 + 3 * 3600 * SECOND).chests).toBe(1);
    const other = fresh();
    expect(applyOffline(other, T0 + 40 * 3600 * SECOND).chests).toBe(4);
  });

  it("ancient lore raises the offline cap", () => {
    const state = fresh();
    state.shards = 100;
    buyMeta(state, "lore");
    state.farm.goldPerSecond = 10;
    const report = applyOffline(state, T0 + 10 * 3600 * SECOND);
    expect(report.capped).toBe(false);
  });

  it("is triggered by a long gap in advance", () => {
    const state = fresh();
    expect(advance(state, T0 + 2 * 3600 * SECOND)).not.toBeNull();
    expect(advance(state, T0 + 2 * 3600 * SECOND + 2 * SECOND)).toBeNull();
  });

  it("the farm rate follows the gold earned while playing", () => {
    const state = fresh();
    for (const hero of state.heroes) hero.level = 25;
    run(state, 130);
    expect(state.farm.goldPerSecond).toBeGreaterThan(0);
  });
});

describe("ascension", () => {
  it("is not possible too early", () => {
    const state = fresh();
    state.maxDepth = 24;
    expect(ascensionGain(state)).toBe(0);
    expect(ascend(state)).toBe(0);
  });

  it("pays more for deeper runs", () => {
    const state = fresh();
    state.maxDepth = 25;
    const shallow = ascensionGain(state);
    state.maxDepth = 50;
    expect(ascensionGain(state)).toBeGreaterThan(shallow * 10);
  });

  it("resets the run but keeps gear, heroes, shards and best depth", () => {
    const state = fresh();
    state.maxDepth = 40;
    state.bestDepth = 40;
    state.depth = 40;
    state.gold = 1e9;
    state.heroes[0]!.level = 60;
    state.heroes[0]!.gear.weapon = item("weapon", 40);
    const gain = ascend(state);
    expect(gain).toBeGreaterThan(0);
    expect(state.shards).toBe(gain);
    expect(state.depth).toBe(1);
    expect(state.heroes[0]!.level).toBe(1);
    expect(state.heroes[0]!.gear.weapon).toBeDefined();
    expect(state.bestDepth).toBe(40);
    expect(state.gold).toBeLessThan(100);
    expect(state.ascensions).toBe(1);
  });

  it("shards buy permanent upgrades that get dearer", () => {
    const state = fresh();
    state.shards = 10;
    expect(buyMeta(state, "might")).toBe(true);
    const base = heroStats(newState(T0), 0).atk;
    expect(heroStats(state, 0).atk).toBeCloseTo(base * 1.25, 9);
    const second = state.shards;
    expect(buyMeta(state, "might")).toBe(true);
    expect(second - state.shards).toBeGreaterThan(1);
    expect(META.find((m) => m.id === "might")).toBeDefined();
  });

  it("refuses without enough shards", () => {
    const state = fresh();
    expect(buyMeta(state, "greed")).toBe(false);
    expect(buyMeta(state, "nonexistent")).toBe(false);
  });
});

describe("daily systems", () => {
  it("streak: claim once a day, extend, reset, and shield", () => {
    const state = fresh();
    expect(claimStreak(state, T0)!.day).toBe(1);
    expect(canClaimStreak(state, T0 + 3600 * SECOND)).toBe(false);
    expect(claimStreak(state, T0 + DAY)!.day).toBe(2);
    expect(claimStreak(state, T0 + 4 * DAY)!.day).toBe(1);

    const shielded = fresh();
    shielded.streak = { count: 3, lastClaimDay: "2026-01-08", shields: 1 };
    expect(claimStreak(shielded, T0)!.shieldUsed).toBe(true);
    expect(shielded.streak.count).toBe(4);
  });

  it("day seven pays a shard and earns a shield", () => {
    const state = fresh();
    state.streak = { count: 6, lastClaimDay: "2026-01-09", shields: 0 };
    const reward = claimStreak(state, T0)!;
    expect(reward.shards).toBe(1);
    expect(state.streak.shields).toBe(1);
  });

  it("quests are generated per day and paid once", () => {
    const state = fresh();
    const quest = state.quests.items[0]!;
    expect(claimQuest(state, quest.id)).toBeNull();
    quest.progress = quest.target;
    expect(claimQuest(state, quest.id)).not.toBeNull();
    expect(claimQuest(state, quest.id)).toBeNull();
    ensureQuests(state, T0 + DAY);
    expect(state.quests.items[0]!.progress).toBe(0);
  });

  it("playing fills quest progress", () => {
    const state = fresh();
    for (const hero of state.heroes) hero.level = 30;
    run(state, 90);
    const kills = state.quests.items.find((q) => q.kind === "kills")!;
    expect(kills.progress).toBeGreaterThan(0);
  });

  it("trial keys: spend, regenerate over time, cap at three", () => {
    const state = fresh();
    expect(state.keys.count).toBe(3);
    expect(startTrial(state, T0)).toBe(true);
    expect(state.keys.count).toBe(2);
    expect(state.battle!.kind).toBe("trial");
    expect(state.keys.nextAt).toBeGreaterThan(T0);
    updateKeys(state, T0 + 7 * 3600 * SECOND);
    expect(state.keys.count).toBe(3);
    updateKeys(state, T0 + 100 * 3600 * SECOND);
    expect(state.keys.count).toBe(3);
  });

  it("a trial needs a key and cannot be started twice", () => {
    const state = fresh();
    state.keys.count = 0;
    state.keys.nextAt = T0 + 3600 * SECOND;
    expect(startTrial(state, T0)).toBe(false);
    state.keys.count = 2;
    expect(startTrial(state, T0)).toBe(true);
    expect(startTrial(state, T0)).toBe(false);
  });

  it("winning a trial pays a chest and essence, losing pays nothing", () => {
    const won = fresh();
    for (const hero of won.heroes) hero.level = 80;
    startTrial(won, T0);
    run(won, 120);
    expect(won.stats.trialsWon).toBe(1);
    expect(won.chests).toBeGreaterThan(0);
    expect(won.battle!.kind).toBe("stage");

    const lost = fresh();
    lost.maxDepth = 60;
    startTrial(lost, T0);
    run(lost, 120);
    expect(lost.stats.trialsWon).toBe(0);
    expect(lost.battle!.kind).toBe("stage");
  });

  it("stepBattle returns the trial outcome", () => {
    const state = fresh();
    for (const hero of state.heroes) hero.level = 80;
    startTrial(state, T0);
    let outcome = null;
    for (let i = 0; i < 100 && !outcome; i++) {
      outcome = stepBattle(state, 1, T0, {
        onKill: () => undefined,
        onGold: () => undefined,
        onChest: () => undefined,
      });
    }
    expect(outcome?.won).toBe(true);
  });
});

describe("save and load", () => {
  it("round-trips without the battle", () => {
    const state = fresh();
    state.heroes[0]!.gear.weapon = item("weapon", 12);
    state.meta.greed = 2;
    const copy = deserialize(serialize(state), T0);
    expect(copy.battle).toBeNull();
    expect({ ...copy, battle: null }).toEqual({ ...state, battle: null });
  });

  it("falls back to a new game for broken data", () => {
    for (const raw of [null, "", "{", '{"version":999}', '{"version":1,"heroes":5}']) {
      expect(deserialize(raw, T0).heroes).toHaveLength(3);
    }
  });

  it("a loaded game can be advanced", () => {
    const loaded = deserialize(serialize(fresh()), T0);
    expect(() => advance(loaded, T0 + SECOND)).not.toThrow();
    expect(loaded.battle).not.toBeNull();
  });

  it("gold helper keeps totals in step", () => {
    const state = fresh();
    addGold(state, 50);
    expect([state.runGold, state.lifetimeGold]).toEqual([50, 50]);
  });
});

describe("format", () => {
  it("shortens numbers and durations", () => {
    expect(formatNumber(1500)).toBe("1.50K");
    expect(formatNumber(2.5e9)).toBe("2.50B");
    expect(formatDuration(125)).toBe("2m 5s");
  });
});
