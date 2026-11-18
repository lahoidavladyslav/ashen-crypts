import { RARITIES } from "../engine/config";
import { formatNumber } from "../engine/format";
import type { EquipResult } from "../engine/loot";
import { classOf, itemPower } from "../engine/stats";
import type { GameState } from "../engine/state";
import { h } from "./dom";
import { icon } from "./icons";

const RARITY_COLOR: Record<string, string> = {
  common: "#b9b2c0",
  uncommon: "#5fd08a",
  rare: "#5aa7ff",
  epic: "#b46bff",
  legendary: "#ffa73a",
};

/** A short chest-opening moment: the chest shakes, then the item is revealed. */
export function showLoot(state: GameState, result: EquipResult, onDone: () => void): void {
  const rarity = RARITIES.find((entry) => entry.id === result.item.rarity);
  const color = RARITY_COLOR[result.item.rarity] ?? "#ffffff";
  const hero = result.heroIndex === null ? undefined : state.heroes[result.heroIndex];
  const stage = h("div", { class: "chest-stage" }, icon("chest", 84));
  stage.classList.add("shake");

  const close = (): void => {
    overlay.remove();
    onDone();
  };
  const box = h("div", { class: "box loot" }, h("div", { class: "sub", text: "A chest from the crypt" }), stage);
  const overlay = h("div", { class: "modal" }, box);
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay && box.classList.contains("revealed")) close();
  });
  document.body.append(overlay);

  setTimeout(() => {
    stage.classList.remove("shake");
    box.classList.add("revealed");
    box.style.setProperty("--rarity", color);
    const power = formatNumber(itemPower(result.item));
    const where = result.equipped && hero ? `Equipped by ${classOf(hero.classId).name}` : `Too weak, salvaged for ${result.essence} essence`;
    box.replaceChildren(
      h("div", { class: "rarity-name", text: rarity?.name ?? "Item", style: `color:${color}` }),
      h("div", { class: "loot-icon", style: `color:${color}` }, icon(result.item.slot, 64)),
      h("div", { class: "title", text: `${result.item.slot[0]?.toUpperCase()}${result.item.slot.slice(1)}, level ${result.item.ilvl}` }),
      h("div", { class: "sub", text: `Power ${power}` }),
      h("div", { class: "sub", text: where, style: result.equipped ? "color:#5fd08a" : "" }),
      h("div", { style: "height:12px" }),
      h("button", { class: "primary", text: "Continue", onclick: close }),
    );
  }, 750);
}
