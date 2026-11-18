import { formatNumber } from "../engine/format";
import type { Battle, BattleEvent, GameState } from "../engine/state";
import { TRAITS, type Trait } from "../engine/config";
import { GROUND_Y, TORCH_POSITIONS, biomeFor, paintBackground, type Biome } from "./biomes";
import { drawSprite } from "./sprites";

export const SCENE_W = 360;
export const SCENE_H = 290;

const HERO_SLOTS: readonly [number, number][] = [
  [128, 204],
  [86, 172],
  [86, 238],
  [44, 204],
  [44, 262],
];
const ENEMY_SLOTS: readonly [number, number][] = [
  [236, 204],
  [288, 172],
  [288, 238],
  [334, 204],
];
const ADD_SLOTS: readonly [number, number][] = [
  [214, 172],
  [214, 240],
  [340, 178],
  [340, 238],
];
const BOSS_POS: readonly [number, number] = [282, 214];

interface Visual {
  id: number;
  kind: string;
  side: "hero" | "enemy";
  boss: boolean;
  trait: Trait | null;
  name: string;
  x: number;
  y: number;
  hp: number;
  hpShown: number;
  skill: number;
  lunge: number;
  flash: number;
  cast: number;
  dead: boolean;
  deathT: number;
  shield: boolean;
  appear: number;
  phase: number;
}

type ParticleKind = "dot" | "spark" | "plus" | "coin" | "ring" | "slash";

interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  gravity: number;
  rotation: number;
}

interface FloatText {
  x: number;
  y: number;
  life: number;
  max: number;
  text: string;
  color: string;
  size: number;
}

interface Banner {
  text: string;
  color: string;
  life: number;
  max: number;
  big: boolean;
}

export class Scene {
  private readonly ctx: CanvasRenderingContext2D | null;
  private readonly visuals = new Map<number, Visual>();
  private readonly particles: Particle[] = [];
  private readonly floats: FloatText[] = [];
  private banner: Banner | null = null;
  private background: HTMLCanvasElement | null = null;
  private backgroundKey = "";
  private biome: Biome = biomeFor(1);
  private depth = 1;
  private bossVisual: Visual | null = null;
  private shake = 0;
  private redFlash = 0;
  private rally = false;
  private clock = 0;
  private last = 0;
  private scale = 1;
  private scratch: HTMLCanvasElement | null = null;
  private running = false;
  private trial = false;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d");
    this.resize();
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => this.resize()).observe(canvas);
    }
  }

  start(): void {
    if (this.running || !this.ctx) return;
    this.running = true;
    const loop = (time: number): void => {
      const dt = this.last === 0 ? 0 : Math.min(0.05, (time - this.last) / 1000);
      this.last = time;
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  private resize(): void {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, this.canvas.clientWidth || SCENE_W);
    this.canvas.width = Math.round(width * ratio);
    this.canvas.height = Math.round((width * SCENE_H * ratio) / SCENE_W);
    this.scale = this.canvas.width / SCENE_W;
    this.backgroundKey = "";
  }

  update(state: GameState, now: number): void {
    const battle = state.battle;
    if (!battle) return;
    this.rally = now < state.rally.until;
    this.trial = battle.kind === "trial";
    this.depth = battle.depth;
    this.sync(battle);
    for (const event of battle.events.splice(0)) this.handle(event);
    for (const [id, visual] of this.visuals) {
      const live = visual.side === "hero" ? battle.heroes.some((f) => f.id === id) : battle.enemies.some((f) => f.id === id);
      if (!live && !visual.dead) this.visuals.delete(id);
    }
  }

  private findSlot(taken: Set<string>, slots: readonly [number, number][]): [number, number] {
    return slots.find(([x, y]) => !taken.has(`${x},${y}`)) ?? slots[0]!;
  }

  private sync(battle: Battle): void {
    const taken = new Set<string>();
    for (const visual of this.visuals.values()) {
      if (visual.side === "enemy" && !visual.dead) taken.add(`${visual.x},${visual.y}`);
    }
    battle.heroes.forEach((fighter, index) => {
      let visual = this.visuals.get(fighter.id);
      if (!visual) {
        const [x, y] = HERO_SLOTS[index] ?? HERO_SLOTS[0]!;
        visual = this.createVisual(fighter.id, fighter.kind, "hero", x, y, fighter.name, false, null);
        this.visuals.set(fighter.id, visual);
      }
      visual.hp = Math.max(0, fighter.hp / fighter.maxHp);
      visual.shield = fighter.shieldUntil > battle.clock;
      const def = fighter.skillCd;
      visual.skill = def;
      if (fighter.hp <= 0 && !visual.dead) visual.dead = true;
      if (fighter.hp > 0 && visual.dead) visual.dead = false;
    });
    const hasBoss = battle.enemies.some((f) => f.boss) || [...this.visuals.values()].some((v) => v.boss && !v.dead);
    for (const fighter of battle.enemies) {
      let visual = this.visuals.get(fighter.id);
      if (!visual) {
        let position: [number, number];
        if (fighter.boss) position = [...BOSS_POS];
        else position = this.findSlot(taken, hasBoss ? ADD_SLOTS : ENEMY_SLOTS);
        taken.add(`${position[0]},${position[1]}`);
        visual = this.createVisual(fighter.id, fighter.kind, "enemy", position[0], position[1], fighter.name, fighter.boss, fighter.trait);
        this.visuals.set(fighter.id, visual);
      }
      visual.hp = Math.max(0, fighter.hp / fighter.maxHp);
      if (fighter.boss) this.bossVisual = visual;
    }
  }

  private createVisual(id: number, kind: string, side: "hero" | "enemy", x: number, y: number, name: string, boss: boolean, trait: Trait | null): Visual {
    return {
      id, kind, side, boss, trait, name, x, y,
      hp: 1, hpShown: 1, skill: 0, lunge: 0, flash: 0, cast: 0,
      dead: false, deathT: 0, shield: false, appear: 0, phase: Math.random() * 6,
    };
  }

  private handle(event: BattleEvent): void {
    switch (event.type) {
      case "hit": {
        const from = this.visuals.get(event.from);
        const to = this.visuals.get(event.to);
        if (from) from.lunge = 1;
        if (!to) return;
        to.flash = 1;
        const high = to.y - 70 * (to.boss ? 1.6 : 1);
        const hero = to.side === "hero";
        if (event.crit || hero || this.floats.length < 10) {
          this.addFloat(to.x + (Math.random() - 0.5) * 18, high, formatNumber(event.amount), hero ? "#ff7b7b" : event.crit ? "#ffd24a" : "#ffffff", event.crit ? 14 : 10);
        }
        this.hitEffect(from, to, event);
        break;
      }
      case "heal": {
        const to = this.visuals.get(event.to);
        if (!to) return;
        this.addFloat(to.x, to.y - 72, `+${formatNumber(event.amount)}`, "#6ee09a", 12);
        for (let i = 0; i < 4; i++) this.spawn("plus", to.x + (Math.random() - 0.5) * 24, to.y - 20 - Math.random() * 30, (Math.random() - 0.5) * 10, -18 - Math.random() * 14, 0.9, 4, "#6ee09a", 0);
        break;
      }
      case "skill": {
        const from = this.visuals.get(event.from);
        if (!from) return;
        from.cast = 1;
        const color = { fireball: "#ff8a3a", prayer: "#ffe9a0", shieldWall: "#6ab4ff", backstab: "#c08cff", drain: "#9d4dff" }[event.skill] ?? "#ffffff";
        this.spawn("ring", from.x, from.y - 20, 0, 0, 0.6, 8, color, 0);
        break;
      }
      case "death": {
        const visual = this.visuals.get(event.id);
        if (!visual) return;
        visual.dead = true;
        visual.deathT = 0;
        const power = event.boss ? 22 : 8;
        for (let i = 0; i < power; i++) {
          this.spawn("dot", visual.x, visual.y - 26, (Math.random() - 0.5) * 70, -Math.random() * 60, 0.8 + Math.random() * 0.5, 2 + Math.random() * 2, visual.side === "hero" ? "#aab4c8" : "#d8d2bd", 90);
        }
        if (visual.side === "enemy") this.coins(visual.x, visual.y - 30, event.boss ? 14 : 2);
        if (event.boss) this.shake = 9;
        break;
      }
      case "summon": {
        const visual = this.visuals.get(event.id);
        if (visual) this.spawn("ring", visual.x, visual.y - 20, 0, 0, 0.7, 10, "#b36bff", 0);
        break;
      }
      case "wave":
        this.setBanner(event.boss ? "BOSS" : `Wave ${event.wave}`, event.boss ? "#ff5a4a" : "#e9e2f5", event.boss ? 1.6 : 0.7, event.boss);
        if (event.boss) this.shake = 5;
        break;
      case "wipe":
        this.redFlash = 1;
        this.setBanner("DEFEAT", "#ff5a4a", 1.8);
        break;
      case "clear":
        this.setBanner("DEPTH CLEARED", "#ffd24a", 1.8);
        this.coins(SCENE_W / 2, 20, 26);
        break;
    }
  }

  private hitEffect(from: Visual | undefined, to: Visual, event: Extract<BattleEvent, { type: "hit" }>): void {
    const x = to.x;
    const y = to.y - 30 * (to.boss ? 1.6 : 1);
    if (event.skill === "fireball") {
      for (let i = 0; i < 12; i++) this.spawn("dot", x, y, (Math.random() - 0.5) * 80, -Math.random() * 70, 0.5 + Math.random() * 0.3, 3 + Math.random() * 3, i % 2 ? "#ffb04a" : "#ff5a2a", -30);
      return;
    }
    if (event.skill === "drain" && from) {
      for (let i = 0; i < 8; i++) {
        const t = i / 8;
        this.spawn("dot", x + (from.x - x) * t, y + (from.y - 30 - y) * t, (from.x - x) * 1.6, (from.y - 30 - y) * 1.6, 0.5, 3, "#b36bff", 0);
      }
      return;
    }
    const direction = to.side === "enemy" ? 1 : -1;
    const color = event.skill === "backstab" ? "#d6a8ff" : event.crit ? "#ffd24a" : "#ffffff";
    this.spawn("slash", x, y, direction * 160, 0, 0.16, event.crit || event.skill ? 15 : 8, color, 0);
    const sparks = event.crit ? 9 : 4;
    for (let i = 0; i < sparks; i++) this.spawn("spark", x, y, (Math.random() - 0.5) * 120, (Math.random() - 0.7) * 90, 0.3 + Math.random() * 0.2, 2, color, 160);
  }

  private coins(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      this.spawn("coin", x + (Math.random() - 0.5) * 20, y, (Math.random() - 0.5) * 60, -50 - Math.random() * 50, 1.1 + Math.random() * 0.4, 3.2, "#f0b84a", 160);
    }
  }

  private spawn(kind: ParticleKind, x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, gravity: number): void {
    if (this.particles.length > 300) this.particles.shift();
    this.particles.push({ kind, x, y, vx, vy, life, max: life, size, color, gravity, rotation: Math.random() * Math.PI * 2 });
  }

  private addFloat(x: number, y: number, text: string, color: string, size: number): void {
    if (this.floats.length > 40) this.floats.shift();
    this.floats.push({ x, y, life: 0.9, max: 0.9, text, color, size });
  }

  private setBanner(text: string, color: string, seconds: number, big = true): void {
    this.banner = { text, color, life: seconds, max: seconds, big };
  }

  private frame(dt: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.clock += dt;
    this.step(dt);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.scale(this.scale, this.scale);
    if (this.shake > 0.1) ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    this.drawBackground(ctx);
    this.drawUnits(ctx);
    this.drawParticles(ctx);
    this.drawFloats(ctx);
    this.drawHud(ctx);
    ctx.restore();
  }

  private step(dt: number): void {
    this.shake = Math.max(0, this.shake - dt * 22);
    this.redFlash = Math.max(0, this.redFlash - dt * 1.6);
    if (this.banner) {
      this.banner.life -= dt;
      if (this.banner.life <= 0) this.banner = null;
    }
    for (const [id, v] of this.visuals) {
      v.lunge = Math.max(0, v.lunge - dt * 4.5);
      v.flash = Math.max(0, v.flash - dt * 5);
      v.cast = Math.max(0, v.cast - dt * 1.6);
      v.appear = Math.min(1, v.appear + dt * 4);
      v.hpShown += (v.hp - v.hpShown) * Math.min(1, dt * 8);
      if (v.dead && v.side === "enemy") {
        v.deathT += dt;
        if (v.deathT > 0.7) {
          this.visuals.delete(id);
          if (this.bossVisual === v) this.bossVisual = null;
        }
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      if (p.kind === "coin" && p.life < p.max * 0.55) {
        p.vx += (14 - p.x) * dt * 6;
        p.vy += (6 - p.y) * dt * 6;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i]!;
      f.life -= dt;
      f.y -= dt * 22;
      if (f.life <= 0) this.floats.splice(i, 1);
    }
  }

  private ensureBackground(): void {
    const biome = this.trial ? biomeFor(41) : biomeFor(this.depth);
    const key = `${biome.name}|${this.canvas.width}`;
    if (key === this.backgroundKey && this.background) return;
    this.backgroundKey = key;
    this.biome = biome;
    const canvas = this.background ?? document.createElement("canvas");
    canvas.width = SCENE_W * 2;
    canvas.height = SCENE_H * 2;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(2, 0, 0, 2, 0, 0);
    paintBackground(context, SCENE_W, SCENE_H, biome, biome.name.length * 977);
    this.background = canvas;
  }

  private drawBackground(ctx: CanvasRenderingContext2D): void {
    this.ensureBackground();
    if (this.background) ctx.drawImage(this.background, 0, 0, SCENE_W, SCENE_H);
    const biome = this.biome;
    for (const [x, y] of TORCH_POSITIONS) {
      const flicker = 1 + Math.sin(this.clock * 9 + x) * 0.08 + Math.sin(this.clock * 23 + x * 3) * 0.05;
      const glow = ctx.createRadialGradient(x, y, 0, x, y, 70 * flicker);
      glow.addColorStop(0, `${biome.torch}66`);
      glow.addColorStop(1, `${biome.torch}00`);
      ctx.fillStyle = glow;
      ctx.fillRect(x - 80, y - 80, 160, 160);
      ctx.fillStyle = "#2a1c12";
      ctx.fillRect(x - 2, y + 4, 4, 16);
      ctx.fillStyle = biome.torch;
      ctx.beginPath();
      ctx.moveTo(x - 5, y + 4);
      ctx.quadraticCurveTo(x - 6, y - 8 * flicker, x, y - 16 * flicker);
      ctx.quadraticCurveTo(x + 6, y - 8 * flicker, x + 5, y + 4);
      ctx.fill();
      ctx.fillStyle = "#fff3c4";
      ctx.beginPath();
      ctx.ellipse(x, y, 2.4, 5 * flicker, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let band = 0; band < 3; band++) {
      const offset = ((this.clock * (6 + band * 4) + band * 90) % (SCENE_W + 160)) - 160;
      const fog = ctx.createLinearGradient(offset, 0, offset + 160, 0);
      fog.addColorStop(0, `rgba(${biome.fog},0)`);
      fog.addColorStop(0.5, `rgba(${biome.fog},0.09)`);
      fog.addColorStop(1, `rgba(${biome.fog},0)`);
      ctx.fillStyle = fog;
      ctx.fillRect(offset, GROUND_Y - 30 + band * 22, 160, 50);
    }
    if (this.rally) {
      const pulse = 0.12 + Math.sin(this.clock * 8) * 0.04;
      ctx.fillStyle = `rgba(255,200,80,${pulse})`;
      ctx.fillRect(0, GROUND_Y, SCENE_W / 2, SCENE_H - GROUND_Y);
    }
  }

  private drawUnits(ctx: CanvasRenderingContext2D): void {
    const ordered = [...this.visuals.values()].sort((a, b) => a.y - b.y);
    for (const v of ordered) this.drawUnit(ctx, v);
  }

  private drawUnit(ctx: CanvasRenderingContext2D, v: Visual): void {
    const scale = v.boss ? 1.6 : 1;
    const dir = v.side === "hero" ? 1 : -1;
    const alpha = v.dead ? (v.side === "enemy" ? Math.max(0, 1 - Math.max(0, v.deathT - 0.25) / 0.45) : 0.4) : Math.min(1, v.appear * 1.4);
    if (alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    const lungeOffset = Math.sin(Math.min(1, v.lunge) * Math.PI) * 16 * dir;
    const knockback = -dir * v.flash * 5;
    ctx.translate(v.x + lungeOffset + knockback, v.y);

    if (v.boss && v.trait) this.drawAura(ctx, v.trait);
    if (v.shield) {
      ctx.fillStyle = "rgba(106,180,255,0.22)";
      ctx.strokeStyle = "rgba(160,210,255,0.8)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, -30, 28, 38, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    if (this.rally && v.side === "hero" && !v.dead) {
      ctx.strokeStyle = `rgba(255,210,90,${0.5 + Math.sin(this.clock * 8) * 0.2})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(0, 2, 22, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.scale(dir * scale, scale);
    const pose = { t: this.clock + v.phase, lunge: Math.sin(Math.min(1, v.lunge) * Math.PI), flash: v.flash, cast: v.cast };
    if (v.dead) ctx.rotate(-Math.min(1, v.side === "enemy" ? v.deathT / 0.3 : 1) * 1.35);
    if (pose.flash > 0.02) this.drawFlashed(ctx, v.kind, pose);
    else drawSprite(ctx, v.kind, pose);
    ctx.restore();

    if (!v.dead) this.drawBars(ctx, v, scale);
  }

  private drawFlashed(ctx: CanvasRenderingContext2D, kind: string, pose: { t: number; lunge: number; flash: number; cast: number }): void {
    if (!this.scratch) {
      this.scratch = document.createElement("canvas");
      this.scratch.width = 160;
      this.scratch.height = 160;
    }
    const buffer = this.scratch.getContext("2d");
    if (!buffer) {
      drawSprite(ctx, kind, pose);
      return;
    }
    buffer.setTransform(1, 0, 0, 1, 0, 0);
    buffer.clearRect(0, 0, 160, 160);
    buffer.translate(80, 130);
    drawSprite(buffer, kind, pose);
    buffer.globalCompositeOperation = "source-atop";
    buffer.setTransform(1, 0, 0, 1, 0, 0);
    buffer.fillStyle = `rgba(255,255,255,${pose.flash * 0.75})`;
    buffer.fillRect(0, 0, 160, 160);
    buffer.globalCompositeOperation = "source-over";
    ctx.drawImage(this.scratch, -80, -130);
  }

  private drawAura(ctx: CanvasRenderingContext2D, trait: Trait): void {
    const pulse = 0.5 + Math.sin(this.clock * 4) * 0.2;
    const color = { armored: "180,200,230", regen: "90,220,130", enrage: "255,70,50", summoner: "180,100,255", thick: "255,190,80" }[trait];
    const gradient = ctx.createRadialGradient(0, -40, 4, 0, -40, 58);
    gradient.addColorStop(0, `rgba(${color},${0.35 * pulse + 0.1})`);
    gradient.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, -40, 58, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawBars(ctx: CanvasRenderingContext2D, v: Visual, scale: number): void {
    if (v.boss) return;
    const width = 34;
    const x = v.x - width / 2;
    const y = v.y - 72 * scale;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(x - 1, y - 1, width + 2, 6);
    ctx.fillStyle = v.side === "hero" ? "#4fd486" : "#d84a4a";
    ctx.fillRect(x, y, width * Math.max(0, Math.min(1, v.hpShown)), 4);
    if (v.side === "hero") {
      const cooldown = 1 - Math.max(0, Math.min(1, v.skill / 16));
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(v.x - 13, v.y + 6, 26, 3);
      ctx.fillStyle = v.skill <= 0 ? "#ffe08a" : "#5aa7ff";
      ctx.fillRect(v.x - 13, v.y + 6, 26 * cooldown, 3);
    }
  }

  private drawParticles(ctx: CanvasRenderingContext2D): void {
    for (const p of this.particles) {
      const fade = Math.max(0, p.life / p.max);
      ctx.globalAlpha = Math.min(1, fade * 1.6);
      if (p.kind === "ring") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size + (1 - fade) * 46, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.kind === "slash") {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3 * fade + 1;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(p.x - p.size, p.y - p.size * 0.7);
        ctx.lineTo(p.x + p.size, p.y + p.size * 0.7);
        ctx.stroke();
      } else if (p.kind === "plus") {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - 0.7, p.size, 1.4);
        ctx.fillRect(p.x - 0.7, p.y - p.size / 2, 1.4, p.size);
      } else if (p.kind === "coin") {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.size, p.size * Math.abs(Math.cos(this.clock * 8 + p.rotation)), 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (p.kind === "spark" ? fade : 1), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawFloats(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = "center";
    for (const f of this.floats) {
      const pop = f.max - f.life < 0.1 ? 1 + (0.1 - (f.max - f.life)) * 4 : 1;
      ctx.globalAlpha = Math.min(1, f.life * 2.4);
      ctx.font = `800 ${f.size * pop}px -apple-system, "Segoe UI", sans-serif`;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }

  private drawHud(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = "left";
    ctx.font = "700 10px -apple-system, 'Segoe UI', sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillText(this.trial ? "CRYPT TRIAL" : this.biome.name.toUpperCase(), 10, 16);

    const boss = this.bossVisual;
    if (boss && !boss.dead) {
      const width = 200;
      const x = (SCENE_W - width) / 2;
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillRect(x - 2, 26, width + 4, 12);
      ctx.fillStyle = "#c9302c";
      ctx.fillRect(x, 28, width * Math.max(0, Math.min(1, boss.hpShown)), 8);
      ctx.textAlign = "center";
      ctx.fillStyle = "#fff";
      ctx.font = "800 11px -apple-system, 'Segoe UI', sans-serif";
      const trait = boss.trait ? ` - ${TRAITS[boss.trait].name}` : "";
      ctx.fillText(`${boss.name}${trait}`, SCENE_W / 2, 50);
    }

    if (this.banner) {
      const b = this.banner;
      const t = b.life / b.max;
      const grow = t > 0.85 ? 1 + (t - 0.85) * 3 : 1;
      ctx.globalAlpha = Math.min(1, t * 3);
      ctx.textAlign = "center";
      ctx.font = `900 ${(b.big ? 30 : 16) * grow}px Georgia, serif`;
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(0,0,0,0.8)";
      ctx.strokeText(b.text, SCENE_W / 2, 108);
      ctx.fillStyle = b.color;
      ctx.fillText(b.text, SCENE_W / 2, 108);
      ctx.globalAlpha = 1;
    }
    if (this.redFlash > 0.01) {
      const vignette = ctx.createRadialGradient(SCENE_W / 2, SCENE_H / 2, 60, SCENE_W / 2, SCENE_H / 2, 220);
      vignette.addColorStop(0, "rgba(180,0,0,0)");
      vignette.addColorStop(1, `rgba(180,0,0,${this.redFlash * 0.55})`);
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, SCENE_W, SCENE_H);
    }
  }
}
