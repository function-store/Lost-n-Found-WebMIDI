import type { MIDIChannel, MIDIValue, CCNumber } from '../types';
import { BLOCKED_CCS } from '../config';

export interface MIDIServiceState {
  access: MIDIAccess | null;
  output: MIDIOutput | null;
  channel: MIDIChannel;
}

type StateChangeCallback = () => void;

// Minimum gap between outgoing CC bursts. Values arriving faster than this
// (e.g. knob drags at mouse polling rate) are coalesced per-CC, latest wins,
// so the pedal never has to drain a backlog of stale intermediate values.
// The pedal firmware processes CCs slower than the wire carries them, so
// this must stay at or below the device's real intake rate.
const DEFAULT_CC_THROTTLE_MS = 60;

class MIDIService {
  private access: MIDIAccess | null = null;
  private output: MIDIOutput | null = null;
  private input: MIDIInput | null = null;
  private onProgramChange: ((program: number) => void) | null = null;
  private channel: MIDIChannel = 0;
  private altMenuActive = false;
  private altMenuTimer: ReturnType<typeof setTimeout> | null = null;
  private onStateChange: StateChangeCallback | null = null;
  private pendingCC: Map<CCNumber, MIDIValue> = new Map();
  private ccThrottleTimer: ReturnType<typeof setTimeout> | null = null;
  private ccThrottleMs = DEFAULT_CC_THROTTLE_MS;

  get ccThrottleInterval(): number {
    return this.ccThrottleMs;
  }

  setCCThrottleInterval(ms: number): void {
    this.ccThrottleMs = Math.max(0, Math.min(500, ms));
  }

  get isEnabled(): boolean {
    return this.access !== null;
  }

  get currentOutput(): MIDIOutput | null {
    return this.output;
  }

  get currentChannel(): MIDIChannel {
    return this.channel;
  }

  get outputId(): string | null {
    return this.output?.id ?? null;
  }

  get inputId(): string | null {
    return this.input?.id ?? null;
  }

  setOnProgramChange(callback: ((program: number) => void) | null): void {
    this.onProgramChange = callback;
  }

  setOnStateChange(callback: StateChangeCallback | null): void {
    this.onStateChange = callback;
  }

  async enable(): Promise<boolean> {
    if (!navigator.requestMIDIAccess) {
      console.error('WebMIDI not supported');
      return false;
    }

    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });
      this.access.onstatechange = () => this.onStateChange?.();
      return true;
    } catch (e) {
      console.error('MIDI Access denied:', e);
      return false;
    }
  }

  disable(): void {
    if (this.access) {
      this.access.onstatechange = null;
      this.access = null;
    }
    this.output = null;
    this.detachInput();
    if (this.ccThrottleTimer) {
      clearTimeout(this.ccThrottleTimer);
      this.ccThrottleTimer = null;
    }
    this.pendingCC.clear();
    this.onStateChange?.();
  }

  getOutputs(): MIDIOutput[] {
    if (!this.access) return [];
    return Array.from(this.access.outputs.values());
  }

  selectOutput(id: string): boolean {
    if (!this.access) return false;
    const output = this.access.outputs.get(id);
    if (output) {
      this.output = output;
      return true;
    }
    return false;
  }

  selectFirstOutput(): boolean {
    const outputs = this.getOutputs();
    if (outputs.length > 0) {
      this.output = outputs[0];
      return true;
    }
    return false;
  }

  // MIDI input: the editor follows incoming Program Changes on its channel
  getInputs(): MIDIInput[] {
    if (!this.access) return [];
    return Array.from(this.access.inputs.values());
  }

  selectInput(id: string): boolean {
    this.detachInput();
    if (!this.access || !id) return false;
    const input = this.access.inputs.get(id);
    if (input) {
      this.input = input;
      input.onmidimessage = this.handleMessage;
      return true;
    }
    return false;
  }

  private detachInput(): void {
    if (this.input) {
      this.input.onmidimessage = null;
      this.input = null;
    }
  }

  private handleMessage = (e: MIDIMessageEvent): void => {
    const data = e.data;
    if (!data || data.length < 2) return;
    const status = data[0];
    // Program Change on our channel (0xC0-0xCF)
    if ((status & 0xF0) === 0xC0 && (status & 0x0F) === this.channel) {
      this.onProgramChange?.(data[1]);
    }
  };

  setChannel(channel: MIDIChannel): void {
    this.channel = channel;
  }

  private sendRaw(data: number[]): void {
    this.output?.send(data);
  }

  sendCC(cc: CCNumber, value: MIDIValue): void {
    // Block certain CCs (like tap tempo which is handled separately)
    if (BLOCKED_CCS.has(cc)) return;
    this.pendingCC.set(cc, value);
    if (this.ccThrottleTimer === null) {
      // Idle: send right away for responsiveness, then gate further sends
      this.flushPendingCC();
      this.scheduleCCFlush();
    }
  }

  // Sends queued CC values in insertion order (Map preserves it), so
  // cross-CC ordering like "knob values before store command" holds.
  private flushPendingCC(): void {
    for (const [cc, value] of this.pendingCC) {
      this.sendRaw([0xB0 + this.channel, cc, value]);
    }
    this.pendingCC.clear();
  }

  private scheduleCCFlush(): void {
    this.ccThrottleTimer = setTimeout(() => {
      this.ccThrottleTimer = null;
      if (this.pendingCC.size > 0) {
        this.flushPendingCC();
        this.scheduleCCFlush();
      }
    }, this.ccThrottleMs);
  }

  sendCCRaw(cc: CCNumber, value: MIDIValue): void {
    // Send without blocking check or throttling (for timing-sensitive
    // special cases like tap tempo and the alt-menu latch)
    this.sendRaw([0xB0 + this.channel, cc, value]);
  }

  sendPC(program: number): void {
    // Flush queued CCs first so a program change never overtakes them
    this.flushPendingCC();
    this.sendRaw([0xC0 + this.channel, program]);
  }

  ensureAltMenu(): void {
    if (!this.altMenuActive) {
      this.sendCCRaw(104, 127);
      this.altMenuActive = true;
    }
    if (this.altMenuTimer) clearTimeout(this.altMenuTimer);
    this.altMenuTimer = setTimeout(() => {
      this.sendCCRaw(104, 0);
      this.altMenuActive = false;
    }, 650);
  }

  // Tap tempo handling
  sendTap(): void {
    this.sendCCRaw(93, 127);
  }

  // Engage toggles
  setEngage(side: 'L' | 'R', on: boolean): void {
    const cc = side === 'L' ? 103 : 102;
    this.sendCC(cc, on ? 1 : 0);
  }

  // Store preset
  storeToSlot(slot: number): void {
    this.sendCC(111, Math.max(0, Math.min(127, slot)));
  }

  // Utility: Delay helper for async operations
  delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const midiService = new MIDIService();
