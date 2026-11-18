// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Music } from "../src/ui/music";
import type { Settings } from "../src/ui/sound";

class FakeParam {
  value = 0;
  setValueAtTime(): void {}
  linearRampToValueAtTime(): void {}
  exponentialRampToValueAtTime(): void {}
  cancelScheduledValues(): void {}
  setTargetAtTime(): void {}
}

class FakeNode {
  gain = new FakeParam();
  frequency = new FakeParam();
  detune = new FakeParam();
  Q = new FakeParam();
  type = "";
  buffer: unknown = null;
  started = 0;
  connect<T>(target: T): T {
    return target;
  }
  start(): void {
    this.started += 1;
  }
  stop(): void {}
}

let created: FakeNode[] = [];
let clock = 0;

class FakeAudioContext {
  sampleRate = 8000;
  state = "running";
  destination = new FakeNode();
  get currentTime(): number {
    return clock;
  }
  resume(): Promise<void> {
    return Promise.resolve();
  }
  private make(): FakeNode {
    const node = new FakeNode();
    created.push(node);
    return node;
  }
  createGain = (): FakeNode => this.make();
  createOscillator = (): FakeNode => this.make();
  createBiquadFilter = (): FakeNode => this.make();
  createDynamicsCompressor = (): FakeNode => this.make();
  createConvolver = (): FakeNode => this.make();
  createBuffer(channels: number, length: number): { getChannelData: () => Float32Array } {
    return { getChannelData: () => new Float32Array(length) };
    void channels;
  }
}

function oscillators(): FakeNode[] {
  return created.filter((node) => node.started > 0);
}

function play(_music: Music, seconds: number): void {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.12) {
    clock += 0.12;
    vi.advanceTimersByTime(120);
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  created = [];
  clock = 0;
  vi.stubGlobal("AudioContext", FakeAudioContext);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("music", () => {
  const on: Settings = { sound: true, vibration: false, music: true, tutorialDone: true };

  it("starts, schedules pads, plucks and heartbeats, and stops", () => {
    const music = new Music({ ...on });
    music.start();
    expect(music.playing).toBe(true);
    play(music, 20);
    expect(oscillators().length).toBeGreaterThan(20);
    music.stop();
    expect(music.playing).toBe(false);
    const after = oscillators().length;
    play(music, 5);
    expect(oscillators().length).toBe(after);
  });

  it("does nothing when music is switched off", () => {
    const music = new Music({ ...on, music: false });
    music.start();
    expect(music.playing).toBe(false);
    expect(created).toHaveLength(0);
  });

  it("does not crash without WebAudio", () => {
    vi.stubGlobal("AudioContext", undefined);
    const music = new Music({ ...on });
    expect(() => music.start()).not.toThrow();
    expect(music.playing).toBe(false);
  });

  it("starting twice does not stack schedulers", () => {
    const music = new Music({ ...on });
    music.start();
    music.start();
    play(music, 10);
    const single = oscillators().length;

    created = [];
    clock = 0;
    const other = new Music({ ...on });
    other.start();
    play(other, 10);
    expect(single).toBeLessThanOrEqual(oscillators().length * 1.5);
  });

  it("plays more during a boss fight", () => {
    const calm = new Music({ ...on });
    calm.start();
    play(calm, 30);
    const calmCount = oscillators().length;
    calm.stop();

    created = [];
    clock = 0;
    const tense = new Music({ ...on });
    tense.setIntensity(1);
    tense.start();
    play(tense, 30);
    expect(oscillators().length).toBeGreaterThan(calmCount);
  });
});
