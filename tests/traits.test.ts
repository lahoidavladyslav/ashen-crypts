import { describe, expect, it } from "vitest";
import { spawnEnemies, startBattle, stepBattle } from "../src/engine/combat";
import { SUMMON_CAP, WAVES_PER_DEPTH, bossTrait, enemyDef } from "../src/engine/config";
import { newState, type Fighter, type GameState } from "../src/engine/state";

const T0 = new Date(2026, 0, 10, 12, 0, 0).getTime();
const hooks = { onKill: () => undefined, onGold: () => undefined, onChest: () => undefined };

function battleAt(depth: number): GameState {
  const state = newState(T0, 5);
  state.depth = depth;
  state.maxDepth = depth;
  startBattle(state, "stage", WAVES_PER_DEPTH);
  for (const hero of state.heroes) hero.level = 1;
  return state;
}

function boss(state: GameState): Fighter {
  const found = state.battle!.enemies.find((e) => e.boss);
  if (!found) throw new Error("no boss");
  return found;
}

function immortal(state: GameState): void {
  for (const hero of state.battle!.heroes) {
    hero.maxHp = 1e12;
    hero.hp = 1e12;
    hero.atk = 0;
  }
}

describe("boss traits", () => {
  it("each ten depths brings a different boss mechanic", () => {
    expect([1, 11, 21, 31, 41, 51].map(bossTrait)).toEqual([
      "armored",
      "regen",
      "enrage",
      "summoner",
      "thick",
      "armored",
    ]);
  });

  it("armored bosses have double the defense of other bosses at the same depth", () => {
    const armored = spawnEnemies(1, WAVES_PER_DEPTH).find((e) => e.boss)!;
    expect(armored.def).toBeCloseTo(enemyDef(1) * 1.5 * 2, 9);
    const regen = spawnEnemies(11, WAVES_PER_DEPTH).find((e) => e.boss)!;
    expect(regen.def).toBeCloseTo(enemyDef(11) * 1.5, 9);
  });

  it("colossal bosses have 50% more health", () => {
    const thick = spawnEnemies(41, WAVES_PER_DEPTH).find((e) => e.boss)!;
    const regen = spawnEnemies(41, 1)[0]!;
    expect(thick.maxHp / (regen.maxHp * 6)).toBeCloseTo(1.5, 9);
  });

  it("regenerating bosses heal over time", () => {
    const state = battleAt(11);
    immortal(state);
    boss(state).hp = boss(state).maxHp / 2;
    stepBattle(state, 10, T0, hooks);
    expect(boss(state).hp).toBeGreaterThan(boss(state).maxHp * 0.6);
  });

  it("enraged bosses hit harder the longer the fight goes", () => {
    const state = battleAt(21);
    const foe = boss(state);
    const hero = state.battle!.heroes[0]!;
    hero.maxHp = 1e12;
    hero.hp = 1e12;
    for (const other of state.battle!.heroes.slice(1)) other.hp = 0;
    state.battle!.heroes[0]!.shieldUntil = 1e9;

    const hit = (seconds: number): number => {
      state.battle = { ...state.battle!, delay: 0 };
      const before = hero.hp;
      foe.traitTimer = seconds;
      foe.timer = 10;
      stepBattle(state, 0.1, T0, hooks);
      return before - hero.hp;
    };
    const early = hit(0);
    const late = hit(30);
    expect(late).toBeGreaterThan(early * 1.5);
  });

  it("summoners call minions but never beyond the cap", () => {
    const state = battleAt(31);
    immortal(state);
    boss(state).maxHp = 1e15;
    boss(state).hp = 1e15;
    const start = state.battle!.enemies.length;
    stepBattle(state, 9, T0, hooks);
    expect(state.battle!.enemies.length).toBe(start + 1);
    stepBattle(state, 100, T0, hooks);
    expect(state.battle!.enemies.length).toBeLessThanOrEqual(SUMMON_CAP);
    expect(state.battle!.enemies.some((e) => e.summoned)).toBe(true);
  });

  it("summoned minions give no gold", () => {
    const state = battleAt(31);
    let gold = 0;
    state.battle!.enemies = [
      { ...spawnEnemies(31, 1)[0]!, summoned: true, hp: 0 },
    ];
    state.battle!.heroes.forEach((h) => (h.atk = 0));
    stepBattle(state, 0.2, T0, { ...hooks, onGold: (_, amount) => (gold += amount) });
    expect(gold).toBe(0);
  });

  it("trial bosses use the trait of the deepest depth reached", () => {
    const state = newState(T0, 5);
    state.maxDepth = 21;
    startBattle(state, "trial");
    expect(boss(state).trait).toBe("enrage");
    expect(state.battle!.depth).toBe(21);
  });
});

describe("soft enrage", () => {
  it("a stalemate always ends: enemies eventually overwhelm a party that cannot kill them", () => {
    const state = battleAt(11);
    for (const hero of state.battle!.heroes) hero.atk = 0;
    boss(state).hp = boss(state).maxHp;
    const before = state.stats.wipes;
    stepBattle(state, 600, T0, hooks);
    expect(state.stats.wipes).toBeGreaterThan(before);
  });

  it("does not touch short fights", () => {
    const state = battleAt(1);
    const hero = state.battle!.heroes[0]!;
    hero.hp = hero.maxHp;
    stepBattle(state, 30, T0, hooks);
    expect(state.battle!.waveTime).toBeLessThan(60 + 1);
  });

  it("the wave timer starts over for the next wave", () => {
    const state = newState(T0, 5);
    startBattle(state, "stage", 1);
    state.heroes.forEach((h) => (h.level = 50));
    state.battle!.heroes.forEach((f) => ((f.atk = 1e9), (f.maxHp = 1e9), (f.hp = 1e9)));
    stepBattle(state, 3, T0, hooks);
    expect(state.battle!.wave).toBeGreaterThan(1);
    expect(state.battle!.waveTime).toBeLessThan(3);
  });
});
