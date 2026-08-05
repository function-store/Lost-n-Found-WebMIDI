import type { PresetMetadata, PresetMetadataStore, ExportedPreset, MIDIChannel } from '../types';
import { CONTROL_CCS } from '../config';
import { stateService } from './state';
import { midiService } from './midi';
import { showAlert } from '../components/Dialog';

const META_KEY = 'lostFound_presetMeta';
const MAX_SLOTS = 122;

class PresetService {
  // Metadata management
  getMeta(): PresetMetadataStore {
    try {
      return JSON.parse(localStorage.getItem(META_KEY) || '{}');
    } catch {
      return {};
    }
  }

  setMeta(data: PresetMetadataStore): void {
    localStorage.setItem(META_KEY, JSON.stringify(data));
  }

  getSlotMeta(slot: number): PresetMetadata {
    const meta = this.getMeta();
    return meta[slot] || { name: '', occupied: false };
  }

  setSlotMeta(slot: number, meta: PresetMetadata): void {
    const allMeta = this.getMeta();
    allMeta[slot] = meta;
    this.setMeta(allMeta);
  }

  // Preset operations
  recall(slot: number): void {
    stateService.currentActiveSlot = slot;
    midiService.sendPC(slot);

    // Restore UI state from metadata (silently)
    const meta = this.getMeta();
    const storedState = meta[slot]?.data;

    if (storedState) {
      Object.entries(storedState).forEach(([cc, val]) => {
        // Essential: Pass false to prevent sending MIDI back to the pedal
        // since the PC message handled the hardware side.
        stateService.set(Number(cc), val as number, false);
      });
    }
  }

  store(slot: number, name: string, syncFirst = false, callback?: () => void): void {
    const meta = this.getMeta();
    // Save current state with the preset
    meta[slot] = {
      name,
      occupied: true,
      data: stateService.getAll()
    };
    this.setMeta(meta);

    stateService.currentActiveSlot = slot;

    if (midiService.isEnabled) {
      const doStore = () => {
        midiService.storeToSlot(slot);
        callback?.();
      };

      if (syncFirst) {
        stateService.pushToPedal(doStore);
      } else {
        doStore();
      }
    } else {
      console.log('Metadata saved locally, but MIDI not active for hardware store.');
      callback?.();
    }
  }

  // Export/Import
  snapshotPreset(): ExportedPreset {
    const preset: ExportedPreset = {
      app: 'Lost+Found MIDI Editor',
      build: document.getElementById('buildBadge')?.textContent || '',
      ts: new Date().toISOString(),
      channel: midiService.currentChannel,
      slot: stateService.currentActiveSlot,
      lockMix: stateService.isLocked(15),
      lEngage: stateService.get(103) === 1,
      rEngage: stateService.get(102) === 1,
      ccs: {}
    };

    CONTROL_CCS.forEach(cc => {
      preset.ccs[String(cc)] = stateService.get(cc);
    });

    return preset;
  }

  downloadJSON(obj: object, filename: string): void {
    const json = JSON.stringify(obj, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
    const a = document.createElement('a');
    a.href = dataUri;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  exportPreset(): void {
    const obj = this.snapshotPreset();
    const safeTs = obj.ts.replace(/[:.]/g, '-');
    this.downloadJSON(obj, `lost-found-preset-${safeTs}.json`);
  }

  exportSlot(slot: number): void {
    const meta = this.getSlotMeta(slot);
    if (!meta.occupied || !meta.data) {
      showAlert('Slot is empty.');
      return;
    }

    const preset: ExportedPreset = {
      app: 'Lost+Found MIDI Editor (Stored Slot)',
      build: document.getElementById('buildBadge')?.textContent || '',
      ts: new Date().toISOString(),
      channel: midiService.currentChannel,
      slot: slot,
      lockMix: meta.data[55] === 127, // CC55 mirrors the Mix lock state
      lEngage: meta.data[103] === 1,
      rEngage: meta.data[102] === 1,
      ccs: {}
    };

    Object.entries(meta.data).forEach(([cc, val]) => {
      preset.ccs[cc] = val;
    });

    const safeName = (meta.name || 'preset').replace(/[^a-z0-9]/gi, '_').toLowerCase();
    this.downloadJSON(preset, `lost-found-${slot}-${safeName}.json`);
  }

  applyPreset(preset: ExportedPreset): void {
    if (!preset || typeof preset !== 'object') {
      throw new Error('Invalid preset.');
    }

    const ccs = preset.ccs || {};

    // Restore channel
    if (preset.channel !== undefined) {
      const ch = Number(preset.channel);
      if (Number.isFinite(ch) && ch >= 0 && ch <= 15) {
        midiService.setChannel(ch as MIDIChannel);
      }
    }

    // Restore slot
    if (preset.slot !== undefined) {
      stateService.currentActiveSlot = Number(preset.slot);
    }

    // Apply CC values
    CONTROL_CCS.forEach(cc => {
      const key = String(cc);
      if (!(key in ccs)) return;
      const v = Math.max(0, Math.min(127, Number(ccs[key]) || 0));
      stateService.set(cc, v, false); // Don't send MIDI yet
    });

    // Restore locks via CC55 so the lock icon stays in sync
    if (typeof preset.lockMix === 'boolean') {
      stateService.set(55, preset.lockMix ? 127 : 0, false);
    }

    // Push to pedal if MIDI enabled
    if (midiService.isEnabled) {
      stateService.pushToPedal();
      midiService.setEngage('L', preset.lEngage);
      midiService.setEngage('R', preset.rEngage);
    }
  }

  async importPreset(file: File): Promise<void> {
    const text = await file.text();
    const obj = JSON.parse(text) as ExportedPreset;
    this.applyPreset(obj);
  }

  exportMeta(): void {
    this.downloadJSON(this.getMeta(), 'lost-found-metadata-backup.json');
  }

  async importMeta(file: File): Promise<void> {
    const data = JSON.parse(await file.text()) as PresetMetadataStore;
    this.setMeta(data);
  }

  // Slot swap (uses slot 122 as buffer)
  async swapSlots(slotA: number, slotB: number, onProgress?: (step: string) => void): Promise<void> {
    if (!midiService.isEnabled || !midiService.currentOutput) {
      throw new Error('MIDI not enabled');
    }

    if (slotA < 1 || slotA > MAX_SLOTS || slotB < 1 || slotB > MAX_SLOTS || slotA === slotB) {
      throw new Error('Invalid slots');
    }

    const delay = (ms: number) => midiService.delay(ms);

    // Step 1: Load A, save to buffer (122)
    onProgress?.('1/6: Buffering A...');
    midiService.sendPC(slotA);
    await delay(1200);
    midiService.storeToSlot(122);
    await delay(1200);

    // Step 2: Load B, save to A
    onProgress?.('3/6: Moving B->A...');
    midiService.sendPC(slotB);
    await delay(1200);
    midiService.storeToSlot(slotA);
    await delay(1200);

    // Step 3: Load buffer, save to B
    onProgress?.('5/6: Moving Buf->B...');
    midiService.sendPC(122);
    await delay(1200);
    midiService.storeToSlot(slotB);
    await delay(1200);

    // Swap metadata
    const meta = this.getMeta();
    const dataA = meta[slotA] || {};
    const dataB = meta[slotB] || {};
    meta[slotA] = dataB;
    meta[slotB] = dataA;
    this.setMeta(meta);

    // Return to slot A
    stateService.currentActiveSlot = slotA;
    midiService.sendPC(slotA);

    onProgress?.('Done!');
  }

  get maxSlots(): number {
    return MAX_SLOTS;
  }
}

// Singleton instance
export const presetService = new PresetService();
