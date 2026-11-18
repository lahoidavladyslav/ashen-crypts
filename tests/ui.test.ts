// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { advance } from "../src/engine/game";
import { newState, type GameState } from "../src/engine/state";
import { createApp, type App } from "../src/ui/app";
import { Sound, type Settings } from "../src/ui/sound";

const NOW = new Date(2026, 0, 10, 12, 0, 0).getTime();

let state: GameState;
let root: HTMLElement;
let app: App;
let settings: Settings;
let saves = 0;

function buttons(): HTMLButtonElement[] {
  return [...root.querySelectorAll("button")];
}

function byText(text: string): HTMLButtonElement {
  const found = buttons().find((button) => button.textContent?.includes(text));
  if (!found) throw new Error(`no button with "${text}"`);
  return found;
}

function tabButton(label: string): HTMLButtonElement {
  const found = [...root.querySelectorAll<HTMLButtonElement>("nav button")].find((b) => b.textContent === label);
  if (!found) throw new Error(`no tab "${label}"`);
  return found;
}

function refresh(): void {
  advance(state, state.lastTick + 100);
  app.update(state.lastTick);
}

beforeEach(() => {
  document.body.innerHTML = '<div id="app"></div>';
  window.location.hash = "";
  root = document.getElementById("app")!;
  state = newState(NOW, 11);
  settings = { sound: false, vibration: false };
  saves = 0;
  app = createApp(root, state, () => (saves += 1), new Sound(settings), settings);
  refresh();
});

describe("interface", () => {
  it("shows gold, depth and the party fighting", () => {
    expect(root.textContent).toContain("Depth 1");
    expect(root.querySelectorAll(".unit").length).toBeGreaterThanOrEqual(4);
  });

  it("switches between the five tabs", () => {
    for (const [label, expected] of [
      ["Party", "Knight"],
      ["Daily", "Crypt trials"],
      ["Ascend", "Ascension"],
      ["Records", "Achievements"],
      ["Battle", "Wave"],
    ] as const) {
      tabButton(label).click();
      refresh();
      const active = root.querySelector(".pane.active");
      expect(active?.textContent).toContain(expected);
    }
  });

  it("levels a hero up with the gold button", () => {
    state.gold = 1000;
    tabButton("Party").click();
    refresh();
    const before = state.heroes[0]!.level;
    byText("Level +1").click();
    expect(state.heroes[0]!.level).toBe(before + 1);
    expect(state.gold).toBeLessThan(1000);
  });

  it("disables a purchase that is too expensive", () => {
    state.gold = 0;
    tabButton("Party").click();
    refresh();
    expect(byText("Level +1").disabled).toBe(true);
  });

  it("the quantity buttons change how many levels are bought", () => {
    state.gold = 1e6;
    tabButton("Party").click();
    refresh();
    byText("x10").click();
    refresh();
    byText("Level +10").click();
    expect(state.heroes[0]!.level).toBe(11);
  });

  it("opens a chest and shows the result", () => {
    state.chests = 1;
    refresh();
    byText("Open chest (1)").click();
    expect(state.chests).toBe(0);
    expect(document.querySelector(".toast")).not.toBeNull();
  });

  it("starts a trial and spends a key", () => {
    byText("Trial (3/3)").click();
    expect(state.keys.count).toBe(2);
    expect(state.battle?.kind).toBe("trial");
  });

  it("casts Battle Cry once and then waits for the cooldown", () => {
    byText("Battle Cry").click();
    refresh();
    expect(byText("Battle Cry").disabled).toBe(true);
  });

  it("claims the daily reward", () => {
    tabButton("Daily").click();
    refresh();
    const before = state.gold;
    byText("Claim").click();
    expect(state.streak.count).toBe(1);
    expect(state.gold).toBeGreaterThan(before);
  });

  it("toggles sound in the settings", () => {
    tabButton("Records").click();
    refresh();
    expect(byText("Sound: off")).toBeTruthy();
    byText("Sound: off").click();
    refresh();
    expect(settings.sound).toBe(true);
  });

  it("announces a new achievement once", () => {
    state.stats.kills = 1;
    refresh();
    refresh();
    expect([...document.querySelectorAll(".toast")].filter((t) => t.textContent?.includes("First Blood"))).toHaveLength(1);
  });

  it("export copies a code and import restores it", async () => {
    const written: string[] = [];
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: (text: string) => (written.push(text), Promise.resolve()) },
      configurable: true,
    });
    tabButton("Records").click();
    refresh();
    state.gold = 777;
    byText("Export save").click();
    expect(written).toHaveLength(1);

    state.gold = 1;
    vi.spyOn(window, "prompt").mockReturnValue(written[0]!);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    byText("Import save").click();
    expect(state.gold).toBe(777);
    expect(saves).toBeGreaterThan(0);
  });

  it("rejects a bad import code without touching the game", () => {
    tabButton("Records").click();
    refresh();
    state.gold = 5;
    vi.spyOn(window, "prompt").mockReturnValue("garbage");
    byText("Import save").click();
    expect(state.gold).toBeGreaterThanOrEqual(5);
    expect([...document.querySelectorAll(".toast")].some((t) => t.textContent?.includes("not a valid save"))).toBe(true);
  });

  it("reset asks first and then starts over", () => {
    tabButton("Records").click();
    refresh();
    state.heroes[0]!.level = 30;
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    byText("Reset game").click();
    expect(state.heroes[0]!.level).toBe(30);
    confirmSpy.mockReturnValue(true);
    byText("Reset game").click();
    expect(state.heroes[0]!.level).toBe(1);
  });

  it("ascend stays locked before depth 25", () => {
    tabButton("Ascend").click();
    refresh();
    const ascendButton = root.querySelector<HTMLButtonElement>(".pane.active button.primary");
    expect(ascendButton?.disabled).toBe(true);
  });
});
