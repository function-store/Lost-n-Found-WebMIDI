import type { ScribbleConfig, ScribblePresetEntry } from '../types';
import { presetService } from './presets';
import { midiService } from './midi';

// Pirate MIDI Scribble compatibility layer.
// The Scribble sits between this app and the pedal and holds a 128-entry
// preset list. We only ever write preset names into a config; all device
// settings come from an imported config (or the default template below).

const SCRIBBLE_PRESET_COUNT = 128;
// Observed display cutoff for bankName (with mainTextResize on); anything
// past this is spilled into secondaryText so the full name stays readable.
const SCRIBBLE_NAME_MAX = 14;
// Entry 0 is the reserved #live preset; app slots 1-121 map to entries 1-121.
// With zeroIndexBanks the device displays entry N as preset N, so slot
// numbers line up with the on-device numbering. App slot 122 is the swap
// buffer and its entry is labelled #swap.
const LIBRARY_SLOTS = 121;
const BUFFER_SLOT = 122;

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
  midiClockOutHandles: { usbd: false, ble: false, midi1: false },
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

function defaultPresetEntry(index: number): ScribblePresetEntry {
  const isLive = index === 0;
  const isBuffer = index === BUFFER_SLOT;
  return {
    bankId: 0,
    bankName: isLive ? '#live' : isBuffer ? '#swap' : `Preset ${index}`,
    secondaryText: isLive ? 'live' : isBuffer ? 'swap' : '',
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
      presetSettings: Array.from({ length: SCRIBBLE_PRESET_COUNT }, (_, i) => defaultPresetEntry(i)),
    };
  }

  // Overwrites bankName/secondaryText for entries mapped to library slots
  // (slot N -> entry N). Occupied slots take the full library name, with any
  // overflow past the display cutoff repeated in secondaryText; empty slots
  // reset to the device default so the device list mirrors the library
  // exactly. Entry 0 (#live), entries beyond the library range and all other
  // fields are left untouched.
  applyLibraryNames(config: ScribbleConfig): ScribbleConfig {
    const meta = presetService.getMeta();
    const last = Math.min(config.presetSettings.length - 1, LIBRARY_SLOTS);

    for (let slot = 1; slot <= last; slot++) {
      const m = meta[slot];
      const name = m?.occupied && m.name?.trim() ? m.name.trim() : `Preset ${slot}`;
      config.presetSettings[slot].bankName = name;
      config.presetSettings[slot].secondaryText = name.slice(SCRIBBLE_NAME_MAX).trim();
    }

    // Mark the app's swap-buffer slot so it is identifiable on the device
    if (config.presetSettings.length > BUFFER_SLOT) {
      config.presetSettings[BUFFER_SLOT].bankName = '#swap';
      config.presetSettings[BUFFER_SLOT].secondaryText = 'swap';
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
