import { describe, expect, it } from "vitest";
import { newState } from "../src/engine/state";
import { exportSave, parseSave, replaceState } from "../src/save";

const T0 = new Date(2026, 0, 10, 12, 0, 0).getTime();

describe("save export", () => {
  it("round-trips a game, including non-ASCII data", () => {
    const state = newState(T0, 1);
    state.gold = 12345;
    state.depth = 17;
    state.log = ["epic|epic weapon, level 17: equipped by Лицар"];
    const copy = parseSave(exportSave(state));
    expect(copy).not.toBeNull();
    expect(copy!.gold).toBe(12345);
    expect(copy!.depth).toBe(17);
    expect(copy!.log[0]).toContain("Лицар");
  });

  it("ignores surrounding whitespace", () => {
    expect(parseSave(`  ${exportSave(newState(T0))}\n`)).not.toBeNull();
  });

  it.each(["", "not base64!!", btoa("{"), btoa("[]"), btoa('{"version":999}'), btoa('{"version":1,"heroes":[]}')])(
    "rejects damaged or foreign codes (%#)",
    (code) => {
      expect(parseSave(code)).toBeNull();
    },
  );

  it("importing replaces the live state in place and drops the battle", () => {
    const live = newState(T0, 1);
    live.gold = 1;
    const imported = newState(T0, 2);
    imported.gold = 999;
    replaceState(live, imported, newState(T0));
    expect(live.gold).toBe(999);
    expect(live.battle).toBeNull();
  });

  it("fills in fields that older saves do not have", () => {
    const old = JSON.parse(JSON.stringify(newState(T0, 1)));
    delete old.achievements;
    delete old.newAchievements;
    const parsed = parseSave(btoa(JSON.stringify(old)))!;
    const live = newState(T0, 1);
    replaceState(live, parsed, newState(T0));
    expect(live.achievements).toEqual([]);
  });
});
