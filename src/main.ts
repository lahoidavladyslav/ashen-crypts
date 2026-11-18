import "./style.css";
import { OFFLINE_THRESHOLD_SECONDS } from "./engine/config";
import { ensureQuests, updateKeys } from "./engine/daily";
import { startBattle } from "./engine/combat";
import { advance } from "./engine/game";
import { deserialize, serialize } from "./engine/state";
import { createApp } from "./ui/app";
import { Sound, loadSettings } from "./ui/sound";

const SAVE_KEY = "ashen-crypts-save";
const SAVE_EVERY_MS = 10_000;
const FRAME_MS = 200;

function readSave(): string | null {
  try {
    return localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
}

const startedAt = Date.now();
const state = deserialize(readSave(), startedAt);

function save(): void {
  try {
    localStorage.setItem(SAVE_KEY, serialize(state));
  } catch {
    // storage can be full or blocked; the game keeps running without saving
  }
}

const root = document.getElementById("app");
if (!root) throw new Error("missing #app");

if (import.meta.env.DEV) {
  // Developer shortcut for looking at deep content: ?depth=31
  const requested = Number(new URLSearchParams(location.search).get("depth"));
  if (requested > 0) {
    state.depth = requested;
    state.maxDepth = requested;
    state.bestDepth = requested;
    for (const hero of state.heroes) hero.level = Math.round(requested * 1.3);
  }
  const wave = Number(new URLSearchParams(location.search).get("wave"));
  if (wave > 0) startBattle(state, "stage", wave);
}

ensureQuests(state, startedAt);
updateKeys(state, startedAt);
const settings = loadSettings();
const app = createApp(root, state, save, new Sound(settings), settings);

function step(): void {
  const now = Date.now();
  const report = advance(state, now);
  if (report && report.seconds > OFFLINE_THRESHOLD_SECONDS) app.showOffline(report);
  app.update(now);
}

step();
setInterval(step, FRAME_MS);
setInterval(save, SAVE_EVERY_MS);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) save();
  else step();
});
window.addEventListener("pagehide", save);

if (import.meta.env.PROD && "serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => undefined);
}
