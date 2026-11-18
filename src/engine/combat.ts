import {
  CRIT_MULTIPLIER,
  RALLY_COOLDOWN_SECONDS,
  RALLY_SECONDS,
  TICK_SECONDS,
  TRIAL_POWER,
  WAVES_PER_DEPTH,
  WAVE_DELAY_SECONDS,
  bossName,
  enemyAtk,
  enemyDef,
  enemyGold,
  enemyHp,
  enemyName,
} from "./config";
import { dropChance, equipOrSalvage, rollItem } from "./loot";
import { nextFloat } from "./rng";
import { classOf, goldMultiplier, heroStats, rallyMultiplier } from "./stats";
import type { Battle, Fighter, GameState } from "./state";

export interface BattleHooks {
  onKill: (state: GameState, boss: boolean) => void;
  onChest: (state: GameState) => void;
  onGold: (state: GameState, amount: number) => void;
}

function fighterFromStats(state: GameState, index: number): Fighter {
  const stats = heroStats(state, index);
  const hero = state.heroes[index];
  return {
    name: hero ? classOf(hero.classId).name : "Hero",
    side: "hero",
    heroIndex: index,
    boss: false,
    maxHp: stats.hp,
    hp: stats.hp,
    atk: stats.atk,
    def: stats.def,
    speed: stats.speed,
    crit: stats.crit,
    timer: 0,
    skillCd: hero ? classOf(hero.classId).skillCooldown * 0.5 : 10,
    shieldUntil: 0,
  };
}

function enemy(name: string, hp: number, atk: number, def: number, boss: boolean): Fighter {
  return {
    name,
    side: "enemy",
    heroIndex: -1,
    boss,
    maxHp: hp,
    hp,
    atk,
    def,
    speed: boss ? 0.7 : 0.8,
    crit: 0,
    timer: 0,
    skillCd: 0,
    shieldUntil: 0,
  };
}

export function spawnEnemies(depth: number, wave: number, power = 1): Fighter[] {
  const hp = enemyHp(depth) * power;
  const atk = enemyAtk(depth) * power;
  const def = enemyDef(depth);
  if (wave >= WAVES_PER_DEPTH) {
    return [
      enemy(bossName(depth), hp * 8, atk * 1.6, def * 1.5, true),
      enemy(enemyName(depth, 1), hp, atk, def, false),
      enemy(enemyName(depth, 2), hp, atk, def, false),
    ];
  }
  const count = 2 + Math.floor(wave / 4);
  return Array.from({ length: count }, (_, i) => enemy(enemyName(depth, i), hp, atk, def, false));
}

export function startBattle(state: GameState, kind: "stage" | "trial", wave = 1): void {
  const heroes = state.heroes.map((_, index) => fighterFromStats(state, index));
  const enemies =
    kind === "trial"
      ? spawnEnemies(state.maxDepth, WAVES_PER_DEPTH, TRIAL_POWER)
      : spawnEnemies(state.depth, wave);
  state.battle = { kind, wave, clock: 0, delay: 0, heroes, enemies };
}

export function refreshHeroStats(state: GameState): void {
  const battle = state.battle;
  if (!battle) return;
  while (battle.heroes.length < state.heroes.length) {
    battle.heroes.push(fighterFromStats(state, battle.heroes.length));
  }
  for (const fighter of battle.heroes) {
    const stats = heroStats(state, fighter.heroIndex);
    const ratio = fighter.maxHp > 0 ? fighter.hp / fighter.maxHp : 1;
    fighter.maxHp = stats.hp;
    fighter.hp = fighter.hp > 0 ? stats.hp * ratio : 0;
    fighter.atk = stats.atk;
    fighter.def = stats.def;
    fighter.speed = stats.speed;
    fighter.crit = stats.crit;
  }
}

function alive(list: Fighter[]): Fighter[] {
  return list.filter((fighter) => fighter.hp > 0);
}

function damage(state: GameState, from: Fighter, to: Fighter, multiplier: number, now: number, forceCrit = false): number {
  let amount = from.atk * multiplier * (100 / (100 + to.def));
  if (forceCrit || nextFloat(state) < from.crit) amount *= CRIT_MULTIPLIER;
  if (from.side === "hero") amount *= rallyMultiplier(state, now);
  if (to.side === "hero" && to.shieldUntil > (state.battle?.clock ?? 0)) amount *= 0.5;
  to.hp = Math.max(0, to.hp - amount);
  return amount;
}

function heal(target: Fighter, amount: number): void {
  target.hp = Math.min(target.maxHp, target.hp + amount);
}

function pickEnemyTarget(state: GameState, heroes: Fighter[], clock: number): Fighter | undefined {
  const living = alive(heroes);
  const shielded = living.find((fighter) => fighter.shieldUntil > clock);
  if (shielded) return shielded;
  const total = living.length + 1;
  let roll = nextFloat(state) * total;
  for (const [i, fighter] of living.entries()) {
    roll -= i === 0 ? 2 : 1;
    if (roll <= 0) return fighter;
  }
  return living[0];
}

function castSkill(state: GameState, battle: Battle, caster: Fighter, now: number): boolean {
  const hero = state.heroes[caster.heroIndex];
  if (!hero) return false;
  const def = classOf(hero.classId);
  const foes = alive(battle.enemies);
  const friends = alive(battle.heroes);
  switch (def.skill) {
    case "shieldWall":
      caster.shieldUntil = battle.clock + 5;
      break;
    case "fireball":
      if (foes.length === 0) return false;
      for (const foe of foes) damage(state, caster, foe, 2.5, now);
      break;
    case "prayer":
      if (!friends.some((f) => f.hp < f.maxHp * 0.9)) return false;
      for (const friend of friends) heal(friend, caster.atk * 2.5);
      break;
    case "backstab": {
      const target = foes.reduce<Fighter | undefined>((best, f) => (!best || f.hp > best.hp ? f : best), undefined);
      if (!target) return false;
      damage(state, caster, target, 4, now, true);
      break;
    }
    case "drain": {
      const target = foes[0];
      if (!target) return false;
      heal(caster, damage(state, caster, target, 3, now));
      break;
    }
  }
  caster.skillCd = def.skillCooldown;
  return true;
}

function heroAct(state: GameState, battle: Battle, hero: Fighter, now: number): void {
  if (hero.skillCd <= 0 && castSkill(state, battle, hero, now)) return;
  const interval = 1 / hero.speed;
  if (hero.timer < interval) return;
  hero.timer -= interval;
  const klass = state.heroes[hero.heroIndex]?.classId;
  if (klass === "cleric") {
    const hurt = alive(battle.heroes).reduce<Fighter | undefined>(
      (worst, f) => (!worst || f.hp / f.maxHp < worst.hp / worst.maxHp ? f : worst),
      undefined,
    );
    if (hurt && hurt.hp < hurt.maxHp) {
      heal(hurt, hero.atk * 1.2);
      return;
    }
  }
  const target = alive(battle.enemies)[0];
  if (target) damage(state, hero, target, 1, now);
}

function enemyAct(state: GameState, battle: Battle, foe: Fighter, now: number): void {
  const interval = 1 / foe.speed;
  if (foe.timer < interval) return;
  foe.timer -= interval;
  const target = pickEnemyTarget(state, battle.heroes, battle.clock);
  if (target) damage(state, foe, target, 1, now);
}

function rewardKill(state: GameState, foe: Fighter, kind: Battle["kind"], hooks: BattleHooks): void {
  hooks.onKill(state, foe.boss);
  if (kind !== "stage") return;
  const amount = enemyGold(state.depth) * (foe.boss ? 10 : 1) * goldMultiplier(state);
  hooks.onGold(state, amount);
  if (!foe.boss && nextFloat(state) < dropChance(state)) {
    equipOrSalvage(state, rollItem(state, state.depth));
  }
}

function healAfterWave(battle: Battle): void {
  for (const hero of alive(battle.heroes)) hero.hp = Math.min(hero.maxHp, hero.hp + hero.maxHp * 0.1);
}

function resetHeroes(state: GameState, battle: Battle): void {
  battle.heroes = state.heroes.map((_, index) => fighterFromStats(state, index));
}

export interface TrialResult {
  won: boolean;
}

export function stepBattle(state: GameState, seconds: number, now: number, hooks: BattleHooks): TrialResult | null {
  let remaining = seconds;
  let trial: TrialResult | null = null;
  while (remaining > 1e-9 && state.battle) {
    const dt = Math.min(TICK_SECONDS, remaining);
    remaining -= dt;
    const battle = state.battle;
    battle.clock += dt;

    if (battle.delay > 0) {
      battle.delay -= dt;
      continue;
    }

    for (const fighter of [...battle.heroes, ...battle.enemies]) {
      if (fighter.hp > 0) {
        fighter.timer += dt;
        fighter.skillCd = Math.max(0, fighter.skillCd - dt);
      }
    }
    for (const hero of alive(battle.heroes)) heroAct(state, battle, hero, now);
    for (const foe of alive(battle.enemies)) enemyAct(state, battle, foe, now);

    const dead = battle.enemies.filter((foe) => foe.hp <= 0);
    battle.enemies = alive(battle.enemies);
    for (const foe of dead) rewardKill(state, foe, battle.kind, hooks);

    if (alive(battle.heroes).length === 0) {
      state.stats.wipes += 1;
      if (battle.kind === "trial") {
        trial = { won: false };
        startBattle(state, "stage", 1);
        continue;
      }
      state.wipeStreak += 1;
      resetHeroes(state, battle);
      refreshHeroStats(state);
      battle.wave = 1;
      battle.enemies = spawnEnemies(state.depth, 1);
      battle.delay = 1.5;
      continue;
    }

    if (battle.enemies.length === 0) {
      if (battle.kind === "trial") {
        trial = { won: true };
        startBattle(state, "stage", 1);
        continue;
      }
      healAfterWave(battle);
      battle.delay = WAVE_DELAY_SECONDS;
      if (battle.wave >= WAVES_PER_DEPTH) {
        state.wipeStreak = 0;
        hooks.onChest(state);
        state.maxDepth = Math.max(state.maxDepth, state.depth);
        state.bestDepth = Math.max(state.bestDepth, state.depth);
        if (state.autoAdvance) state.depth += 1;
        battle.wave = 1;
        refreshHeroStats(state);
      } else {
        battle.wave += 1;
      }
      battle.enemies = spawnEnemies(state.depth, battle.wave);
    }
  }
  return trial;
}

export function rallyReady(state: GameState, now: number): boolean {
  return now >= state.rally.readyAt;
}

export function castRally(state: GameState, now: number): boolean {
  if (!rallyReady(state, now)) return false;
  state.rally.until = now + RALLY_SECONDS * 1000;
  state.rally.readyAt = now + RALLY_COOLDOWN_SECONDS * 1000;
  return true;
}
