import type { EditorState, SavedEditorState, CCNumber, MIDIValue, UIControl } from '../types';
import { KNOBS, CONTROL_CCS } from '../config';
import { midiService } from './midi';

const STATE_KEY = 'lostFound_editorState';

type StateChangeCallback = () => void;

class StateService {
  private state: EditorState = {};
  private lockedKnobs: Set<CCNumber> = new Set();
  private uiControls: Map<CCNumber, UIControl> = new Map();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners: StateChangeCallback[] = [];

  // Global state
  currentActiveSlot = 0;
  inclRamp = false;
  rampCollapsed = true;
  autoSync = false;

  constructor() {
    this.initializeDefaults();
  }

  private initializeDefaults(): void {
    // Set default values from config
    const defaults = KNOBS.defaults as Record<string, number>;
    for (const [cc, value] of Object.entries(defaults)) {
      if (cc !== 'default') {
        this.state[Number(cc)] = value;
      }
    }
  }

  // State access
  get(cc: CCNumber): MIDIValue {
    return this.state[cc] ?? 0;
  }

  set(cc: CCNumber, value: MIDIValue, sendMidi = true): void {
    this.state[cc] = Math.max(0, Math.min(127, value));

    // Update UI if registered
    const control = this.uiControls.get(cc);
    if (control?.set) {
      control.set(this.state[cc]);
    }

    // Send MIDI
    if (sendMidi && midiService.isEnabled) {
      midiService.sendCC(cc, this.state[cc]);
    }

    this.scheduleSave();
    this.notifyListeners();
  }

  getAll(): EditorState {
    return { ...this.state };
  }

  // UI Control registration
  registerControl(cc: CCNumber, control: UIControl): void {
    this.uiControls.set(cc, control);
  }

  getControl(cc: CCNumber): UIControl | undefined {
    return this.uiControls.get(cc);
  }

  // Lock management
  isLocked(cc: CCNumber): boolean {
    return this.lockedKnobs.has(cc);
  }

  setLocked(cc: CCNumber, locked: boolean): void {
    if (locked) {
      this.lockedKnobs.add(cc);
    } else {
      this.lockedKnobs.delete(cc);
    }
    this.scheduleSave();
  }

  unlockAllKnobs(): void {
    this.lockedKnobs.clear();
    // Update all UI controls that have a lockIcon
    this.uiControls.forEach((control) => {
      if (control.lockIcon) {
        control.lockIcon.innerHTML = '🔓';
        control.lockIcon.classList.remove('locked');
      }
    });
    // Special handling for Mix knob dependency in Lost+Found
    this.set(55, 0);
    this.scheduleSave();
  }

  getLockedKnobs(): CCNumber[] {
    return Array.from(this.lockedKnobs);
  }

  // Knob default value
  getKnobDefault(cc: CCNumber): MIDIValue {
    const defaults = KNOBS.defaults as Record<string, number>;
    return defaults[String(cc)] ?? defaults.default ?? 64;
  }

  // Persistence
  private scheduleSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.save(), 500);
  }

  save(): void {
    const data: SavedEditorState = {
      state: this.state,
      channel: midiService.currentChannel,
      lockedKnobs: this.getLockedKnobs(),
      inclRamp: this.inclRamp,
      activeSlot: this.currentActiveSlot,
      lastMidiOutId: midiService.outputId,
      rampCollapsed: this.rampCollapsed,
      autoSync: this.autoSync,
    };
    localStorage.setItem(STATE_KEY, JSON.stringify(data));
  }

  load(): void {
    try {
      const raw = localStorage.getItem(STATE_KEY);
      if (!raw) return;

      const data: SavedEditorState = JSON.parse(raw);

      // Restore state
      if (data.state) {
        Object.assign(this.state, data.state);
        // Update all UI controls
        for (const cc in this.state) {
          const control = this.uiControls.get(Number(cc));
          if (control?.set) {
            control.set(this.state[Number(cc)]);
          }
        }
      }

      // Restore locks
      if (data.lockedKnobs) {
        this.lockedKnobs = new Set(data.lockedKnobs);
      }

      // Restore other settings
      if (data.channel !== undefined) {
        midiService.setChannel(data.channel);
      }

      if (data.inclRamp !== undefined) {
        this.inclRamp = data.inclRamp;
      }

      if (data.activeSlot !== undefined) {
        this.currentActiveSlot = data.activeSlot;
      }

      if (data.rampCollapsed !== undefined) {
        this.rampCollapsed = data.rampCollapsed;
      }

      if (data.autoSync !== undefined) {
        this.autoSync = data.autoSync;
      }

      // MIDI output restoration happens separately after MIDI is enabled
      if (data.lastMidiOutId) {
        (window as unknown as { lastMidiOutId: string }).lastMidiOutId = data.lastMidiOutId;
      }

    } catch (e) {
      console.error('Failed to load state:', e);
    }
  }

  // Push all state to pedal
  pushToPedal(done?: () => void): void {
    const ccs = [...CONTROL_CCS].sort((a, b) => a - b);
    let idx = 0;

    const step = () => {
      if (idx >= ccs.length) {
        done?.();
        return;
      }

      const cc = ccs[idx++];
      const control = this.uiControls.get(cc);
      const value = this.state[cc];

      if (control?.type === 'tri') {
        midiService.sendCC(cc, value ?? 1);
      } else if (control?.type === 'dip') {
        midiService.sendCC(cc, value ?? 0);
      } else if (control?.type === 'knob' || control?.type === 'modify') {
        midiService.sendCC(cc, value ?? 64);
      }

      setTimeout(step, 3);
    };

    step();
  }

  // Listeners for state changes
  addListener(callback: StateChangeCallback): void {
    this.listeners.push(callback);
  }

  removeListener(callback: StateChangeCallback): void {
    const idx = this.listeners.indexOf(callback);
    if (idx >= 0) this.listeners.splice(idx, 1);
  }

  private notifyListeners(): void {
    this.listeners.forEach(cb => cb());
  }
}

// Singleton instance
export const stateService = new StateService();
