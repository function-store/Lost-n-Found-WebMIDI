import type { CCNumber, MIDIValue, KnobKind, UIControl } from '../types';
import { stateService } from '../services/state';
import { valueToDegrees, valueToPercent, getVariantFromModify, createElement, clampMIDI } from '../utils/helpers';
import { KNOB_RAMP_MAP, LOCKABLE_CCS } from '../config';

interface KnobOptions {
  label: string;
  cc: CCNumber;
  kind: KnobKind;
  rampCC?: CCNumber;
  onUpdateReadout?: () => void;
}

export function createKnobBlock(options: KnobOptions, parentEl: HTMLElement): void {
  const { label, cc, kind, onUpdateReadout } = options;
  const rampCC = KNOB_RAMP_MAP[String(cc)] || options.rampCC;

  // Initialize state with default
  const defaultValue = stateService.getKnobDefault(cc);
  stateService.set(cc, defaultValue, false);

  const block = createElement('div', 'knobBlock');

  // Label row
  const labRow = createElement('div');
  labRow.style.cssText = 'display:flex;justify-content:space-between;align-items:flex-start;width:100%';

  // Left group (Label + Lock)
  const leftGroup = createElement('div');
  leftGroup.style.cssText = 'display:flex;flex-direction:column;align-items:flex-start;gap:2px';
  labRow.appendChild(leftGroup);

  const lab = createElement('div', 'kLabel');
  lab.textContent = label;
  leftGroup.appendChild(lab);

  // Right group (Ramp)
  const rightGroup = createElement('div');
  rightGroup.style.cssText = 'display:flex;align-items:center';
  labRow.appendChild(rightGroup);

  // Ramp toggle
  if (rampCC) {
    const rampLabel = createElement('label', 'rampToggleInline');
    rampLabel.innerHTML = `<input type="checkbox" id="ramp${cc}"> Ramp`;

    const rampCheck = rampLabel.querySelector('input') as HTMLInputElement;
    rampCheck.addEventListener('change', () => {
      const v = rampCheck.checked ? 127 : 0;
      stateService.set(rampCC, v);
    });

    stateService.registerControl(rampCC, {
      type: 'dip',
      set(v: MIDIValue) {
        rampCheck.checked = Number(v) === 127;
      }
    });

    rightGroup.appendChild(rampLabel);
  }

  // Lock toggle for lockable knobs
  if (LOCKABLE_CCS.includes(cc)) {
    const lockBtn = createElement('button', 'lockIconBtn');
    const isLocked = stateService.isLocked(cc);
    lockBtn.innerHTML = isLocked ? '🔒' : '🔓';
    lockBtn.title = isLocked ? 'Locked' : 'Unlocked';
    lockBtn.classList.toggle('locked', isLocked);

    lockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const newState = !stateService.isLocked(cc);
      stateService.setLocked(cc, newState);
      lockBtn.innerHTML = newState ? '🔒' : '🔓';
      lockBtn.title = newState ? 'Locked' : 'Unlocked';
      lockBtn.classList.toggle('locked', newState);

      // Special hardware handling for Mix (CC 15) -> Lock Mix (CC 55)
      if (cc === 15) {
        stateService.set(55, newState ? 127 : 0);
      }
    });

    // Register UI for Mix lock CC (CC 55)
    if (cc === 15) {
      stateService.registerControl(55, {
        type: 'dip',
        set(v: MIDIValue) {
          const checked = Number(v) === 127;
          stateService.setLocked(15, checked);
          lockBtn.innerHTML = checked ? '🔒' : '🔓';
          lockBtn.classList.toggle('locked', checked);
        }
      });
    }

    leftGroup.appendChild(lockBtn);
  }

  // Value display
  const val = createElement('div', 'kValue');
  val.textContent = '50%';

  // Knob element
  const knob = createElement('div', 'knob');
  const dial = createElement('div', 'dial');
  const center = createElement('div', 'dialCenter');
  dial.appendChild(center);

  const rot = createElement('div', 'rot');
  const indicator = createElement('div', 'indicator');
  rot.appendChild(indicator);

  knob.appendChild(dial);
  knob.appendChild(rot);

  // Set function
  const set = (v: MIDIValue) => {
    v = clampMIDI(v);
    rot.style.transform = `rotate(${valueToDegrees(v)}deg)`;
    const pct = valueToPercent(v);

    if (kind === 'modify') {
      const tag = getVariantFromModify(v);
      val.textContent = `${tag} • ${pct}`;
      onUpdateReadout?.();
    } else {
      val.textContent = pct;
    }
  };

  set(stateService.get(cc));

  // Drag handling
  let dragging = false;
  knob.addEventListener('mousedown', () => dragging = true);
  window.addEventListener('mouseup', () => dragging = false);
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const currentVal = stateService.get(cc) ?? 64;
    const newVal = clampMIDI(currentVal - e.movementY);
    stateService.set(cc, newVal);
    set(newVal);
  });

  // Double-click to reset
  knob.addEventListener('dblclick', () => {
    const neutral = 64;
    stateService.set(cc, neutral);
    set(neutral);
  });

  // Register UI control
  const control: UIControl = { type: kind === 'modify' ? 'modify' : 'knob', set };
  stateService.registerControl(cc, control);

  // Build layout
  block.appendChild(labRow);
  block.appendChild(knob);

  // Sub-label for effect-specific parameter
  const subLab = createElement('div', 'subLabel');
  block.appendChild(subLab);
  control.subLabel = subLab;

  // Value row with optional modify labels
  const vRow = createElement('div');
  vRow.style.cssText = 'display:flex;align-items:center;justify-content:center;margin-top:2px;width:100%';

  if (kind === 'modify') {
    const lblL = createElement('div', 'modLabel');
    lblL.style.cssText = 'text-align:right;margin-right:6px;flex:1';

    const lblR = createElement('div', 'modLabel');
    lblR.style.cssText = 'text-align:left;margin-left:6px;flex:1';

    vRow.appendChild(lblL);
    vRow.appendChild(val);
    vRow.appendChild(lblR);

    control.labels = { L: lblL, R: lblR };
  } else {
    vRow.appendChild(val);
  }

  block.appendChild(vRow);
  parentEl.appendChild(block);
}
