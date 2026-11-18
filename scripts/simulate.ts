import { CLASSES } from "../src/engine/config";
import { ascend, ascensionGain } from "../src/engine/ascension";
import { advance, claimChest } from "../src/engine/game";
import { formatDuration } from "../src/engine/format";
import { buyLevels, buyMeta, canHire, enhance, hireHero, SLOT_IDS } from "../src/engine/progression";
import { META } from "../src/engine/config";
import { newState, type GameState } from "../src/engine/state";

const START = new Date(2026, 0, 10, 8, 0, 0).getTime();

function spendGold(state: GameState): void {
  for (const def of CLASSES) if (canHire(state, def.id)) hireHero(state, def.id);
  for (let guard = 0; guard < 40; guard++) {
    let target = -1;
    let lowest = Infinity;
    state.heroes.forEach((hero, index) => {
      if (hero.level < lowest) {
        lowest = hero.level;
        target = index;
      }
    });
    if (target < 0 || buyLevels(state, target, 1) === 0) break;
  }
  for (let index = 0; index < state.heroes.length; index++) {
    for (const slot of SLOT_IDS) enhance(state, index, slot);
  }
}

function spendShards(state: GameState): void {
  for (let guard = 0; guard < 30; guard++) {
    let bought = false;
    for (const meta of META) bought = buyMeta(state, meta.id) || bought;
    if (!bought) break;
  }
}

export interface Options {
  hours: number;
  ascendAtGain: number;
}

export function play(options: Options): void {
  const state = newState(START, 7);
  let now = START;
  let runStart = now;
  let threshold = options.ascendAtGain;
  const marks = [5, 10, 15, 20, 25, 30, 40, 50, 60, 80];
  let next = 0;
  const log: string[] = [];
  for (let second = 0; second < options.hours * 3600; second++) {
    now += 1000;
    advance(state, now);
    while (state.chests > 0) claimChest(state);
    if (second % 5 === 0) spendGold(state);

    if (state.ascensions === 0) {
      while (next < marks.length && state.maxDepth >= (marks[next] ?? Infinity)) {
        log.push(`  depth ${marks[next]} at ${formatDuration(second)} (wipes ${state.stats.wipes})`);
        next++;
      }
    }
    if (ascensionGain(state) >= threshold) {
      const depth = state.maxDepth;
      const gain = ascend(state);
      spendShards(state);
      threshold = Math.max(options.ascendAtGain, Math.ceil(gain * 1.5));
      log.push(
        `  ascension #${state.ascensions}: depth ${depth}, +${gain} shards after ${formatDuration((now - runStart) / 1000)}`,
      );
      runStart = now;
    }
  }
  console.log(
    `ascend at +${options.ascendAtGain}, ${options.hours}h -> depth ${state.maxDepth}, best ${state.bestDepth}, ${state.ascensions} ascensions, wipes ${state.stats.wipes}, kills ${state.stats.kills}`,
  );
  console.log(log.slice(0, 16).join("\n"));
}

play({ hours: Number(process.argv[2] ?? 6), ascendAtGain: Number(process.argv[3] ?? 1e9) });
