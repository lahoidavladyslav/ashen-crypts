import { ascend, ascensionGain } from "../src/engine/ascension";
import { CLASSES, META } from "../src/engine/config";
import { claimQuest, claimStreak, startTrial } from "../src/engine/daily";
import { formatDuration } from "../src/engine/format";
import { advance, claimChest } from "../src/engine/game";
import { buyLevels, buyMeta, canHire, enhance, hireHero, SLOT_IDS } from "../src/engine/progression";
import { newState, type GameState } from "../src/engine/state";

const DAY = 86_400_000;
const START = new Date(2026, 0, 10, 0, 0, 0).getTime();

function spend(state: GameState): void {
  for (const def of CLASSES) if (canHire(state, def.id)) hireHero(state, def.id);
  for (let guard = 0; guard < 60; guard++) {
    let target = 0;
    state.heroes.forEach((hero, index) => {
      if (hero.level < (state.heroes[target]?.level ?? Infinity)) target = index;
    });
    if (buyLevels(state, target, 1) === 0) break;
  }
  for (let index = 0; index < state.heroes.length; index++) {
    for (const slot of SLOT_IDS) enhance(state, index, slot);
  }
}

function spendShards(state: GameState): void {
  for (let guard = 0; guard < 40; guard++) {
    let bought = false;
    for (const meta of META) bought = buyMeta(state, meta.id) || bought;
    if (!bought) break;
  }
}

function session(state: GameState, start: number, minutes: number): number {
  let now = start;
  advance(state, now);
  claimStreak(state, now);
  for (const quest of state.quests.items) claimQuest(state, quest.id);
  while (state.chests > 0) claimChest(state);
  spend(state);
  startTrial(state, now);
  for (let second = 0; second < minutes * 60; second++) {
    now += 1000;
    advance(state, now);
    if (second % 20 === 0) {
      while (state.chests > 0) claimChest(state);
      spend(state);
    }
  }
  return now;
}

function simulate(sessionHours: number[], minutes: number, days: number): void {
  const state = newState(START, 7);
  const report: string[] = [];
  let lastProgress = START;
  let best = 1;
  for (let day = 0; day < days; day++) {
    for (const hour of sessionHours) {
      const at = START + day * DAY + hour * 3600_000 + 5000;
      if (at <= state.lastTick) continue;
      advance(state, at - 1000 > state.lastTick ? at - 1000 : state.lastTick + 1);
      session(state, state.lastTick + 1000, minutes);
      if (state.maxDepth > best) {
        best = state.maxDepth;
        lastProgress = state.lastTick;
      }
      const stuck = state.lastTick - lastProgress > 3 * DAY && ascensionGain(state) >= 1;
      if (stuck) {
        const depth = state.maxDepth;
        const gain = ascend(state);
        spendShards(state);
        report.push(`  day ${day + 1}: ascended at depth ${depth} for +${gain} shards`);
        best = 1;
        lastProgress = state.lastTick;
      }
    }
    if ([0, 1, 2, 6, 13, 29].includes(day)) {
      report.push(`  end of day ${day + 1}: depth ${state.depth}, best ${state.bestDepth}, heroes lv ${state.heroes.map((h) => h.level).join("/")}, chests opened via offline+bosses, wipes ${state.stats.wipes}`);
    }
  }
  console.log(
    `${sessionHours.length} sessions/day x ${minutes} min, ${days} days -> best depth ${state.bestDepth}, ${state.ascensions} ascensions, play time ${formatDuration(state.stats.playSeconds)}`,
  );
  console.log(report.join("\n"));
}

simulate([8, 13, 20], 10, 30);
simulate([20], 10, 30);
