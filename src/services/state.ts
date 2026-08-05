import type { EditorState, SavedEditorState, CCNumber, MIDIValue, UIControl, UIControlType } from '../types';
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
  autoRecall = false;
  newFirmware: boolean | null = null;
  headerDismissed = false;

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

  // Repaint every lock icon from the actual lock state
  private syncLockIcons(): void {
    this.uiControls.forEach((control, cc) => {
      if (!control.lockIcon) return;
      const locked = this.lockedKnobs.has(cc);
      control.lockIcon.innerHTML = locked ? '🔒' : '🔓';
      control.lockIcon.classList.toggle('locked', locked);
    });
  }

  // Knob default value
  getKnobDefault(cc: CCNumber): MIDIValue {
    const defaults = KNOBS.defaults as Record<string, number>;
    return defaults[String(cc)] ?? defaults.default ?? 64;
  }

  // Reset every control to its fresh-load default position.
  // Locked controls are left alone, same contract as randomize/recall.
  resetToDefaults(): void {
    this.uiControls.forEach((control, cc) => {
      if (cc === 55) return; // mix-lock companion CC, follows the lock state
      if (this.lockedKnobs.has(cc)) return;
      if (cc === 33 && this.newFirmware !== true) return;
      this.set(cc, this.getResetDefault(cc, control.type));
    });
  }

  private getResetDefault(cc: CCNumber, type: UIControlType): MIDIValue {
    const defaults = KNOBS.defaults as Record<string, number>;
    const explicit = defaults[String(cc)];
    if (explicit !== undefined) return explicit;
    if (cc === 21) return 1; // L FX: Reverb
    if (cc === 23) return 4; // R FX build default (see TriBlock)
    if (cc === 52) return 127; // Ramp enable is inverted: 127 = stopped
    if (type === 'knob' || type === 'modify' || type === 'slider') {
      return defaults.default ?? 64;
    }
    return 0;
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
      lastMidiInId: midiService.inputId,
      rampCollapsed: this.rampCollapsed,
      autoSync: this.autoSync,
      autoRecall: this.autoRecall,
      newFirmware: this.newFirmware,
      headerDismissed: this.headerDismissed,
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
        // Update all UI controls (wrapped in try-catch to prevent errors from blocking critical settings)
        for (const cc in this.state) {
          const control = this.uiControls.get(Number(cc));
          if (control?.set) {
            try {
              control.set(this.state[Number(cc)]);
            } catch (e) {
              console.warn(`Failed to set UI control for CC ${cc}:`, e);
            }
          }
        }
      }

      // Restore locks. This happens after the state loop above (which may have
      // touched locks via the CC55 handler), so the saved lock list wins;
      // reconcile the Mix-lock CC and repaint icons to match.
      if (data.lockedKnobs) {
        this.lockedKnobs = new Set(data.lockedKnobs);
      }
      this.state[55] = this.lockedKnobs.has(15) ? 127 : 0;
      this.syncLockIcons();

      // Restore other settings (these should always work even if UI updates fail)
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

      if (data.autoRecall !== undefined) {
        this.autoRecall = data.autoRecall;
      }

      if (data.newFirmware !== undefined) {
        this.newFirmware = data.newFirmware;
      }

      if (data.headerDismissed !== undefined) {
        this.headerDismissed = data.headerDismissed;
      }

      // MIDI port restoration happens separately after MIDI is enabled
      if (data.lastMidiOutId) {
        (window as unknown as { lastMidiOutId: string }).lastMidiOutId = data.lastMidiOutId;
      }

      if (data.lastMidiInId) {
        (window as unknown as { lastMidiInId: string }).lastMidiInId = data.lastMidiInId;
      }

    } catch (e) {
      console.error('Failed to load state:', e);
    }
  }

  // Push all state to pedal
  pushToPedal(done?: () => void): void {
    // Resonator mode (CC33) only exists on the new firmware
    const ccs = [...CONTROL_CCS]
      .filter(cc => cc !== 33 || this.newFirmware === true)
      .sort((a, b) => a - b);
    let idx = 0;

    const step = () => {
      if (idx >= ccs.length) {
        done?.();
        return;
      }

      const cc = ccs[idx++];
      const control = this.uiControls.get(cc);
      const value = this.state[cc];

      // If we have a stored value, push it.
      // Use fallback defaults only if value is absolutely missing.
      if (value !== undefined) {
        midiService.sendCC(cc, value);
      } else if (control) {
        // Fallback defaults based on type
        if (control.type === 'tri') {
          midiService.sendCC(cc, 1);
        } else if (control.type === 'knob' || control.type === 'modify' || control.type === 'slider') {
          midiService.sendCC(cc, 64);
        } else {
          midiService.sendCC(cc, 0);
        }
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
