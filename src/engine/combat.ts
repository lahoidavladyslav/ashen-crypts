import {
  CRIT_MULTIPLIER,
  ENRAGE_MAX_STEPS,
  ENRAGE_STEP_BONUS,
  ENRAGE_STEP_SECONDS,
  RALLY_COOLDOWN_SECONDS,
  REGEN_PER_SECOND,
  SOFT_ENRAGE_AFTER_SECONDS,
  SUMMON_CAP,
  SUMMON_SECONDS,
  RALLY_SECONDS,
  TICK_SECONDS,
  TRIAL_POWER,
  WAVES_PER_DEPTH,
  WAVE_DELAY_SECONDS,
  bossName,
  bossTrait,
  enemyAtk,
  enemyDef,
  enemyGold,
  enemyHp,
  enemyName,
} from "./config";
import { dropChance, equipOrSalvage, rollItem } from "./loot";
import { nextFloat } from "./rng";
import { classOf, goldMultiplier, heroStats, rallyMultiplier } from "./stats";
import type { Trait } from "./config";
import type { Battle, BattleEvent, Fighter, GameState } from "./state";

export interface BattleHooks {
  onKill: (state: GameState, boss: boolean) => void;
  onChest: (state: GameState) => void;
  onGold: (state: GameState, amount: number) => void;
}

let nextFighterId = 1;

function emit(state: GameState, event: BattleEvent): void {
  const events = state.battle?.events;
  if (!events) return;
  events.push(event);
  if (events.length > 240) events.splice(0, events.length - 240);
}

function fighterFromStats(state: GameState, index: number): Fighter {
  const stats = heroStats(state, index);
  const hero = state.heroes[index];
  return {
    id: nextFighterId++,
    kind: hero?.classId ?? "knight",
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
    trait: null,
    traitTimer: 0,
    summoned: false,
  };
}

function enemy(
  name: string,
  hp: number,
  atk: number,
  def: number,
  boss: boolean,
  trait: Trait | null = null,
  summoned = false,
): Fighter {
  return {
    id: nextFighterId++,
    kind: boss ? "boss" : name.toLowerCase().replace(/\s/g, ""),
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
    trait,
    traitTimer: 0,
    summoned,
  };
}

function boss(depth: number, hp: number, atk: number, def: number): Fighter {
  const trait = bossTrait(depth);
  return enemy(
    bossName(depth),
    hp * 6 * (trait === "thick" ? 1.5 : 1),
    atk * 1.6,
    def * 1.5 * (trait === "armored" ? 2 : 1),
    true,
    trait,
  );
}

export function spawnEnemies(depth: number, wave: number, power = 1): Fighter[] {
  const hp = enemyHp(depth) * power;
  const atk = enemyAtk(depth) * power;
  const def = enemyDef(depth);
  if (wave >= WAVES_PER_DEPTH) {
    return [
      boss(depth, hp, atk, def),
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
  const depth = kind === "trial" ? state.maxDepth : state.depth;
  const power = kind === "trial" ? TRIAL_POWER : 1;
  state.battle = { events: [], kind, depth, power, wave, clock: 0, waveTime: 0, delay: 0, heroes, enemies };
  emit(state, { type: "wave", wave, boss: wave >= WAVES_PER_DEPTH });
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

function damage(
  state: GameState,
  from: Fighter,
  to: Fighter,
  multiplier: number,
  now: number,
  forceCrit = false,
  skill?: string,
): number {
  let amount = from.atk * enrageFactor(from) * multiplier * (100 / (100 + to.def));
  if (from.side === "enemy") amount *= softEnrage(state.battle);
  const crit = forceCrit || nextFloat(state) < from.crit;
  if (crit) amount *= CRIT_MULTIPLIER;
  if (from.side === "hero") amount *= rallyMultiplier(state, now);
  if (to.side === "hero" && to.shieldUntil > (state.battle?.clock ?? 0)) amount *= 0.5;
  const wasAlive = to.hp > 0;
  to.hp = Math.max(0, to.hp - amount);
  emit(state, { type: "hit", from: from.id, to: to.id, amount, crit, skill });
  if (wasAlive && to.hp <= 0) emit(state, { type: "death", id: to.id, boss: to.boss });
  return amount;
}

function enrageFactor(fighter: Fighter): number {
  if (fighter.trait !== "enrage") return 1;
  const steps = Math.min(ENRAGE_MAX_STEPS, Math.floor(fighter.traitTimer / ENRAGE_STEP_SECONDS));
  return 1 + ENRAGE_STEP_BONUS * steps;
}

/** Long fights end: after a while every enemy hits harder and harder. */
function softEnrage(battle: Battle | null): number {
  const overtime = (battle?.waveTime ?? 0) - SOFT_ENRAGE_AFTER_SECONDS;
  if (overtime <= 0) return 1;
  return 1 + ENRAGE_STEP_BONUS * Math.min(ENRAGE_MAX_STEPS * 3, Math.floor(overtime / ENRAGE_STEP_SECONDS));
}

function heal(target: Fighter, amount: number): void {
  target.hp = Math.min(target.maxHp, target.hp + amount);
}

function healWithEvent(state: GameState, target: Fighter, amount: number): void {
  const before = target.hp;
  heal(target, amount);
  if (target.hp > before) emit(state, { type: "heal", to: target.id, amount: target.hp - before });
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
  emit(state, { type: "skill", from: caster.id, skill: def.skill });
  switch (def.skill) {
    case "shieldWall":
      caster.shieldUntil = battle.clock + 5;
      break;
    case "fireball":
      if (foes.length === 0) return false;
      for (const foe of foes) damage(state, caster, foe, 2.5, now, false, def.skill);
      break;
    case "prayer":
      if (!friends.some((f) => f.hp < f.maxHp * 0.9)) return false;
      for (const friend of friends) healWithEvent(state, friend, caster.atk * 2.5);
      break;
    case "backstab": {
      const target = foes.reduce<Fighter | undefined>((best, f) => (!best || f.hp > best.hp ? f : best), undefined);
      if (!target) return false;
      damage(state, caster, target, 4, now, true, def.skill);
      break;
    }
    case "drain": {
      const target = foes[0];
      if (!target) return false;
      healWithEvent(state, caster, damage(state, caster, target, 3, now, false, def.skill));
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
      healWithEvent(state, hurt, hero.atk * 1.2);
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

function runTraits(battle: Battle, dt: number): void {
  for (const foe of alive(battle.enemies)) {
    if (!foe.trait) continue;
    foe.traitTimer += dt;
    if (foe.trait === "regen") heal(foe, foe.maxHp * REGEN_PER_SECOND * dt);
    if (foe.trait === "summoner" && foe.traitTimer >= SUMMON_SECONDS) {
      foe.traitTimer -= SUMMON_SECONDS;
      if (alive(battle.enemies).length < SUMMON_CAP) {
        const minion = spawnEnemies(battle.depth, 1, battle.power)[0];
        if (minion) {
          const spawned = { ...minion, name: "Summoned Shade", kind: "shade", summoned: true };
          battle.enemies.push(spawned);
          battle.events.push({ type: "summon", id: spawned.id });
        }
      }
    }
  }
}

function rewardKill(state: GameState, foe: Fighter, kind: Battle["kind"], hooks: BattleHooks): void {
  hooks.onKill(state, foe.boss);
  if (kind !== "stage" || foe.summoned) return;
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
    battle.waveTime += dt;
    runTraits(battle, dt);
    for (const hero of alive(battle.heroes)) heroAct(state, battle, hero, now);
    for (const foe of alive(battle.enemies)) enemyAct(state, battle, foe, now);

    const dead = battle.enemies.filter((foe) => foe.hp <= 0);
    battle.enemies = alive(battle.enemies);
    for (const foe of dead) rewardKill(state, foe, battle.kind, hooks);

    if (alive(battle.heroes).length === 0) {
      state.stats.wipes += 1;
      battle.events.push({ type: "wipe" });
      if (battle.kind === "trial") {
        trial = { won: false };
        startBattle(state, "stage", 1);
        continue;
      }
      state.wipeStreak += 1;
      resetHeroes(state, battle);
      refreshHeroStats(state);
      battle.wave = 1;
      battle.depth = state.depth;
      battle.waveTime = 0;
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
        battle.events.push({ type: "clear", depth: state.depth, chest: true });
        state.maxDepth = Math.max(state.maxDepth, state.depth);
        state.bestDepth = Math.max(state.bestDepth, state.depth);
        if (state.autoAdvance) state.depth += 1;
        battle.wave = 1;
        refreshHeroStats(state);
      } else {
        battle.wave += 1;
      }
      battle.depth = state.depth;
      battle.waveTime = 0;
      battle.enemies = spawnEnemies(state.depth, battle.wave);
      battle.events.push({ type: "wave", wave: battle.wave, boss: battle.wave >= WAVES_PER_DEPTH });
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
