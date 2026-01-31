import type { MIDIChannel, MIDIValue, CCNumber } from '../types';
import { BLOCKED_CCS } from '../config';

export interface MIDIServiceState {
  access: MIDIAccess | null;
  output: MIDIOutput | null;
  channel: MIDIChannel;
}

type StateChangeCallback = () => void;

class MIDIService {
  private access: MIDIAccess | null = null;
  private output: MIDIOutput | null = null;
  private channel: MIDIChannel = 0;
  private altMenuActive = false;
  private altMenuTimer: ReturnType<typeof setTimeout> | null = null;
  private onStateChange: StateChangeCallback | null = null;

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

  setOnStateChange(callback: StateChangeCallback | null): void {
    this.onStateChange = callback;
  }

  async enable(): Promise<boolean> {
    if (!navigator.requestMIDIAccess) {
      console.error('WebMIDI not supported');
      return false;
    }

    try {
      this.access = await navigator.requestMIDIAccess({ sysex: true });
      this.access.onstatechange = () => this.onStateChange?.();
      return true;
    } catch (e) {
      console.error('MIDI Access denied:', e);
      return false;
    }
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

  setChannel(channel: MIDIChannel): void {
    this.channel = channel;
  }

  private sendRaw(data: number[]): void {
    this.output?.send(data);
  }

  sendCC(cc: CCNumber, value: MIDIValue): void {
    // Block certain CCs (like tap tempo which is handled separately)
    if (BLOCKED_CCS.has(cc)) return;
    this.sendRaw([0xB0 + this.channel, cc, value]);
  }

  sendCCRaw(cc: CCNumber, value: MIDIValue): void {
    // Send without blocking check (for special cases like tap tempo)
    this.sendRaw([0xB0 + this.channel, cc, value]);
  }

  sendPC(program: number): void {
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
