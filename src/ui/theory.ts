/** Pure music helpers, kept apart from the audio code so they can be tested. */

/** A minor pentatonic, as semitones above the root note A. */
export const SCALE: readonly number[] = [0, 3, 5, 7, 10];
export const ROOT = 57; // A3

/** Am, F, Dm, E as MIDI notes. A slow, dark progression. */
export const CHORDS: readonly (readonly number[])[] = [
  [57, 60, 64],
  [53, 57, 60],
  [50, 53, 57],
  [52, 56, 59],
];

export const ARP_LOW = 69;
export const ARP_HIGH = 93;

export function midiToHz(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

export function chordForBar(bar: number): readonly number[] {
  const index = ((bar % CHORDS.length) + CHORDS.length) % CHORDS.length;
  return CHORDS[index] ?? CHORDS[0]!;
}

export function inScale(note: number): boolean {
  return SCALE.includes((((note - ROOT) % 12) + 12) % 12);
}

/** All arpeggio notes: the scale across the allowed range. */
export const ARP_NOTES: readonly number[] = (() => {
  const notes: number[] = [];
  for (let note = ARP_LOW; note <= ARP_HIGH; note++) if (inScale(note)) notes.push(note);
  return notes;
})();

/** A gentle random walk over the scale: it moves at most two steps at a time. */
export function nextArpNote(previous: number | null, random: () => number): number {
  if (previous === null) return ARP_NOTES[Math.floor(random() * ARP_NOTES.length)] ?? ARP_LOW;
  const index = Math.max(0, ARP_NOTES.indexOf(previous));
  const step = Math.floor(random() * 5) - 2;
  const next = Math.max(0, Math.min(ARP_NOTES.length - 1, index + step));
  return ARP_NOTES[next] ?? previous;
}

export function tempo(intensity: number): number {
  return 64 + 30 * Math.max(0, Math.min(1, intensity));
}
