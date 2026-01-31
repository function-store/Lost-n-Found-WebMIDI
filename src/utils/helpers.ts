import type { MIDIValue, CCNumber, EffectVariant } from '../types';

// Convert MIDI value (0-127) to knob rotation degrees
export function valueToDegrees(value: MIDIValue): number {
  return -135 + (value / 127) * 270;
}

// Convert MIDI value to percentage string
export function valueToPercent(value: MIDIValue): string {
  return Math.round((value / 127) * 100) + '%';
}

// Determine A/B variant from Modify knob value
export function getVariantFromModify(value: MIDIValue): EffectVariant {
  const v = Number(value) || 0;
  if (v >= 60 && v <= 68) return 'NONE';
  return v < 64 ? 'A' : 'B';
}

// Get tri-state value for specific CCs
export function triValueForCC(cc: CCNumber, position: 0 | 1 | 2): MIDIValue {
  // Per Chase Bliss Lost + Found MIDI manual:
  // CC21, CC22, CC23, CC32 use thresholds: 0, 2, 3
  if (cc === 21 || cc === 22 || cc === 23 || cc === 32) {
    return position === 0 ? 0 : position === 1 ? 2 : 3;
  }
  return position === 0 ? 1 : position === 1 ? 2 : 3;
}

// Get tri-state position from value
export function triPosFromValue(cc: CCNumber, value: MIDIValue): 0 | 1 | 2 {
  const v = Number(value) || 0;
  if (cc === 21 || cc === 22 || cc === 23 || cc === 32) {
    if (v <= 1) return 0;
    if (v === 2) return 1;
    return 2;
  }
  if (v <= 1) return 0;
  if (v === 2) return 1;
  return 2;
}

// Create DOM element with optional classes and attributes
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  attributes?: Record<string, string>
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      el.setAttribute(key, value);
    }
  }
  return el;
}

// Clamp value to MIDI range
export function clampMIDI(value: number): MIDIValue {
  return Math.max(0, Math.min(127, Math.round(value)));
}

// Generate random MIDI value, optionally avoiding a range
export function randomMIDI(avoidMin?: number, avoidMax?: number): MIDIValue {
  if (avoidMin !== undefined && avoidMax !== undefined) {
    // Generate value outside the avoid range
    const v = Math.floor(Math.random() * 128);
    if (v >= avoidMin && v <= avoidMax) {
      return Math.random() < 0.5
        ? Math.floor(Math.random() * avoidMin)
        : avoidMax + 1 + Math.floor(Math.random() * (127 - avoidMax));
    }
    return v;
  }
  return Math.floor(Math.random() * 128);
}
