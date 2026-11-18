import { SAVE_VERSION, serialize, type GameState } from "./engine/state";

function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(code: string): string {
  const binary = atob(code);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function exportSave(state: GameState): string {
  return toBase64(serialize(state));
}

/** Returns the parsed save, or null when the code is damaged or from another version. */
export function parseSave(code: string): GameState | null {
  try {
    const data = JSON.parse(fromBase64(code.trim())) as Partial<GameState>;
    if (data.version !== SAVE_VERSION || !Array.isArray(data.heroes) || data.heroes.length === 0) return null;
    if (typeof data.gold !== "number" || typeof data.depth !== "number") return null;
    return data as GameState;
  } catch {
    return null;
  }
}

export function replaceState(target: GameState, source: GameState, fallback: GameState): void {
  Object.assign(target, fallback, source, { battle: null });
}
