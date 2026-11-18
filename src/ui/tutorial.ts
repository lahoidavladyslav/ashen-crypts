import { h } from "./dom";
import { icon } from "./icons";

const STEPS: readonly { icon: string; title: string; text: string }[] = [
  {
    icon: "battle",
    title: "Your heroes fight alone",
    text: "A knight, a pyromancer and a cleric descend into the crypt. They keep fighting while you are away.",
  },
  {
    icon: "party",
    title: "Make them stronger",
    text: "Spend the gold you earn on the Party tab. Gear drops from monsters and bosses and is equipped for you.",
  },
  {
    icon: "chest",
    title: "Open chests, claim rewards",
    text: "Every boss leaves a chest. Come back each day for your reward and the crypt trials. Stuck on a boss? Level up, or use Battle Cry.",
  },
];

export function showTutorial(onDone: () => void): void {
  let index = 0;
  const overlay = h("div", { class: "modal" });
  const render = (): void => {
    const step = STEPS[index];
    if (!step) return;
    const last = index === STEPS.length - 1;
    const dots = h(
      "div",
      { class: "steps" },
      ...STEPS.map((_, i) => h("span", { class: `step-dot ${i === index ? "on" : ""}` })),
    );
    overlay.replaceChildren(
      h(
        "div",
        { class: "box tutorial" },
        h("div", { class: "tutorial-icon" }, icon(step.icon, 44)),
        h("h2", { text: step.title }),
        h("div", { class: "sub", text: step.text }),
        dots,
        h("button", {
          class: "primary",
          text: last ? "Enter the crypt" : "Next",
          onclick: () => {
            if (last) {
              overlay.remove();
              onDone();
            } else {
              index += 1;
              render();
            }
          },
        }),
      ),
    );
  };
  render();
  document.body.append(overlay);
}
