import {
  CLASSES,
  KEY_MAX,
  META,
  RALLY_COOLDOWN_SECONDS,
  RARITIES,
  SLOTS,
  STREAK_REWARDS,
  TRAITS,
  WAVES_PER_DEPTH,
  ENHANCE_MAX,
  type Slot,
} from "../engine/config";
import { ascend, ascensionGain } from "../engine/ascension";
import { castRally, rallyReady } from "../engine/combat";
import { QUEST_LABEL, canClaimStreak, claimQuest, claimStreak, startTrial } from "../engine/daily";
import { formatDuration, formatNumber } from "../engine/format";
import { claimChest, offlineCapHours, type OfflineReport } from "../engine/game";
import {
  buyLevels,
  buyMeta,
  enhance,
  enhanceCost,
  hireCost,
  hireHero,
  hireable,
  levelCost,
  maxLevels,
  metaCost,
} from "../engine/progression";
import type { Fighter, GameState } from "../engine/state";
import { classOf, heroStats, itemPower, metaLevel, rallyActive, resolveBonus } from "../engine/stats";
import { ACHIEVEMENTS } from "../engine/achievements";
import { newState } from "../engine/state";
import { exportSave, parseSave, replaceState } from "../save";
import { h, modal, toast } from "./dom";
import { saveSettings, type Settings, type Sound } from "./sound";

type TabId = "battle" | "heroes" | "daily" | "ascend" | "records";
type Quantity = 1 | 10 | "max";

const TABS: readonly { id: TabId; label: string }[] = [
  { id: "battle", label: "Battle" },
  { id: "heroes", label: "Party" },
  { id: "daily", label: "Daily" },
  { id: "ascend", label: "Ascend" },
  { id: "records", label: "Records" },
];

const RARITY_NAME = Object.fromEntries(RARITIES.map((entry) => [entry.id, entry.name]));

export interface App {
  update: (now: number) => void;
  showOffline: (report: OfflineReport) => void;
}

function sync(container: HTMLElement, signature: string, build: () => Node[]): void {
  if (container.dataset.sig === signature) return;
  container.dataset.sig = signature;
  container.replaceChildren(...build());
}

function unit(fighter: Fighter, state: GameState, now: number): HTMLElement {
  const dead = fighter.hp <= 0;
  const element = h("div", { class: `unit ${fighter.side === "enemy" ? "enemy" : ""} ${fighter.boss ? "boss" : ""} ${dead ? "dead" : ""}` });
  element.append(h("div", { class: "name", text: fighter.name }));
  if (fighter.trait) element.append(h("div", { class: "sub", text: TRAITS[fighter.trait].name }));
  element.append(h("div", { class: "sub", text: `${formatNumber(Math.max(0, fighter.hp))}` }));
  const hp = h("div", { class: "bar" }, h("div"));
  (hp.firstChild as HTMLElement).style.width = `${Math.max(0, (fighter.hp / fighter.maxHp) * 100)}%`;
  element.append(hp);
  if (fighter.side === "hero") {
    const hero = state.heroes[fighter.heroIndex];
    const total = hero ? classOf(hero.classId).skillCooldown : 10;
    const skill = h("div", { class: "bar skill" }, h("div"));
    (skill.firstChild as HTMLElement).style.width = `${(1 - fighter.skillCd / total) * 100}%`;
    element.append(skill);
    if (fighter.shieldUntil > (state.battle?.clock ?? 0)) element.style.outline = "1px solid var(--rare)";
  }
  void now;
  return element;
}

export function createApp(
  root: HTMLElement,
  state: GameState,
  save: () => void,
  sound: Sound,
  settings: Settings,
): App {
  const seen = { kills: state.stats.kills, bosses: state.stats.bosses, wipes: state.stats.wipes };
  const requested = TABS.find((item) => item.id === location.hash.slice(1));
  let tab: TabId = requested?.id ?? "battle";
  let quantity: Quantity = 1;

  const gold = h("div", { class: "coins" });
  const depth = h("div", { class: "depth" });
  const depthSub = h("div", { class: "sub" });
  root.append(h("header", {}, gold, h("div", {}, depth, depthSub)));

  const waveFill = h("div");
  const waveTitle = h("div", { class: "title" });
  const resolveTag = h("span", { class: "tag resolve" });
  const waveCard = h("div", { class: "card" }, h("div", {}, waveTitle, resolveTag), h("div", { class: "bar wave" }, waveFill));
  const enemyLine = h("div", { class: "line" });
  const heroLine = h("div", { class: "line" });
  const arena = h("div", { class: "arena" }, enemyLine, heroLine);

  const rallyButton = h("button", {
    class: "primary",
    onclick: () => {
      if (castRally(state, Date.now())) {
        toast("Battle Cry! +50% damage for 10s");
        sound.play("rally");
      }
    },
  });
  const advanceButton = h("button", {
    onclick: () => {
      state.autoAdvance = !state.autoAdvance;
    },
  });
  const chestButton = h("button", {
    class: "gold",
    onclick: () => {
      const result = claimChest(state);
      if (!result) return;
      const where = result.equipped ? "equipped" : `salvaged, +${result.essence} essence`;
      toast(`${RARITY_NAME[result.item.rarity]} ${result.item.slot}: ${where}`);
      sound.play("chest");
      sound.buzz(result.item.rarity === "legendary" || result.item.rarity === "epic" ? 120 : 30);
    },
  });
  const trialButton = h("button", {
    onclick: () => {
      if (startTrial(state, Date.now())) toast("The trial begins");
    },
  });
  const actions = h("div", { class: "wrap" }, rallyButton, chestButton, trialButton, advanceButton);
  const feed = h("div", { class: "card feed" });
  const battlePane = h("section", { class: "pane" }, waveCard, arena, actions, h("div", { style: "height:10px" }), feed);

  const qtyButtons = ([1, 10, "max"] as const).map((value) =>
    h("button", {
      text: value === "max" ? "Max" : `x${value}`,
      onclick: () => {
        quantity = value;
      },
    }),
  );
  const heroCards: {
    title: HTMLElement;
    info: HTMLElement;
    skill: HTMLElement;
    buy: HTMLButtonElement;
    slots: Map<Slot, { box: HTMLElement; button: HTMLButtonElement }>;
  }[] = [];
  const heroList = h("div");
  const hireList = h("div");
  const heroesPane = h("section", { class: "pane" }, h("div", { class: "wrap", style: "margin-bottom:10px" }, ...qtyButtons), heroList, hireList);

  function buildHeroCard(index: number): void {
    const title = h("div", { class: "title" });
    const info = h("div", { class: "sub" });
    const skill = h("div", { class: "sub" });
    const buy = h("button", {
      class: "primary buy",
      onclick: () => {
        if (buyLevels(state, index, quantity) > 0) sound.play("level");
      },
    });
    const slots = new Map<Slot, { box: HTMLElement; button: HTMLButtonElement }>();
    const slotRow = h("div", { class: "row", style: "margin-top:10px;align-items:stretch" });
    for (const slot of SLOTS) {
      const box = h("div", { class: "slot" });
      const button = h("button", { style: "margin-top:6px;padding:6px 8px;width:100%", onclick: () => void enhance(state, index, slot.id) });
      const wrapper = h("div", { class: "grow" }, box, button);
      slots.set(slot.id, { box, button });
      slotRow.append(wrapper);
    }
    heroList.append(h("div", { class: "card" }, h("div", { class: "row" }, h("div", { class: "grow" }, title, info, skill), buy), slotRow));
    heroCards.push({ title, info, skill, buy, slots });
  }

  const streakCard = h("div", { class: "card" });
  const questList = h("div");
  const trialInfo = h("div", { class: "sub" });
  const trialCard = h(
    "div",
    { class: "card" },
    h("div", { class: "title", text: "Crypt trials" }),
    h("div", { class: "sub", text: "A boss stronger than anything you have faced. Win for a chest and essence." }),
    trialInfo,
  );
  const dailyPane = h("section", { class: "pane" }, streakCard, trialCard, questList);

  const ascendInfo = h("div", { class: "sub" });
  const ascendGain = h("div", { class: "big" });
  const ascendButton = h("button", {
    class: "primary",
    text: "Ascend",
    onclick: () => {
      const gain = ascensionGain(state);
      if (gain < 1) return;
      if (!confirm(`Ascend now? You gain ${gain} soul shards and restart from depth 1. Gear, hired heroes and shards stay.`)) return;
      ascend(state);
      save();
      toast(`Ascended. +${gain} soul shards`);
      tab = "battle";
    },
  });
  const metaRows = META.map((def) => {
    const info = h("div", { class: "sub" });
    const button = h("button", { class: "gold buy", onclick: () => void buyMeta(state, def.id) });
    const row = h("div", { class: "card row" }, h("div", { class: "grow" }, h("div", { class: "title", text: def.name }), h("div", { class: "sub", text: def.description }), info), button);
    return { id: def.id, info, button, row };
  });
  
  const ascendPane = h(
    "section",
    { class: "pane" },
    h("div", { class: "card" }, h("div", { class: "title", text: "Ascension" }), h("div", { class: "sub", text: "Restart for soul shards. Shards buy permanent upgrades." }), ascendGain, ascendInfo, h("div", { style: "height:10px" }), ascendButton),
    ...metaRows.map((row) => row.row),
  );

  const recordsPane = h("section", { class: "pane" });
  const panes: Record<TabId, HTMLElement> = {
    battle: battlePane,
    heroes: heroesPane,
    daily: dailyPane,
    ascend: ascendPane,
    records: recordsPane,
  };
  root.append(h("main", {}, battlePane, heroesPane, dailyPane, ascendPane, recordsPane));

  const dots = new Map<TabId, HTMLElement>();
  const navButtons = TABS.map((item) => {
    const dot = h("span", { class: "dot" });
    dots.set(item.id, dot);
    return h("button", { text: item.label, onclick: () => (tab = item.id) }, dot);
  });
  root.append(h("nav", {}, ...navButtons));

  function renderBattle(now: number): void {
    const battle = state.battle;
    if (!battle) return;
    const trial = battle.kind === "trial";
    depth.textContent = trial ? "Crypt trial" : `Depth ${state.depth}`;
    depthSub.textContent = `Best ${state.bestDepth}`;
    waveTitle.textContent = trial ? "Trial boss" : `Wave ${battle.wave} of ${WAVES_PER_DEPTH}`;
    waveFill.style.width = `${trial ? 100 : (battle.wave / WAVES_PER_DEPTH) * 100}%`;
    const resolve = resolveBonus(state);
    resolveTag.style.display = resolve > 0 ? "inline-block" : "none";
    resolveTag.textContent = `Resolve +${Math.round(resolve * 100)}%`;
    enemyLine.replaceChildren(...battle.enemies.map((f) => unit(f, state, now)));
    if (battle.enemies.length === 0) enemyLine.replaceChildren(h("div", { class: "empty", text: "..." }));
    heroLine.replaceChildren(...battle.heroes.map((f) => unit(f, state, now)));

    const rallyLeft = Math.ceil((state.rally.readyAt - now) / 1000);
    rallyButton.disabled = !rallyReady(state, now);
    rallyButton.textContent = rallyActive(state, now)
      ? "Battle Cry active"
      : rallyReady(state, now)
        ? "Battle Cry"
        : `Battle Cry ${Math.min(rallyLeft, RALLY_COOLDOWN_SECONDS)}s`;
    chestButton.disabled = state.chests < 1;
    chestButton.textContent = `Open chest (${state.chests})`;
    trialButton.disabled = state.keys.count < 1 || trial;
    trialButton.textContent = `Trial (${state.keys.count}/${KEY_MAX})`;
    advanceButton.textContent = state.autoAdvance ? "Advancing" : "Farming here";
    advanceButton.classList.toggle("on", state.autoAdvance);

    sync(feed, state.log.join("\n"), () => {
      if (state.log.length === 0) return [h("div", { class: "sub", text: "Loot will show up here." })];
      return state.log.map((line) => {
        const [rarity = "common", text = ""] = line.split("|");
        return h("div", { class: rarity, text });
      });
    });
  }

  function renderHeroes(): void {
    while (heroCards.length < state.heroes.length) buildHeroCard(heroCards.length);
    qtyButtons.forEach((button, i) => button.classList.toggle("on", ([1, 10, "max"] as const)[i] === quantity));
    state.heroes.forEach((hero, index) => {
      const card = heroCards[index];
      if (!card) return;
      const def = classOf(hero.classId);
      const stats = heroStats(state, index);
      card.title.textContent = `${def.name}, level ${hero.level}`;
      card.info.textContent = `${def.role}: ${formatNumber(stats.hp)} hp, ${formatNumber(stats.atk)} atk, ${formatNumber(stats.def)} def`;
      card.skill.textContent = `${def.skillName}: ${def.skillText}`;
      const count = quantity === "max" ? Math.max(1, maxLevels(state, index)) : quantity;
      const cost = levelCost(state, index, count);
      card.buy.replaceChildren(`Level +${count}`, h("small", { text: formatNumber(cost) }));
      card.buy.disabled = cost > state.gold;
      for (const slot of SLOTS) {
        const parts = card.slots.get(slot.id);
        if (!parts) continue;
        const item = hero.gear[slot.id];
        parts.box.className = `slot ${item ? item.rarity : "empty"}`;
        parts.box.textContent = item
          ? `${slot.name}: ${RARITY_NAME[item.rarity]} ${formatNumber(itemPower(item))}${item.enhance > 0 ? ` +${item.enhance}` : ""}`
          : `${slot.name}: empty`;
        parts.button.hidden = !item;
        if (item) {
          const full = item.enhance >= ENHANCE_MAX;
          parts.button.textContent = full ? "Max" : `Enhance ${enhanceCost(item.enhance)}`;
          parts.button.disabled = full || state.essence < enhanceCost(item.enhance);
        }
      }
    });
    const options = hireable(state);
    const hireSig = options.map((id) => `${id}:${state.gold >= hireCost(id)}`).join(",");
    sync(hireList, `${hireSig}|${state.heroes.length}`, () =>
      options.map((id) => {
        const def = classOf(id);
        const cost = hireCost(id);
        const button = h("button", { class: "gold", text: `Hire ${formatNumber(cost)}`, onclick: () => void hireHero(state, id) });
        button.disabled = state.gold < cost || state.heroes.length >= 5;
        return h("div", { class: "card row" }, h("div", { class: "grow" }, h("div", { class: "title", text: `${def.name}, ${def.role}` }), h("div", { class: "sub", text: def.skillText })), button);
      }),
    );
    const next = CLASSES.find((def) => !state.heroes.some((hero) => hero.classId === def.id) && state.bestDepth < def.unlockDepth);
    if (next && options.length === 0) {
      hireList.dataset.sig = "locked";
      hireList.replaceChildren(h("div", { class: "empty", text: `${next.name} joins at depth ${next.unlockDepth}` }));
    }
  }

  function renderDaily(now: number): void {
    const claimable = canClaimStreak(state, now);
    sync(streakCard, `${state.streak.count}|${state.streak.lastClaimDay}|${claimable}|${state.streak.shields}`, () => {
      const current = claimable ? state.streak.count % STREAK_REWARDS.length : (state.streak.count - 1) % STREAK_REWARDS.length;
      const days = h("div", { class: "days" });
      STREAK_REWARDS.forEach((_, index) => {
        const done = claimable ? index < current : index <= current;
        days.append(h("div", { class: `${done ? "done" : ""} ${claimable && index === current ? "today" : ""}`, text: `D${index + 1}` }));
      });
      const nodes: Node[] = [
        h("div", { class: "title", text: claimable ? "Daily reward ready" : "Daily reward claimed" }),
        h("div", { class: "sub", text: `${state.streak.count} day streak, ${state.streak.shields} shield(s). Day 7 pays a soul shard.` }),
        days,
      ];
      if (claimable) {
        nodes.push(h("div", { style: "height:10px" }));
        nodes.push(
          h("button", {
            class: "good",
            text: "Claim",
            onclick: () => {
              const reward = claimStreak(state, Date.now());
              if (!reward) return;
              const chest = reward.chests > 0 ? ` and ${reward.chests} chest(s)` : "";
              const shard = reward.shards > 0 ? `, +${reward.shards} shard` : "";
              toast(`Day ${reward.day}: +${formatNumber(reward.gold)} gold${chest}${shard}`);
              sound.play("claim");
            },
          }),
        );
      }
      return nodes;
    });

    const questSig = state.quests.items.map((q) => `${q.id}:${q.progress}:${q.claimed}`).join(",");
    sync(questList, questSig, () =>
      state.quests.items.map((quest) => {
        const done = quest.progress >= quest.target;
        const button = h("button", { class: done && !quest.claimed ? "good" : "", text: quest.claimed ? "Done" : "Claim", onclick: () => {
          const reward = claimQuest(state, quest.id);
          if (reward) toast(`+${formatNumber(reward.gold)} gold${reward.chests ? " and a chest" : ""}`);
        } });
        button.disabled = !done || quest.claimed;
        const fill = h("div");
        fill.style.width = `${(quest.progress / quest.target) * 100}%`;
        return h("div", { class: "card row" }, h("div", { class: "grow" }, h("div", { class: "title", text: `${QUEST_LABEL[quest.kind]}: ${quest.target}` }), h("div", { class: "sub", text: `${quest.progress} / ${quest.target}` }), h("div", { class: "bar good" }, fill)), button);
      }),
    );

    const wait = state.keys.nextAt > 0 ? ` Next key in ${formatDuration((state.keys.nextAt - now) / 1000)}.` : "";
    trialInfo.textContent = `Keys: ${state.keys.count}/${KEY_MAX}.${wait}`;
  }

  function renderAscend(): void {
    const gain = ascensionGain(state);
    ascendGain.textContent = gain > 0 ? `+${gain} soul shards` : "Reach depth 25";
    ascendInfo.textContent = `Shards: ${state.shards}. Deepest this run: ${state.maxDepth}. Ascensions: ${state.ascensions}.`;
    ascendButton.disabled = gain < 1;
    for (const row of metaRows) {
      const level = metaLevel(state, row.id);
      const cost = metaCost(state, row.id);
      row.info.textContent = `Level ${level}${row.id === "lore" ? `, offline cap ${offlineCapHours(state)}h` : ""}`;
      row.button.replaceChildren("Buy", h("small", { text: `${cost} shard${cost === 1 ? "" : "s"}` }));
      row.button.disabled = state.shards < cost;
    }
  }

  const statsCard = h("div", { class: "card" });
  const achievementList = h("div");
  const toggleSound = h("button", {
    onclick: () => {
      settings.sound = !settings.sound;
      saveSettings(settings);
      if (settings.sound) sound.play("claim");
    },
  });
  const toggleVibration = h("button", {
    onclick: () => {
      settings.vibration = !settings.vibration;
      saveSettings(settings);
      sound.buzz(40);
    },
  });
  const dataButtons = h(
    "div",
    { class: "wrap" },
    h("button", {
      text: "Export save",
      onclick: () => {
        const code = exportSave(state);
        if (navigator.clipboard) {
          navigator.clipboard.writeText(code).then(
            () => toast("Save copied to the clipboard"),
            () => window.prompt("Copy your save code:", code),
          );
        } else {
          window.prompt("Copy your save code:", code);
        }
      },
    }),
    h("button", {
      text: "Import save",
      onclick: () => {
        const code = window.prompt("Paste your save code:");
        if (!code) return;
        const parsed = parseSave(code);
        if (!parsed) {
          toast("That code is not a valid save");
          return;
        }
        if (!confirm("Replace the current game with this save?")) return;
        replaceState(state, parsed, newState(Date.now()));
        state.lastTick = Date.now();
        save();
        toast("Save imported");
      },
    }),
    h("button", {
      text: "Reset game",
      onclick: () => {
        if (!confirm("Delete all progress? This cannot be undone.")) return;
        const now = Date.now();
        replaceState(state, newState(now), newState(now));
        save();
        toast("Progress reset");
        tab = "battle";
      },
    }),
  );
  recordsPane.append(
    statsCard,
    h("div", { class: "card" }, h("div", { class: "title", text: "Settings" }), h("div", { style: "height:8px" }), h("div", { class: "wrap" }, toggleSound, toggleVibration), h("div", { style: "height:10px" }), dataButtons),
    h("div", { class: "title", text: "Achievements", style: "margin:12px 4px 8px" }),
    achievementList,
  );

  function renderRecords(): void {
    statsCard.replaceChildren(
      h("div", { class: "title", text: "Stats" }),
      h("div", { class: "sub", text: `Play time ${formatDuration(state.stats.playSeconds)}, kills ${formatNumber(state.stats.kills)}, bosses ${state.stats.bosses}` }),
      h("div", { class: "sub", text: `Wipes ${state.stats.wipes}, trials won ${state.stats.trialsWon}, lifetime gold ${formatNumber(state.lifetimeGold)}` }),
      h("div", { class: "sub", text: `Essence ${formatNumber(state.essence)}. Achievements give +${state.achievements.length}% power and gold.` }),
    );
    toggleSound.textContent = `Sound: ${settings.sound ? "on" : "off"}`;
    toggleVibration.textContent = `Vibration: ${settings.vibration ? "on" : "off"}`;
    sync(achievementList, state.achievements.join(","), () =>
      ACHIEVEMENTS.map((item) => {
        const done = state.achievements.includes(item.id);
        return h("div", { class: "card", style: done ? "" : "opacity:0.45" }, h("div", { class: "title", text: `${done ? "Done: " : ""}${item.name}` }), h("div", { class: "sub", text: item.description }));
      }),
    );
  }

  function react(): void {
    const stats = state.stats;
    if (stats.bosses > seen.bosses) {
      sound.play("boss");
      sound.buzz(60);
    } else if (stats.kills > seen.kills) {
      sound.play("kill");
    }
    if (stats.wipes > seen.wipes) sound.play("lose");
    seen.kills = stats.kills;
    seen.bosses = stats.bosses;
    seen.wipes = stats.wipes;
    for (const id of state.newAchievements.splice(0)) {
      const found = ACHIEVEMENTS.find((item) => item.id === id);
      if (found) toast(`Achievement: ${found.name}`);
      sound.play("claim");
    }
  }

  function update(now: number): void {
    gold.textContent = formatNumber(state.gold);
    for (const item of TABS) panes[item.id].classList.toggle("active", item.id === tab);
    navButtons.forEach((button, index) => button.classList.toggle("on", TABS[index]?.id === tab));
    renderBattle(now);
    if (tab === "heroes") renderHeroes();
    if (tab === "daily") renderDaily(now);
    if (tab === "ascend") renderAscend();
    if (tab === "records") renderRecords();
    react();

    const claimableQuest = state.quests.items.some((q) => q.progress >= q.target && !q.claimed);
    dots.get("daily")?.classList.toggle("show", canClaimStreak(state, now) || claimableQuest);
    dots.get("battle")?.classList.toggle("show", state.chests > 0);
    dots.get("ascend")?.classList.toggle("show", ascensionGain(state) >= 20);
  }

  function showOffline(report: OfflineReport): void {
    const lines = [
      h("div", { class: "sub", text: `Your party held the crypt for ${formatDuration(report.seconds)}.` }),
      h("div", { class: "big", text: `+${formatNumber(report.gold)} gold` }),
    ];
    if (report.chests > 0) lines.push(h("div", { class: "sub", text: `${report.chests} chest(s) were waiting.` }));
    if (report.capped) lines.push(h("div", { class: "sub", text: "Offline limit reached. Ancient Lore raises it." }));
    modal("Welcome back", lines, "Continue");
  }

  return { update, showOffline };
}
