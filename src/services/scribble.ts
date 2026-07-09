import type { ScribbleConfig, ScribblePresetEntry } from '../types';
import { presetService } from './presets';
import { midiService } from './midi';

// Pirate MIDI Scribble compatibility layer.
// The Scribble sits between this app and the pedal and holds a 128-entry
// preset list. We only ever write preset names into a config; all device
// settings come from an imported config (or the default template below).

const SCRIBBLE_PRESET_COUNT = 128;
const SCRIBBLE_NAME_MAX = 12; // display limit for bankName on the device
const LIBRARY_SLOTS = 121;    // app slots 1-121 map to entries 0-120 (122 is the swap buffer)

// Defaults captured from a Scribble editor export (firmware 0.1.5).
const DEFAULT_DEVICE_SETTINGS = {
  deviceModel: 'Scribble',
  firmwareVersion: '0.1.5',
  hardwareVersion: '1.x.0',
  deviceName: 'Scribble',
  uId: 10359708,
  profileId: 0,
};

const DEFAULT_GLOBAL_SETTINGS = {
  deviceName: 'L+F',
  currentBank: 0,
  lightMode: 'dark',
  mainColour: 12779430,
  textColour: 0,
  displayBrightness: 100,
  midiChannel: 4,
  globalBpm: 120,
  midiOutPortMode: 'midiOutB',
  bankPcMidiOutputs: { usbd: 4, ble: 4, midi1: 4 },
  clockMode: 'none',
  clockDisplayType: 'bpm',
  tapTempoQuant: 'none',
  usbdThruHandles: { usbd: true, ble: true, midi1: true },
  bleThruHandles: { usbd: true, ble: true, midi1: true },
  midi1ThruHandles: { usbd: true, ble: true, midi1: true },
  midiClockOutHandles: { usbd: true, ble: true, midi1: true },
  switches: [
    {
      mode: 'pressPresetDown',
      pressMessages: { numMessages: 0, messages: [] },
      holdMessages: { numMessages: 0, messages: [] },
    },
    {
      mode: 'pressPresetUp',
      pressMessages: { numMessages: 0, messages: [] },
      holdMessages: { numMessages: 0, messages: [] },
    },
  ],
  customMessages: { numMessages: 0, messages: [] },
  presetUpCC: 1,
  presetDownCC: 2,
  goToPresetCC: 3,
  globalCustomMessagesCC: 17,
  presetCustomMessagesCC: 16,
  midiValueDisplay: 'barPercent',
  midiValueDisplayCC: 0,
  wirelessType: 'ble',
  bleMode: 'server',
  mainTextResize: true,
  zeroIndexBanks: true,
  kemperPlayerMode: false,
  useStaticIp: false,
  staticIp: '0.0.0.0',
  gatewayIp: '0.0.0.0',
};

// Names follow the device's zero-indexed display (zeroIndexBanks: true),
// so app slot N is shown as preset N-1.
function defaultPresetName(slot: number): string {
  return `Preset ${slot - 1}`;
}

function defaultPresetEntry(slot: number): ScribblePresetEntry {
  return {
    bankId: 0,
    bankName: defaultPresetName(slot),
    secondaryText: '',
    colourOverride: false,
    colour: 0,
    textColourOverride: false,
    textColour: 0,
    midiValueDisplayOverride: false,
    midiValueDisplay: 'none',
    midiValueDisplayCC: 0,
    bpm: 120,
    switches: [
      {
        pressMessages: { numMessages: 0, messages: [] },
        holdMessages: { numMessages: 0, messages: [] },
      },
      {
        pressMessages: { numMessages: 0, messages: [] },
        holdMessages: { numMessages: 0, messages: [] },
      },
    ],
    customMessages: { numMessages: 0, messages: [] },
    presetMessages: { numMessages: 0, messages: [] },
  };
}

class ScribbleService {
  buildDefaultConfig(): ScribbleConfig {
    const globalSettings = JSON.parse(JSON.stringify(DEFAULT_GLOBAL_SETTINGS));

    // Scribble configs use display convention (1-16); the app stores 0-15
    const channel = midiService.currentChannel + 1;
    globalSettings.midiChannel = channel;
    globalSettings.bankPcMidiOutputs = { usbd: channel, ble: channel, midi1: channel };

    return {
      deviceSettings: { ...DEFAULT_DEVICE_SETTINGS },
      globalSettings,
      presetSettings: Array.from({ length: SCRIBBLE_PRESET_COUNT }, (_, i) => defaultPresetEntry(i + 1)),
    };
  }

  // Overwrites bankName for entries mapped to library slots 1-121.
  // Occupied slots take the library name; empty slots reset to the device
  // default so the device list mirrors the library exactly. Entries beyond
  // the library range and all other fields are left untouched.
  applyLibraryNames(config: ScribbleConfig): ScribbleConfig {
    const meta = presetService.getMeta();
    const count = Math.min(config.presetSettings.length, LIBRARY_SLOTS);

    for (let i = 0; i < count; i++) {
      const slot = i + 1;
      const m = meta[slot];
      const name = m?.occupied && m.name?.trim()
        ? m.name.trim().slice(0, SCRIBBLE_NAME_MAX)
        : defaultPresetName(slot);
      config.presetSettings[i].bankName = name;
    }

    return config;
  }

  validate(obj: unknown): ScribbleConfig {
    const cfg = obj as ScribbleConfig;
    if (!cfg || typeof cfg !== 'object' || !Array.isArray(cfg.presetSettings)) {
      throw new Error('Not a Scribble config: missing presetSettings.');
    }
    if (!cfg.presetSettings.every(p => p && typeof p === 'object' && typeof p.bankName === 'string')) {
      throw new Error('Not a Scribble config: malformed preset entries.');
    }
    return cfg;
  }

  exportDefault(): void {
    this.download(this.applyLibraryNames(this.buildDefaultConfig()));
  }

  async exportMerged(file: File): Promise<void> {
    const cfg = this.validate(JSON.parse(await file.text()));
    this.download(this.applyLibraryNames(cfg));
  }

  private download(config: ScribbleConfig): void {
    const rawName = config.globalSettings?.deviceName;
    const base = (typeof rawName === 'string' && rawName.trim() ? rawName : 'Scribble')
      .replace(/[^a-z0-9]+/gi, '_');
    const ts = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');

    // Compact JSON, matching the Scribble editor's own export format
    const json = JSON.stringify(config);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
    const a = document.createElement('a');
    a.href = dataUri;
    a.download = `${base}_${ts}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}

// Singleton instance
export const scribbleService = new ScribbleService();
