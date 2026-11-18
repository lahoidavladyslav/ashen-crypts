import { drawSprite } from "./ui/sprites";

const HEROES = ["knight", "pyromancer", "cleric", "rogue", "warlock"];
const ENEMIES = ["skeleton", "ghoul", "cultist", "wraith", "boneknight", "plaguerat", "shade", "giantspider", "imp", "stonegolem"];
const BOSSES = ["boss_armored", "boss_regen", "boss_enrage", "boss_summoner", "boss_thick"];

/** Developer page: every sprite on one canvas. Open the dev server with ?gallery. */
export function showGallery(root: HTMLElement): void {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 620;
  canvas.style.width = "100%";
  canvas.style.background = "#1b1428";
  root.replaceChildren(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const rows: [string[], number, number][] = [
    [HEROES, 110, 1.3],
    [ENEMIES, 250, 1.1],
    [BOSSES, 470, 1.7],
  ];
  const loop = (ms: number): void => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1b1428";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const [list, baseline, scale] of rows) {
      list.forEach((kind, i) => {
        const x = 70 + (i * (canvas.width - 100)) / Math.max(list.length - 1, 1) * (list.length > 5 ? 1 : 0.62);
        ctx.save();
        ctx.translate(x, baseline);
        ctx.scale(scale, scale);
        drawSprite(ctx, kind, { t: ms / 1000 + i, lunge: 0, flash: 0, cast: 0 });
        ctx.restore();
        ctx.fillStyle = "#9a88a6";
        ctx.font = "11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(kind, x, baseline + 18);
      });
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
