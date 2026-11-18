export type Sfx = "kill" | "boss" | "chest" | "level" | "rally" | "lose" | "claim";

export interface Settings {
  sound: boolean;
  vibration: boolean;
  tutorialDone: boolean;
}

const SETTINGS_KEY = "ashen-crypts-settings";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { sound: true, vibration: true, tutorialDone: false, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    // fall through to defaults
  }
  return { sound: true, vibration: true, tutorialDone: false };
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // settings are a convenience; the game works without them
  }
}

interface Tone {
  frequency: number;
  seconds: number;
  type: OscillatorType;
  volume: number;
  slideTo?: number;
}

const SOUNDS: Record<Sfx, Tone[]> = {
  kill: [{ frequency: 220, slideTo: 140, seconds: 0.08, type: "square", volume: 0.04 }],
  boss: [
    { frequency: 330, seconds: 0.12, type: "triangle", volume: 0.08 },
    { frequency: 440, seconds: 0.12, type: "triangle", volume: 0.08 },
    { frequency: 660, seconds: 0.25, type: "triangle", volume: 0.08 },
  ],
  chest: [
    { frequency: 523, seconds: 0.1, type: "sine", volume: 0.08 },
    { frequency: 659, seconds: 0.1, type: "sine", volume: 0.08 },
    { frequency: 784, seconds: 0.2, type: "sine", volume: 0.08 },
  ],
  level: [{ frequency: 400, slideTo: 800, seconds: 0.12, type: "sine", volume: 0.06 }],
  rally: [{ frequency: 180, slideTo: 360, seconds: 0.3, type: "sawtooth", volume: 0.05 }],
  lose: [{ frequency: 260, slideTo: 90, seconds: 0.5, type: "sawtooth", volume: 0.06 }],
  claim: [
    { frequency: 600, seconds: 0.08, type: "sine", volume: 0.06 },
    { frequency: 900, seconds: 0.15, type: "sine", volume: 0.06 },
  ],
};

export class Sound {
  private context: AudioContext | null = null;

  constructor(private readonly settings: Settings) {}

  private ensure(): AudioContext | null {
    if (!this.context && typeof AudioContext !== "undefined") {
      this.context = new AudioContext();
    }
    if (this.context?.state === "suspended") void this.context.resume();
    return this.context;
  }

  play(effect: Sfx): void {
    if (!this.settings.sound) return;
    const context = this.ensure();
    if (!context) return;
    let start = context.currentTime;
    for (const tone of SOUNDS[effect]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = tone.type;
      oscillator.frequency.setValueAtTime(tone.frequency, start);
      if (tone.slideTo) oscillator.frequency.linearRampToValueAtTime(tone.slideTo, start + tone.seconds);
      gain.gain.setValueAtTime(tone.volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.seconds);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + tone.seconds);
      start += tone.seconds * 0.9;
    }
  }

  buzz(milliseconds: number): void {
    if (this.settings.vibration && "vibrate" in navigator) navigator.vibrate(milliseconds);
  }
}
