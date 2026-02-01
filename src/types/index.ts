// MIDI Types
export type MIDIChannel = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
export type MIDIValue = number; // 0-127
export type CCNumber = number; // 0-127

export interface MIDIState {
  access: MIDIAccess | null;
  output: MIDIOutput | null;
  channel: MIDIChannel;
}

// Effect Types
export type EffectFamily = 'Reverb' | 'Pitch' | 'Warp' | 'Delay' | 'Synth' | 'Bend';
export type EffectVariant = 'A' | 'B' | 'NONE';
export type Side = 'L' | 'R';

export interface EffectDefinition {
  family: EffectFamily;
  A: string;
  B: string;
}

export interface EffectDetail {
  time: string;
  modify: string;
  alt: string;
}

export interface EffectDetails {
  A: EffectDetail;
  B: EffectDetail;
}

// Knob Types
export type KnobKind = 'knob' | 'modify';
export type KnobColumn = 'left' | 'center' | 'right';

export interface KnobConfig {
  label: string;
  cc: CCNumber;
  kind: KnobKind;
  column: KnobColumn;
  hasRamp?: boolean;
  hasLock?: boolean;
}

// UI Control Types
export type UIControlType = 'knob' | 'modify' | 'tri' | 'dip' | 'other' | 'slider' | 'engage';

export interface UIControl {
  type: UIControlType;
  set: (value: MIDIValue) => void;
  arcLabels?: {
    A1: SVGTextElement; A2: SVGTextElement;
    B1: SVGTextElement; B2: SVGTextElement
  };
  subLabel?: HTMLElement;
  lockIcon?: HTMLElement;
}

// Tri-state block (effect selectors, routing)
export interface TriBlockConfig {
  id: string;
  title: string;
  cc: CCNumber;
  options: string[];
  swappedOptions?: string[];
  side: Side | null;
  hasEngage: boolean;
  engageCC?: CCNumber;
  swapCC?: CCNumber;
  hasRandomize?: boolean;
}

// State Types
export interface EditorState {
  [cc: number]: MIDIValue;
}

export interface PresetMetadata {
  name: string;
  occupied: boolean;
  data?: EditorState;
}

export interface PresetMetadataStore {
  [slot: number]: PresetMetadata;
}

export interface SavedEditorState {
  state: EditorState;
  channel: MIDIChannel;
  lockedKnobs: CCNumber[];
  inclRamp: boolean;
  activeSlot: number;
  lastMidiOutId: string | null;
  rampCollapsed: boolean;
  autoSync: boolean;
}

export interface ExportedPreset {
  app: string;
  build: string;
  ts: string;
  channel: MIDIChannel;
  slot: number;
  lockMix: boolean;
  lEngage: boolean;
  rEngage: boolean;
  ccs: Record<string, MIDIValue>;
}

// Subdivision option
export interface SubdivisionOption {
  label: string;
  value: number;
}

// Control configs
export interface RampToggleConfig {
  label: string;
  cc: CCNumber;
}

export interface CheckboxControlConfig {
  type: 'checkbox';
  label: string;
  cc: CCNumber;
}

export interface SelectControlConfig {
  label: string;
  cc: CCNumber;
}

export interface DipSwitchConfig {
  label: string;
  cc: CCNumber;
}
