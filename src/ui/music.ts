import type { Settings } from "./sound";
import { ARP_NOTES, chordForBar, midiToHz, nextArpNote, tempo } from "./theory";

const LOOKAHEAD_SECONDS = 0.45;
const TICK_MS = 120;
const BEATS_PER_CHORD = 8;

/** Ambient dark fantasy music made from oscillators: pads, a slow arpeggio and a heartbeat. */
export class Music {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private timer: number | null = null;
  private nextTime = 0;
  private step = 0;
  private lastNote: number | null = null;
  private intensity = 0;

  constructor(private readonly settings: Settings) {}

  get playing(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (this.timer !== null || !this.settings.music || typeof AudioContext === "undefined") return;
    const context = this.context ?? new AudioContext();
    this.context = context;
    if (context.state === "suspended") void context.resume();
    if (!this.master) this.build(context);
    this.master!.gain.cancelScheduledValues(context.currentTime);
    this.master!.gain.setTargetAtTime(0.5, context.currentTime, 1.2);
    this.nextTime = context.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), TICK_MS);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    if (this.context && this.master) this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.4);
  }

  setIntensity(value: number): void {
    this.intensity = value;
  }

  private build(context: AudioContext): void {
    const master = context.createGain();
    master.gain.value = 0;
    const compressor = context.createDynamicsCompressor();
    master.connect(compressor).connect(context.destination);

    const length = Math.floor(context.sampleRate * 3);
    const impulse = context.createBuffer(2, length, context.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2.4;
    }
    const reverb = context.createConvolver();
    reverb.buffer = impulse;
    const wet = context.createGain();
    wet.gain.value = 0.6;
    reverb.connect(wet).connect(master);

    this.master = master;
    this.reverb = reverb;
  }

  private schedule(): void {
    const context = this.context;
    if (!context) return;
    const beat = 60 / tempo(this.intensity);
    while (this.nextTime < context.currentTime + LOOKAHEAD_SECONDS) {
      this.playStep(this.nextTime, beat);
      this.nextTime += beat / 2;
      this.step += 1;
    }
  }

  private playStep(time: number, beat: number): void {
    const eighth = this.step;
    const beatIndex = Math.floor(eighth / 2);
    if (eighth % (BEATS_PER_CHORD * 2) === 0) this.pad(time, beat, Math.floor(eighth / (BEATS_PER_CHORD * 2)));
    if (eighth % 2 === 0) this.thud(time, beatIndex % 2 === 0 ? 0.2 : 0.1 + this.intensity * 0.12);
    const chance = 0.5 + this.intensity * 0.35;
    if (Math.random() < chance) {
      this.lastNote = nextArpNote(this.lastNote, Math.random);
      this.pluck(time, this.lastNote);
    }
  }

  private pad(time: number, beat: number, bar: number): void {
    const context = this.context;
    if (!context || !this.master) return;
    const chord = chordForBar(bar);
    const length = beat * BEATS_PER_CHORD;
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 520 + this.intensity * 500;
    filter.Q.value = 0.7;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.07, time + length * 0.35);
    gain.gain.linearRampToValueAtTime(0.0001, time + length * 1.05);
    filter.connect(gain);
    gain.connect(this.master);
    if (this.reverb) gain.connect(this.reverb);
    for (const note of chord) {
      for (const detune of [-7, 7]) {
        const oscillator = context.createOscillator();
        oscillator.type = "sawtooth";
        oscillator.frequency.value = midiToHz(note - 12);
        oscillator.detune.value = detune;
        oscillator.connect(filter);
        oscillator.start(time);
        oscillator.stop(time + length * 1.1);
      }
    }
    const bass = context.createOscillator();
    const bassGain = context.createGain();
    bass.type = "sine";
    bass.frequency.value = midiToHz((chord[0] ?? 57) - 24);
    bassGain.gain.setValueAtTime(0.0001, time);
    bassGain.gain.linearRampToValueAtTime(0.16, time + 1.5);
    bassGain.gain.linearRampToValueAtTime(0.0001, time + length * 1.05);
    bass.connect(bassGain).connect(this.master);
    bass.start(time);
    bass.stop(time + length * 1.1);
  }

  private pluck(time: number, note: number): void {
    const context = this.context;
    if (!context || !this.master) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.value = midiToHz(note);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.05, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.4);
    oscillator.connect(gain);
    gain.connect(this.master);
    if (this.reverb) gain.connect(this.reverb);
    oscillator.start(time);
    oscillator.stop(time + 1.5);
  }

  private thud(time: number, volume: number): void {
    const context = this.context;
    if (!context || !this.master) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(90, time);
    oscillator.frequency.exponentialRampToValueAtTime(38, time + 0.16);
    gain.gain.setValueAtTime(volume, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.25);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(time);
    oscillator.stop(time + 0.3);
  }
}

export const MUSIC_NOTE_COUNT = ARP_NOTES.length;
