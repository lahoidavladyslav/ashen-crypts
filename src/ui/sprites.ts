/**
 * Vector characters drawn with canvas paths. Every sprite is drawn with its feet at (0, 0),
 * facing right, about 64 units tall. The caller flips and scales it.
 */

export interface Pose {
  t: number;
  /** 0..1, how far into a lunge the character is */
  lunge: number;
  /** 0..1, white flash after being hit */
  flash: number;
  /** 0..1, glow while casting a skill */
  cast: number;
}

type Ctx = CanvasRenderingContext2D;

function shadow(ctx: Ctx, width: number): void {
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(0, 1, width, width * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function glow(ctx: Ctx, x: number, y: number, radius: number, color: string, alpha: number): void {
  const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
  gradient.addColorStop(0, color);
  gradient.addColorStop(1, "rgba(0,0,0,0)");
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function eyes(ctx: Ctx, x: number, y: number, gap: number, color: string, size = 1.6): void {
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  ctx.arc(x - gap, y, size, 0, Math.PI * 2);
  ctx.arc(x + gap, y, size, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function bob(pose: Pose, speed = 3, amount = 1.6): number {
  return Math.sin(pose.t * speed) * amount;
}

function armSwing(pose: Pose): number {
  return -pose.lunge * 0.9;
}

function knight(ctx: Ctx, pose: Pose): void {
  shadow(ctx, 18);
  const y = bob(pose);
  ctx.save();
  ctx.translate(0, y);
  ctx.fillStyle = "#3b4352";
  roundRect(ctx, -9, -16, 7, 16, 2);
  ctx.fill();
  roundRect(ctx, 2, -16, 7, 16, 2);
  ctx.fill();
  const body = ctx.createLinearGradient(-13, -46, 13, -16);
  body.addColorStop(0, "#c7ceda");
  body.addColorStop(1, "#6d7787");
  ctx.fillStyle = body;
  roundRect(ctx, -13, -44, 26, 30, 6);
  ctx.fill();
  ctx.fillStyle = "#a82a2a";
  roundRect(ctx, -3, -44, 6, 30, 2);
  ctx.fill();
  const helmet = ctx.createLinearGradient(-9, -62, 9, -44);
  helmet.addColorStop(0, "#e3e8f0");
  helmet.addColorStop(1, "#7f8998");
  ctx.fillStyle = helmet;
  ctx.beginPath();
  ctx.arc(0, -52, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#14171d";
  roundRect(ctx, -1, -55, 11, 4, 1.5);
  ctx.fill();
  ctx.fillStyle = "#c43030";
  ctx.beginPath();
  ctx.moveTo(-4, -61);
  ctx.quadraticCurveTo(-18, -66 + Math.sin(pose.t * 5) * 2, -16, -50);
  ctx.quadraticCurveTo(-9, -56, -4, -61);
  ctx.fill();
  ctx.save();
  ctx.translate(14, -30);
  ctx.rotate(armSwing(pose) * 0.5);
  ctx.fillStyle = "#2f5da8";
  ctx.beginPath();
  ctx.moveTo(-2, -12);
  ctx.lineTo(12, -12);
  ctx.lineTo(12, 2);
  ctx.quadraticCurveTo(12, 14, 5, 18);
  ctx.quadraticCurveTo(-2, 14, -2, 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#e8c15a";
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = "#e8c15a";
  ctx.fillRect(4, -7, 2, 14);
  ctx.fillRect(0, -2, 10, 2);
  ctx.restore();
  ctx.save();
  ctx.translate(-12, -32);
  ctx.rotate(-0.5 + pose.lunge * 1.9);
  ctx.fillStyle = "#e9edf5";
  ctx.fillRect(-1.5, -34, 3, 30);
  ctx.fillStyle = "#c9a14a";
  ctx.fillRect(-6, -5, 12, 3);
  ctx.fillRect(-1.5, -3, 3, 9);
  ctx.restore();
  ctx.restore();
}

function pyromancer(ctx: Ctx, pose: Pose): void {
  shadow(ctx, 16);
  const y = bob(pose, 3.4);
  ctx.save();
  ctx.translate(0, y);
  const robe = ctx.createLinearGradient(0, -44, 0, 0);
  robe.addColorStop(0, "#c0392b");
  robe.addColorStop(1, "#5b1410");
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(-8, -42);
  ctx.lineTo(8, -42);
  ctx.lineTo(16, -2);
  ctx.quadraticCurveTo(0, 4, -16, -2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#f0b84a";
  ctx.fillRect(-9, -24, 18, 3);
  ctx.fillStyle = "#2b1a1a";
  ctx.beginPath();
  ctx.arc(0, -47, 8, 0, Math.PI * 2);
  ctx.fill();
  eyes(ctx, 3, -47, 3, "#ffb04a");
  ctx.fillStyle = "#7a1d16";
  ctx.beginPath();
  ctx.moveTo(-14, -52);
  ctx.lineTo(14, -52);
  ctx.lineTo(1, -80);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#e6a23a";
  ctx.fillRect(-13, -54, 26, 3);
  ctx.save();
  ctx.translate(16, -26);
  ctx.rotate(-0.15 + armSwing(pose) * 0.4);
  ctx.fillStyle = "#6b4a2b";
  ctx.fillRect(-1.5, -34, 3, 46);
  const flicker = 1 + Math.sin(pose.t * 14) * 0.12 + pose.cast * 0.7;
  glow(ctx, 0, -38, 18 * flicker, "#ff9a3c", 0.9);
  ctx.fillStyle = "#ffd36b";
  ctx.beginPath();
  ctx.arc(0, -38, 4.5 * flicker, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function cleric(ctx: Ctx, pose: Pose): void {
  shadow(ctx, 16);
  const y = bob(pose, 2.6);
  ctx.save();
  ctx.translate(0, y);
  const robe = ctx.createLinearGradient(0, -44, 0, 0);
  robe.addColorStop(0, "#f4efe0");
  robe.addColorStop(1, "#a99a76");
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(-9, -42);
  ctx.lineTo(9, -42);
  ctx.lineTo(15, -2);
  ctx.quadraticCurveTo(0, 4, -15, -2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#d8b24a";
  ctx.fillRect(-2, -42, 4, 40);
  ctx.fillStyle = "#e8dcc0";
  ctx.beginPath();
  ctx.arc(0, -50, 10, Math.PI, 0);
  ctx.lineTo(10, -42);
  ctx.lineTo(-10, -42);
  ctx.fill();
  ctx.fillStyle = "#3a2d24";
  ctx.beginPath();
  ctx.arc(1, -49, 6.5, 0, Math.PI * 2);
  ctx.fill();
  eyes(ctx, 3, -49, 2.4, "#bff0ff", 1.3);
  ctx.strokeStyle = `rgba(255,224,140,${0.75 + Math.sin(pose.t * 3) * 0.15})`;
  ctx.lineWidth = 2;
  ctx.shadowColor = "#ffd978";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.ellipse(0, -66, 11, 3.2, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.save();
  ctx.translate(15, -22);
  ctx.rotate(armSwing(pose) * 0.3);
  ctx.fillStyle = "#8a6a3a";
  ctx.fillRect(-1.2, -38, 2.4, 50);
  glow(ctx, 0, -42, 14 + pose.cast * 16, "#ffe9a0", 0.55 + pose.cast * 0.4);
  ctx.fillStyle = "#ffe08a";
  ctx.fillRect(-1.6, -50, 3.2, 14);
  ctx.fillRect(-5.5, -45, 11, 3.2);
  ctx.restore();
  ctx.restore();
}

function rogue(ctx: Ctx, pose: Pose): void {
  shadow(ctx, 14);
  const y = bob(pose, 5, 1.2);
  ctx.save();
  ctx.translate(0, y);
  ctx.fillStyle = "#1c2b22";
  roundRect(ctx, -7, -16, 5, 16, 2);
  ctx.fill();
  roundRect(ctx, 2, -16, 5, 16, 2);
  ctx.fill();
  const body = ctx.createLinearGradient(-10, -44, 10, -14);
  body.addColorStop(0, "#3d7a55");
  body.addColorStop(1, "#1c3a2a");
  ctx.fillStyle = body;
  roundRect(ctx, -10, -42, 20, 28, 5);
  ctx.fill();
  ctx.fillStyle = "#4f2a2a";
  ctx.fillRect(-10, -30, 20, 3);
  ctx.fillStyle = "#26402f";
  ctx.beginPath();
  ctx.moveTo(-10, -50);
  ctx.quadraticCurveTo(0, -66, 10, -50);
  ctx.lineTo(8, -42);
  ctx.lineTo(-8, -42);
  ctx.fill();
  ctx.fillStyle = "#0f1612";
  ctx.beginPath();
  ctx.arc(2, -49, 6, 0, Math.PI * 2);
  ctx.fill();
  eyes(ctx, 4, -49, 2, "#ffe05a", 1.3);
  ctx.fillStyle = "#7a2c2c";
  ctx.beginPath();
  ctx.moveTo(-9, -42);
  ctx.quadraticCurveTo(-22, -40 + Math.sin(pose.t * 6) * 2, -18, -30);
  ctx.quadraticCurveTo(-10, -36, -6, -40);
  ctx.fill();
  for (const sign of [1, -1]) {
    ctx.save();
    ctx.translate(10 * sign + 3, -28);
    ctx.rotate(-0.4 + pose.lunge * 2 * sign);
    ctx.fillStyle = "#e6ecf5";
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(2, 0);
    ctx.lineTo(-2, 0);
    ctx.fill();
    ctx.fillStyle = "#6b4a2b";
    ctx.fillRect(-1.5, 0, 3, 5);
    ctx.restore();
  }
  ctx.restore();
}

function warlock(ctx: Ctx, pose: Pose): void {
  shadow(ctx, 16);
  const y = bob(pose, 2.8);
  ctx.save();
  ctx.translate(0, y);
  const robe = ctx.createLinearGradient(0, -44, 0, 0);
  robe.addColorStop(0, "#7d4bc2");
  robe.addColorStop(1, "#2a1450");
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(-9, -42);
  ctx.lineTo(9, -42);
  ctx.lineTo(16, -2);
  ctx.quadraticCurveTo(0, 5, -16, -2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#1a0f2c";
  ctx.beginPath();
  ctx.arc(0, -50, 9.5, 0, Math.PI * 2);
  ctx.fill();
  eyes(ctx, 3, -50, 3, "#7dff9a");
  ctx.strokeStyle = "#cfc3e8";
  ctx.lineWidth = 2.4;
  ctx.lineCap = "round";
  for (const sign of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sign * 6, -57);
    ctx.quadraticCurveTo(sign * 14, -62, sign * 10, -72);
    ctx.stroke();
  }
  const float = Math.sin(pose.t * 2.4) * 3;
  glow(ctx, 20, -40 + float, 16 + pose.cast * 14, "#9d4dff", 0.7);
  ctx.fillStyle = "#e2d4ff";
  ctx.beginPath();
  ctx.arc(20, -40 + float, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2a1450";
  ctx.fillRect(18, -42 + float, 1.6, 1.6);
  ctx.fillRect(21, -42 + float, 1.6, 1.6);
  ctx.restore();
}

function skullHead(ctx: Ctx, x: number, y: number, r: number, bone = "#e8e2cf"): void {
  ctx.fillStyle = bone;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  roundRect(ctx, x - r * 0.55, y + r * 0.5, r * 1.1, r * 0.7, 2);
  ctx.fill();
  ctx.fillStyle = "#15110f";
  ctx.beginPath();
  ctx.arc(x - r * 0.38, y - r * 0.05, r * 0.28, 0, Math.PI * 2);
  ctx.arc(x + r * 0.38, y - r * 0.05, r * 0.28, 0, Math.PI * 2);
  ctx.fill();
}

function skeleton(ctx: Ctx, pose: Pose): void {
  shadow(ctx, 14);
  const y = bob(pose, 3.1);
  ctx.save();
  ctx.translate(0, y);
  ctx.strokeStyle = "#d8d2bd";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-4, 0);
  ctx.lineTo(-4, -18);
  ctx.moveTo(4, 0);
  ctx.lineTo(4, -18);
  ctx.moveTo(0, -18);
  ctx.lineTo(0, -44);
  ctx.stroke();
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-8, -40 + i * 5);
    ctx.quadraticCurveTo(0, -37 + i * 5, 8, -40 + i * 5);
    ctx.stroke();
  }
  skullHead(ctx, 1, -54, 9);
  eyes(ctx, 1, -55, 3.4, "#ff5a3a", 1.2);
  ctx.save();
  ctx.translate(8, -38);
  ctx.rotate(-0.3 + pose.lunge * 1.8);
  ctx.strokeStyle = "#d8d2bd";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -8);
  ctx.stroke();
  ctx.fillStyle = "#9a9a9a";
  ctx.fillRect(-1.5, -34, 3, 26);
  ctx.restore();
  ctx.restore();
}

function ghoul(ctx: Ctx, pose: Pose): void {
  shadow(ctx, 17);
  const y = bob(pose, 2.4, 2);
  ctx.save();
  ctx.translate(0, y);
  const skin = ctx.createLinearGradient(0, -46, 0, 0);
  skin.addColorStop(0, "#7e9a74");
  skin.addColorStop(1, "#44543e");
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(-14, -2);
  ctx.quadraticCurveTo(-18, -30, -6, -42);
  ctx.quadraticCurveTo(8, -46, 14, -30);
  ctx.quadraticCurveTo(16, -10, 12, -2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(8, -44, 8, 0, Math.PI * 2);
  ctx.fill();
  eyes(ctx, 10, -45, 2.6, "#ff3a3a", 1.5);
  ctx.fillStyle = "#1a0f0f";
  ctx.fillRect(7, -39, 7, 2);
  ctx.strokeStyle = "#6a8560";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(10, -32);
  ctx.lineTo(20 + pose.lunge * 10, -20 + pose.lunge * 6);
  ctx.stroke();
  ctx.strokeStyle = "#e8e2cf";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(20 + pose.lunge * 10, -20 + pose.lunge * 6);
    ctx.lineTo(25 + pose.lunge * 10, -17 + i * 2 + pose.lunge * 6);
    ctx.stroke();
  }
  ctx.restore();
}

function cultist(ctx: Ctx, pose: Pose): void {
  shadow(ctx, 15);
  const y = bob(pose, 3);
  ctx.save();
  ctx.translate(0, y);
  const robe = ctx.createLinearGradient(0, -48, 0, 0);
  robe.addColorStop(0, "#7a1a2a");
  robe.addColorStop(1, "#2a0a10");
  ctx.fillStyle = robe;
  ctx.beginPath();
  ctx.moveTo(-10, -46);
  ctx.lineTo(10, -46);
  ctx.lineTo(16, -2);
  ctx.quadraticCurveTo(0, 4, -16, -2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#4a0f1c";
  ctx.beginPath();
  ctx.moveTo(-11, -44);
  ctx.quadraticCurveTo(0, -68, 11, -44);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#0a0405";
  ctx.beginPath();
  ctx.ellipse(1, -49, 6, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  eyes(ctx, 2, -50, 2.4, "#ff6a3a", 1.3);
  ctx.strokeStyle = "#e0c060";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, -26, 4, 0, Math.PI * 2);
  ctx.moveTo(0, -31);
  ctx.lineTo(0, -21);
  ctx.stroke();
  ctx.save();
  ctx.translate(12, -26);
  ctx.rotate(-0.4 + pose.lunge * 1.8);
  ctx.fillStyle = "#cfd4dc";
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(2.2, 0);
  ctx.lineTo(-2.2, 0);
  ctx.fill();
  ctx.restore();
  ctx.restore();
}

function wraith(ctx: Ctx, pose: Pose): void {
  const float = Math.sin(pose.t * 2) * 4;
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 1, 13, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(0, -12 + float);
  const cloak = ctx.createLinearGradient(0, -50, 0, 14);
  cloak.addColorStop(0, "rgba(120,150,210,0.95)");
  cloak.addColorStop(1, "rgba(40,50,100,0)");
  ctx.fillStyle = cloak;
  ctx.beginPath();
  ctx.moveTo(-12, -40);
  ctx.quadraticCurveTo(0, -58, 12, -40);
  ctx.lineTo(16, 6);
  for (let i = 0; i < 4; i++) {
    const x = 16 - i * 8;
    ctx.lineTo(x - 4, 14 + Math.sin(pose.t * 4 + i) * 3);
    ctx.lineTo(x - 8, 4);
  }
  ctx.lineTo(-12, -40);
  ctx.fill();
  ctx.fillStyle = "#0a0e1c";
  ctx.beginPath();
  ctx.ellipse(1, -40, 6.5, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  eyes(ctx, 2, -41, 2.6, "#9fe8ff", 1.6);
  ctx.strokeStyle = "rgba(140,170,230,0.8)";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(10, -28);
  ctx.lineTo(22 + pose.lunge * 10, -22 + pose.lunge * 4);
  ctx.stroke();
  ctx.restore();
}

function boneKnight(ctx: Ctx, pose: Pose): void {
  shadow(ctx, 17);
  const y = bob(pose, 2.7);
  ctx.save();
  ctx.translate(0, y);
  ctx.fillStyle = "#3a3d46";
  roundRect(ctx, -8, -16, 6, 16, 2);
  ctx.fill();
  roundRect(ctx, 2, -16, 6, 16, 2);
  ctx.fill();
  const plate = ctx.createLinearGradient(-12, -46, 12, -16);
  plate.addColorStop(0, "#58606e");
  plate.addColorStop(1, "#262a33");
  ctx.fillStyle = plate;
  roundRect(ctx, -12, -44, 24, 30, 5);
  ctx.fill();
  ctx.fillStyle = "#7a2a2a";
  ctx.fillRect(-12, -30, 24, 3);
  skullHead(ctx, 1, -54, 9, "#d8d2bd");
  ctx.fillStyle = "#2e323c";
  ctx.beginPath();
  ctx.arc(1, -57, 10, Math.PI, 0);
  ctx.fill();
  eyes(ctx, 1, -54, 3.4, "#ff4a3a", 1.3);
  ctx.save();
  ctx.translate(13, -28);
  ctx.rotate(armSwing(pose) * 0.4);
  ctx.fillStyle = "#4b515e";
  roundRect(ctx, -2, -12, 13, 26, 5);
  ctx.fill();
  ctx.strokeStyle = "#8a8f9a";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.translate(-12, -32);
  ctx.rotate(-0.4 + pose.lunge * 1.8);
  ctx.fillStyle = "#9aa0aa";
  ctx.fillRect(-2, -34, 4, 30);
  ctx.fillStyle = "#6b4a2b";
  ctx.fillRect(-5, -5, 10, 3);
  ctx.restore();
  ctx.restore();
}

function plagueRat(ctx: Ctx, pose: Pose): void {
  shadow(ctx, 15);
  const y = bob(pose, 6, 1);
  ctx.save();
  ctx.translate(0, y);
  ctx.fillStyle = "#5b4636";
  ctx.beginPath();
  ctx.ellipse(0, -11, 15, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(14, -13, 8, 6, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#8a6a56";
  ctx.beginPath();
  ctx.arc(11, -20, 3.4, 0, Math.PI * 2);
  ctx.fill();
  eyes(ctx, 16, -15, 0.1, "#ff3a3a", 1.5);
  ctx.strokeStyle = "#d9a3a3";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-14, -9);
  ctx.quadraticCurveTo(-26, -2 + Math.sin(pose.t * 5) * 3, -22, -18);
  ctx.stroke();
  ctx.fillStyle = "#6a8a3a";
  ctx.beginPath();
  ctx.arc(-3, -16, 2.2, 0, Math.PI * 2);
  ctx.arc(4, -8, 1.8, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function shade(ctx: Ctx, pose: Pose): void {
  const float = Math.sin(pose.t * 2.6) * 3;
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 1, 12, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.translate(0, -22 + float);
  glow(ctx, 0, 0, 30, "#4a2a7a", 0.55);
  ctx.fillStyle = "#120a1e";
  ctx.beginPath();
  ctx.moveTo(-14, 16);
  ctx.quadraticCurveTo(-20, -20, 0, -26);
  ctx.quadraticCurveTo(20, -20, 14, 16);
  for (let i = 0; i < 5; i++) {
    ctx.lineTo(14 - i * 7, 8 + Math.sin(pose.t * 5 + i * 1.4) * 5);
  }
  ctx.closePath();
  ctx.fill();
  eyes(ctx, 1, -8, 5, "#ffffff", 2.2);
  ctx.restore();
}

function boss(ctx: Ctx, pose: Pose): void {
  shadow(ctx, 22);
  const y = bob(pose, 2, 2);
  ctx.save();
  ctx.translate(0, y);
  const cape = ctx.createLinearGradient(0, -60, 0, 4);
  cape.addColorStop(0, "#5a1230");
  cape.addColorStop(1, "#1a0610");
  ctx.fillStyle = cape;
  ctx.beginPath();
  ctx.moveTo(-20, -50);
  ctx.lineTo(20, -50);
  ctx.lineTo(28, 2);
  ctx.quadraticCurveTo(0, 8, -28, 2);
  ctx.closePath();
  ctx.fill();
  const armor = ctx.createLinearGradient(-14, -52, 14, -14);
  armor.addColorStop(0, "#6a7080");
  armor.addColorStop(1, "#262a34");
  ctx.fillStyle = armor;
  roundRect(ctx, -14, -50, 28, 34, 6);
  ctx.fill();
  ctx.fillStyle = "#c9a14a";
  ctx.fillRect(-14, -34, 28, 3);
  roundRect(ctx, -22, -52, 12, 10, 4);
  ctx.fill();
  roundRect(ctx, 10, -52, 12, 10, 4);
  ctx.fill();
  skullHead(ctx, 0, -62, 11, "#efe8d2");
  eyes(ctx, 0, -63, 4, "#ff3a2a", 2);
  ctx.fillStyle = "#c9a14a";
  ctx.beginPath();
  ctx.moveTo(-11, -70);
  ctx.lineTo(-11, -84);
  ctx.lineTo(-5, -76);
  ctx.lineTo(0, -88);
  ctx.lineTo(5, -76);
  ctx.lineTo(11, -84);
  ctx.lineTo(11, -70);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#efe8d2";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  for (const sign of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(sign * 9, -68);
    ctx.quadraticCurveTo(sign * 22, -74, sign * 18, -92);
    ctx.stroke();
  }
  ctx.save();
  ctx.translate(-22, -40);
  ctx.rotate(-0.5 + pose.lunge * 1.7);
  ctx.fillStyle = "#b8bcc6";
  ctx.beginPath();
  ctx.moveTo(-3, -6);
  ctx.lineTo(0, -52);
  ctx.lineTo(3, -6);
  ctx.fill();
  ctx.fillStyle = "#c9a14a";
  ctx.fillRect(-8, -6, 16, 4);
  ctx.restore();
  ctx.restore();
}

const SPRITES: Record<string, (ctx: Ctx, pose: Pose) => void> = {
  knight,
  pyromancer,
  cleric,
  rogue,
  warlock,
  skeleton,
  ghoul,
  cultist,
  wraith,
  boneknight: boneKnight,
  plaguerat: plagueRat,
  shade,
  boss,
};

export function drawSprite(ctx: Ctx, kind: string, pose: Pose): void {
  const draw = SPRITES[kind] ?? skeleton;
  draw(ctx, pose);
}
