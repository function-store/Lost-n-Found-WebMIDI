import type { CCNumber, MIDIValue, SubdivisionOption } from '../types';
import { stateService } from '../services/state';
import { createElement } from '../utils/helpers';
import { TOOLTIPS } from '../config';

// Tooltip lookup maps keyed by label
const RAMP_TOOLTIPS: Record<string, string> = {
  'Bounce': TOOLTIPS.ramp.bounce.description,
  'Sweep': TOOLTIPS.ramp.sweep.description,
};

const STEREO_TOOLTIPS: Record<string, string> = {
  'MISO': TOOLTIPS.stereo.miso.description,
  'Spread DIP': TOOLTIPS.stereo.spreadDip.description,
};

const CLOCK_TOOLTIPS: Record<string, string> = {
  'MIDI Clock Follow': TOOLTIPS.clock.midiClockFollow.description,
  'Unsync': TOOLTIPS.clock.unsync.description,
  'L Tap Subdivision': TOOLTIPS.clock.lSubdivision.description,
  'R Tap Subdivision': TOOLTIPS.clock.rSubdivision.description,
};

const DIP_TOOLTIPS: Record<string, string> = {
  'Latch': TOOLTIPS.dip.latch.description,
  'Trails': TOOLTIPS.dip.trails.description,
  'Bank': TOOLTIPS.dip.bank.description,
  'Polarity': TOOLTIPS.dip.polarity.description,
};

// Create a DIP switch row (checkbox)
export function createDipRow(
  name: string,
  cc: CCNumber,
  parentEl: HTMLElement
): void {
  stateService.set(cc, 0, false);

  const row = createElement('div', 'dipRow');

  // Add tooltip
  const tooltip = DIP_TOOLTIPS[name];
  if (tooltip) {
    row.setAttribute('data-tooltip', tooltip);
  }

  const lab = createElement('label');
  lab.textContent = name;

  const cb = createElement('input', 'toggleSwitch') as HTMLInputElement;
  if (name === 'Polarity') cb.classList.add('toggleSwitch--polarity');
  cb.type = 'checkbox';
  cb.addEventListener('change', () => {
    const v = cb.checked ? 127 : 0;
    stateService.set(cc, v);
  });

  stateService.registerControl(cc, {
    type: 'dip',
    set(v: MIDIValue) {
      cb.checked = Number(v) === 127;
    }
  });

  row.appendChild(lab);
  row.appendChild(cb);
  parentEl.appendChild(row);
}

// Create a ramp toggle (Bounce, Sweep, Polarity)
export function createRampToggle(
  name: string,
  cc: CCNumber,
  parentEl: HTMLElement
): void {
  stateService.set(cc, 0, false);

  const toggle = createElement('label', 'rampToggle');

  // Add tooltip
  const tooltip = RAMP_TOOLTIPS[name];
  if (tooltip) {
    toggle.setAttribute('data-tooltip', tooltip);
  }

  const cb = createElement('input', 'toggleSwitch') as HTMLInputElement;
  if (name === 'Sweep') cb.classList.add('toggleSwitch--sweep');
  cb.type = 'checkbox';
  cb.id = `ramp${name}`;
  cb.addEventListener('change', () => {
    const v = cb.checked ? 127 : 0;
    stateService.set(cc, v);
  });

  stateService.registerControl(cc, {
    type: 'dip',
    set(v: MIDIValue) {
      cb.checked = Number(v) === 127;
    }
  });

  toggle.appendChild(cb);
  const span = createElement('span');
  span.textContent = name;
  toggle.appendChild(span);
  parentEl.appendChild(toggle);
}

// Create a stereo toggle (MISO, Spread DIP)
export function createStereoToggle(
  name: string,
  cc: CCNumber,
  parentEl: HTMLElement
): void {
  stateService.set(cc, 0, false);

  const toggle = createElement('label', 'stereoToggle');

  // Add tooltip
  const tooltip = STEREO_TOOLTIPS[name];
  if (tooltip) {
    toggle.setAttribute('data-tooltip', tooltip);
  }

  const cb = createElement('input', 'toggleSwitch') as HTMLInputElement;
  cb.type = 'checkbox';
  cb.id = `stereo${name.replace(/\s+/g, '')}`;
  cb.addEventListener('change', () => {
    const v = cb.checked ? 127 : 0;
    stateService.set(cc, v);
  });

  stateService.registerControl(cc, {
    type: 'dip',
    set(v: MIDIValue) {
      cb.checked = Number(v) === 127;
    }
  });

  toggle.appendChild(cb);
  const span = createElement('span');
  span.textContent = name;
  toggle.appendChild(span);
  parentEl.appendChild(toggle);
}

// Create "Other" checkbox (MIDI Clock Follow, Unsync)
export function createOtherCheckbox(
  name: string,
  cc: CCNumber,
  parentEl: HTMLElement,
  checkedValue = 127,
  uncheckedValue = 0
): void {
  stateService.set(cc, uncheckedValue, false);

  const row = createElement('div', 'dipRow');

  // Add tooltip
  const tooltip = CLOCK_TOOLTIPS[name];
  if (tooltip) {
    row.setAttribute('data-tooltip', tooltip);
  }

  const lab = createElement('label');
  lab.textContent = name;

  const cb = createElement('input', 'toggleSwitch') as HTMLInputElement;
  cb.type = 'checkbox';
  cb.addEventListener('change', () => {
    const v = cb.checked ? checkedValue : uncheckedValue;
    stateService.set(cc, v);
  });

  stateService.registerControl(cc, {
    type: 'other',
    set(v: MIDIValue) {
      cb.checked = Number(v) === checkedValue;
    }
  });

  row.appendChild(lab);
  row.appendChild(cb);
  parentEl.appendChild(row);
}

// Create "Other" select dropdown (Subdivisions)
export function createOtherSelect(
  name: string,
  cc: CCNumber,
  options: SubdivisionOption[],
  parentEl: HTMLElement
): void {
  stateService.set(cc, 0, false);

  const row = createElement('div', 'dipRow');

  // Add tooltip
  const tooltip = CLOCK_TOOLTIPS[name];
  if (tooltip) {
    row.setAttribute('data-tooltip', tooltip);
  }

  const lab = createElement('label');
  lab.textContent = name;

  const sel = createElement('select');
  sel.style.width = '100%';

  options.forEach(({ label, value }) => {
    const o = createElement('option');
    o.value = String(value);
    o.textContent = label;
    sel.appendChild(o);
  });

  sel.addEventListener('change', () => {
    const v = Number(sel.value) || 0;
    stateService.set(cc, v);
  });

  stateService.registerControl(cc, {
    type: 'other',
    set(v: MIDIValue) {
      sel.value = String(Number(v) || 0);
    }
  });

  row.appendChild(lab);
  row.appendChild(sel);
  parentEl.appendChild(row);
}

// Create ramp slider
export function createRampSlider(
  parentEl: HTMLElement
): void {
  const cc = 20; // Ramp Speed CC
  stateService.set(cc, 64, false);

  const sliderLabel = createElement('div', 'rampSliderLabel');
  sliderLabel.setAttribute('data-tooltip', TOOLTIPS.ramp.speed.description);

  const labelText = createElement('span');
  labelText.textContent = 'Ramp Speed';
  labelText.style.position = 'relative';

  // Lock Icon for Ramp Speed
  const lockBtn = createElement('button', 'lockIconBtnMini inlineLock');
  const isLocked = stateService.isLocked(cc);
  lockBtn.innerHTML = isLocked ? '🔒' : '🔓';
  lockBtn.classList.toggle('locked', isLocked);

  lockBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const newState = !stateService.isLocked(cc);
    stateService.setLocked(cc, newState);
    lockBtn.innerHTML = newState ? '🔒' : '🔓';
    lockBtn.classList.toggle('locked', newState);
  });

  labelText.appendChild(lockBtn);

  const labelValue = createElement('span');
  labelValue.textContent = '50%';

  sliderLabel.appendChild(labelText);
  sliderLabel.appendChild(labelValue);

  const slider = createElement('input', 'rampSlider') as HTMLInputElement;
  slider.type = 'range';
  slider.min = '0';
  slider.max = '127';
  slider.value = '64';

  slider.addEventListener('input', () => {
    const v = Number(slider.value);
    // Invert: 127 slider = 0 MIDI (Fast), 0 slider = 127 MIDI (Slow)
    const midiVal = 127 - v;
    stateService.set(cc, midiVal);
    labelValue.textContent = Math.round((v / 127) * 100) + '%';
  });

  // Register lockIcon handle for mass-unlocking if needed
  stateService.registerControl(cc, {
    type: 'slider',
    set(midiVal: MIDIValue) {
      const v = 127 - Number(midiVal);
      slider.value = String(v);
      labelValue.textContent = Math.round((v / 127) * 100) + '%';
    }
  });
  const control = stateService.getControl(cc);
  if (control) control.lockIcon = lockBtn;

  parentEl.appendChild(sliderLabel);
  parentEl.appendChild(slider);
}

// Create ramp enabled toggle (inverted logic)
export function createRampEnabled(parentEl: HTMLElement): void {
  const cc = 52; // Ramp Enabled CC
  stateService.set(cc, 127, false); // Default: ramping disabled (127=disabled, 0=enabled)

  // Add tooltip to parent
  parentEl.setAttribute('data-tooltip', TOOLTIPS.ramp.enabled.description);

  const enabledCb = createElement('input', 'toggleSwitch') as HTMLInputElement;
  enabledCb.type = 'checkbox';
  enabledCb.id = 'rampEnabledToggle';
  enabledCb.checked = false;

  enabledCb.addEventListener('change', () => {
    const v = enabledCb.checked ? 0 : 127; // Inverted logic
    stateService.set(cc, v);
  });

  stateService.registerControl(cc, {
    type: 'other',
    set(v: MIDIValue) {
      enabledCb.checked = Number(v) === 0; // Inverted
    }
  });

  parentEl.appendChild(enabledCb);

  const enabledSpan = createElement('span');
  enabledSpan.textContent = 'Stop';
  parentEl.appendChild(enabledSpan);
}
