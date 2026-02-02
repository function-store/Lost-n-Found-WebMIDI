import { stateService } from './state';
import { midiService } from './midi';
import { KNOB_CCS, HIDDEN_CCS, DIP_CCS, NEVER_RANDOM_CCS, RAMP_CCS, COLUMN_KNOBS } from '../config';
import { triValueForCC, randomMIDI } from '../utils/helpers';
import type { Side, CCNumber } from '../types';

class RandomizerService {
  // Randomize knobs only
  randomizeKnobs(includeRamp: boolean): void {
    if (!midiService.isEnabled) {
      alert('Enable MIDI first.');
      return;
    }

    // Randomize main knobs
    KNOB_CCS.forEach(cc => {
      if (stateService.isLocked(cc) || NEVER_RANDOM_CCS.has(cc)) return;

      const control = stateService.getControl(cc);
      if (control?.type !== 'knob' && control?.type !== 'modify') return;

      // Avoid 58-69 range for Modify knobs (NONE/blanking zone)
      const v = (cc === 17 || cc === 19)
        ? randomMIDI(58, 69)
        : randomMIDI();

      stateService.set(cc, v);
    });

    // Randomize ramp controls if included
    if (includeRamp) {
      this.randomizeRampControls();
    }
  }

  // Randomize all (knobs + types + routing + settings)
  randomizeAll(includeRamp: boolean): void {
    if (!midiService.isEnabled) {
      alert('Enable MIDI first.');
      return;
    }

    // 1. Randomize knobs
    KNOB_CCS.forEach(cc => {
      if (stateService.isLocked(cc) || NEVER_RANDOM_CCS.has(cc)) return;

      const control = stateService.getControl(cc);
      if (control?.type !== 'knob' && control?.type !== 'modify') return;

      const v = (cc === 17 || cc === 19)
        ? randomMIDI(58, 69)
        : randomMIDI();

      stateService.set(cc, v);
    });

    // 2. Randomize FX Types (21, 23) & Routing (22)
    [21, 22, 23].forEach(cc => {
      if (stateService.isLocked(cc)) return;
      const v = triValueForCC(cc, Math.floor(Math.random() * 3) as 0 | 1 | 2);
      stateService.set(cc, v);
    });

    // 3. Randomize Swaps (74, 75)
    [74, 75].forEach(cc => {
      const v = Math.random() < 0.5 ? 0 : 127;
      stateService.set(cc, v);
    });

    // 4. Randomize Hidden & DIPs (excluding specific ones)
    const ALL_OTHER_CCS = [...HIDDEN_CCS, ...DIP_CCS];
    ALL_OTHER_CCS.forEach(cc => {
      if (NEVER_RANDOM_CCS.has(cc)) return;
      if (RAMP_CCS.has(cc) && !includeRamp) return;

      const control = stateService.getControl(cc);

      if (control?.type === 'tri') {
        const v = triValueForCC(cc, Math.floor(Math.random() * 3) as 0 | 1 | 2);
        stateService.set(cc, v);
      } else if (control?.type === 'dip' || control?.type === 'other') {
        // Subdivisions (53, 54) -> range 0-12
        if (cc === 53 || cc === 54) {
          const v = Math.floor(Math.random() * 13);
          stateService.set(cc, v);
        } else {
          const v = Math.random() < 0.5 ? 0 : 127;
          stateService.set(cc, v);
        }
      }
    });

    // 5. Randomize Ramp if included
    if (includeRamp) {
      this.randomizeRampControls();
    }
  }

  // Randomize a specific column (left or right)
  randomizeColumn(side: Side): void {
    const knobs = side === 'L' ? COLUMN_KNOBS.left : COLUMN_KNOBS.right;

    knobs.forEach((cc: CCNumber) => {
      if (stateService.isLocked(cc) || NEVER_RANDOM_CCS.has(cc)) return;
      const v = randomMIDI();
      stateService.set(cc, v);
    });
  }

  // Randomize ramp controls
  private randomizeRampControls(): void {
    RAMP_CCS.forEach(cc => {
      if (NEVER_RANDOM_CCS.has(cc) || stateService.isLocked(cc)) return;
      const control = stateService.getControl(cc);
      if (!control?.set) return;

      let v: number;
      if (control.type === 'knob' || control.type === 'slider') {
        v = randomMIDI();
      } else if (control.type === 'tri') {
        v = triValueForCC(cc, Math.floor(Math.random() * 3) as 0 | 1 | 2);
      } else {
        v = Math.random() < 0.5 ? 0 : 127;
      }

      stateService.set(cc, v);
    });
  }
}

// Singleton instance
export const randomizerService = new RandomizerService();
