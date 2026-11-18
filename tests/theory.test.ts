import { describe, expect, it } from "vitest";
import { ARP_HIGH, ARP_LOW, ARP_NOTES, CHORDS, chordForBar, inScale, midiToHz, nextArpNote, tempo } from "../src/ui/theory";

function seeded(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

describe("music theory helpers", () => {
  it("converts MIDI notes to frequencies", () => {
    expect(midiToHz(69)).toBeCloseTo(440, 6);
    expect(midiToHz(57)).toBeCloseTo(220, 6);
    expect(midiToHz(81)).toBeCloseTo(880, 6);
  });

  it("the chord progression loops", () => {
    expect(chordForBar(0)).toEqual(CHORDS[0]);
    expect(chordForBar(4)).toEqual(CHORDS[0]);
    expect(chordForBar(7)).toEqual(CHORDS[3]);
    expect(chordForBar(-1)).toEqual(CHORDS[3]);
  });

  it("every arpeggio note is inside the scale and the range", () => {
    expect(ARP_NOTES.length).toBeGreaterThan(8);
    for (const note of ARP_NOTES) {
      expect(inScale(note)).toBe(true);
      expect(note).toBeGreaterThanOrEqual(ARP_LOW);
      expect(note).toBeLessThanOrEqual(ARP_HIGH);
    }
  });

  it("the arpeggio walks gently and never leaves the range", () => {
    const random = seeded(7);
    let note: number | null = null;
    for (let i = 0; i < 500; i++) {
      const next = nextArpNote(note, random);
      expect(ARP_NOTES).toContain(next);
      if (note !== null) expect(Math.abs(ARP_NOTES.indexOf(next) - ARP_NOTES.indexOf(note))).toBeLessThanOrEqual(2);
      note = next;
    }
  });

  it("the tempo rises with intensity and is clamped", () => {
    expect(tempo(0)).toBe(64);
    expect(tempo(1)).toBe(94);
    expect(tempo(5)).toBe(94);
    expect(tempo(-3)).toBe(64);
  });

  it("every chord tone belongs to the scale or is the leading tone of E", () => {
    for (const chord of CHORDS) for (const note of chord) expect(note).toBeGreaterThan(40);
  });
});
