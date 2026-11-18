export interface Biome {
  name: string;
  skyTop: string;
  skyBottom: string;
  floor: string;
  floorLine: string;
  accent: string;
  torch: string;
  fog: string;
}

export const BIOMES: readonly Biome[] = [
  { name: "The Crypt", skyTop: "#0c0918", skyBottom: "#2a1a44", floor: "#1d1530", floorLine: "#3a2a58", accent: "#8a6bd6", torch: "#ffb86b", fog: "150,120,220" },
  { name: "The Catacombs", skyTop: "#120a06", skyBottom: "#3d2314", floor: "#2c1b10", floorLine: "#54361f", accent: "#d8a15a", torch: "#ff9a3c", fog: "200,140,80" },
  { name: "Ember Halls", skyTop: "#190606", skyBottom: "#54160f", floor: "#2e100c", floorLine: "#5e2218", accent: "#ff6a3a", torch: "#ff7a2a", fog: "255,100,60" },
  { name: "Frost Vault", skyTop: "#06111a", skyBottom: "#173c52", floor: "#10283a", floorLine: "#24506b", accent: "#7fd8ff", torch: "#9fe8ff", fog: "140,210,255" },
  { name: "The Void", skyTop: "#040212", skyBottom: "#1d0c40", floor: "#0f0822", floorLine: "#2a1450", accent: "#c06bff", torch: "#d58cff", fog: "170,100,255" },
];

export function biomeFor(depth: number): Biome {
  const index = Math.floor((Math.max(1, depth) - 1) / 10) % BIOMES.length;
  return BIOMES[index] ?? BIOMES[0]!;
}

export const GROUND_Y = 150;

/** Deterministic pseudo random so the background looks the same every time. */
function rand(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

/** Static part of the background, drawn once per biome into a cache canvas. */
export function paintBackground(ctx: CanvasRenderingContext2D, width: number, height: number, biome: Biome, seed: number): void {
  const random = rand(seed);
  const sky = ctx.createLinearGradient(0, 0, 0, GROUND_Y + 30);
  sky.addColorStop(0, biome.skyTop);
  sky.addColorStop(1, biome.skyBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  for (let i = 0; i < 26; i++) {
    ctx.globalAlpha = 0.15 + random() * 0.5;
    ctx.fillRect(random() * width, random() * (GROUND_Y - 60), 1.2, 1.2);
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = "rgba(0,0,0,0.38)";
  for (let layer = 0; layer < 2; layer++) {
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y + 20);
    let x = 0;
    while (x < width + 40) {
      const peak = 40 + random() * 55 + layer * 18;
      const span = 34 + random() * 40;
      ctx.lineTo(x + span * 0.5, GROUND_Y - peak + layer * 25);
      ctx.lineTo(x + span, GROUND_Y + 20);
      x += span;
    }
    ctx.closePath();
    ctx.fill();
  }

  const archWidth = 76;
  for (let x = -20; x < width + archWidth; x += archWidth) {
    ctx.fillStyle = "rgba(6,4,12,0.78)";
    ctx.fillRect(x, 20, 14, GROUND_Y);
    ctx.beginPath();
    ctx.moveTo(x + 14, 62);
    ctx.quadraticCurveTo(x + archWidth * 0.5, 4, x + archWidth, 62);
    ctx.lineTo(x + archWidth, 32);
    ctx.quadraticCurveTo(x + archWidth * 0.5, -30, x + 14, 32);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = `${biome.accent}22`;
    ctx.beginPath();
    ctx.moveTo(x + 22, GROUND_Y);
    ctx.lineTo(x + 22, 78);
    ctx.quadraticCurveTo(x + archWidth * 0.5, 20, x + archWidth - 8, 78);
    ctx.lineTo(x + archWidth - 8, GROUND_Y);
    ctx.closePath();
    ctx.fill();
  }

  const floor = ctx.createLinearGradient(0, GROUND_Y, 0, height);
  floor.addColorStop(0, biome.floor);
  floor.addColorStop(1, "#060409");
  ctx.fillStyle = floor;
  ctx.fillRect(0, GROUND_Y, width, height - GROUND_Y);

  ctx.strokeStyle = biome.floorLine;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  for (let i = 1; i < 7; i++) {
    const y = GROUND_Y + Math.pow(i / 7, 1.7) * (height - GROUND_Y);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  for (let i = -6; i <= 6; i++) {
    ctx.beginPath();
    ctx.moveTo(width / 2 + i * 22, GROUND_Y);
    ctx.lineTo(width / 2 + i * 70, height);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  for (let i = 0; i < 9; i++) {
    const x = random() * width;
    const y = GROUND_Y + 14 + random() * (height - GROUND_Y - 20);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(x, y, 9, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(220,210,185,0.55)";
    if (random() < 0.5) {
      ctx.fillRect(x - 3, y - 7, 6, 8);
      ctx.beginPath();
      ctx.arc(x, y - 7, 3, Math.PI, 0);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(x, y - 3, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export const TORCH_POSITIONS: readonly [number, number][] = [
  [58, 104],
  [180, 104],
  [302, 104],
];
