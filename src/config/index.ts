import midiCC from './midi-cc.json';
import effects from './effects.json';
import knobs from './knobs.json';
import controls from './controls.json';

export const MIDI_CC = midiCC;
export const EFFECTS = effects;
export const KNOBS = knobs;
export const CONTROLS = controls;

// Derived constants for easy access
export const KNOB_CCS = MIDI_CC.groups.knobCCs;
export const HIDDEN_CCS = MIDI_CC.groups.hiddenCCs;
export const DIP_CCS = MIDI_CC.groups.dipCCs;
export const CONTROL_CCS = MIDI_CC.groups.controlCCs;
export const BLOCKED_CCS = new Set(MIDI_CC.groups.blockedCCs);
export const NEVER_RANDOM_CCS = new Set(MIDI_CC.groups.neverRandomCCs);
export const RAMP_CCS = new Set(MIDI_CC.groups.rampCCs);
export const KNOB_RAMP_MAP = MIDI_CC.knobRampMap as Record<string, number>;
export const LOCKABLE_CCS = KNOBS.lockableCCs;
export const COLUMN_KNOBS = KNOBS.columnMapping;
