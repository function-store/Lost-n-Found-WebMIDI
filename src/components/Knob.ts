import type { CCNumber, MIDIValue, KnobKind, UIControl } from '../types';
import { stateService } from '../services/state';
import { valueToDegrees, valueToPercent, createElement, clampMIDI } from '../utils/helpers';
import { KNOB_RAMP_MAP } from '../config';

interface KnobOptions {
  label: string;
  cc: CCNumber;
  kind: KnobKind;
  rampCC?: CCNumber;
  column?: string; // 'left', 'center', 'right'
  onUpdateReadout?: () => void;
}

export function createKnobBlock(options: KnobOptions, parentEl: HTMLElement): void {
  const { label, cc, kind, rampCC: optionsRampCC, column, onUpdateReadout } = options;
  const rampCC = KNOB_RAMP_MAP[String(cc)] || optionsRampCC;

  // Initialize state with default
  const defaultValue = stateService.getKnobDefault(cc);
  stateService.set(cc, defaultValue, false);

  const block = createElement('div', 'knobBlock');
  if (column) {
    block.classList.add(`knob-${column}`);
  }

  // Value display
  const val = createElement('div', 'kValue');
  val.textContent = '50%';

  // Knob element
  const knob = createElement('div', 'knob');
  const dial = createElement('div', 'dial');

  const rot = createElement('div', 'rot');
  const indicator = createElement('div', 'indicator');

  // Column-based tinting
  if (column === 'left') indicator.classList.add('ind-left');
  else if (column === 'right') indicator.classList.add('ind-right');

  rot.appendChild(indicator);

  knob.appendChild(dial);
  knob.appendChild(rot);

  // Set function
  const set = (v: MIDIValue) => {
    v = clampMIDI(v);
    rot.style.transform = `rotate(${valueToDegrees(v)}deg)`;
    const pct = valueToPercent(v);

    if (kind === 'modify') {
      val.textContent = pct;
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

  // Double-click to reset to default
  knob.addEventListener('dblclick', () => {
    stateService.set(cc, defaultValue);
    set(defaultValue);
  });

  // Register UI control
  const control: UIControl = { type: kind === 'modify' ? 'modify' : 'knob', set };
  stateService.registerControl(cc, control);

  // Main Build Layout
  // 1. Percentage Display - Moved to TOP
  const vRow = createElement('div', 'valueRow');
  vRow.style.width = '100%';
  vRow.style.textAlign = 'center';
  vRow.style.marginBottom = '-4px'; // Bring knob closer to value
  vRow.appendChild(val);
  block.appendChild(vRow);

  // 2. Arc/Knob Container
  const knobContainer = createElement('div', 'knobContainer');
  block.appendChild(knobContainer);

  if (kind === 'modify') {
    const arc = createElement('div', 'modifyArc');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.style.overflow = 'visible'; // Prevent clipping

    // Determine Arc Color based on column
    const arcColor = column === 'left' ? 'var(--green-muted)' : 'var(--yellow-muted)';

    // Left segment - calibrated radius 38 (Gap ~5.6px with inset -10px)
    const pathL = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathL.setAttribute('d', 'M 21.4 75 A 38 38 0 0 1 47 12.2');
    pathL.setAttribute('fill', 'none');
    pathL.setAttribute('stroke', arcColor);
    pathL.setAttribute('stroke-width', '4');
    pathL.setAttribute('stroke-linecap', 'round');

    // Right segment - calibrated radius 38
    // Right segment - calibrated radius 38
    const pathR = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathR.setAttribute('d', 'M 53 12.2 A 38 38 0 0 1 78.6 75');
    pathR.setAttribute('fill', 'none');
    pathR.setAttribute('stroke', arcColor);
    pathR.setAttribute('stroke-width', '4');
    pathR.setAttribute('stroke-linecap', 'round');

    const textA1 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textA1.setAttribute('x', '15'); // Justified to arc end
    textA1.setAttribute('y', '78'); // Moved UP
    textA1.setAttribute('fill', arcColor);
    textA1.setAttribute('font-size', '8');
    textA1.setAttribute('font-weight', 'bold');
    textA1.setAttribute('text-anchor', 'end'); // Anchor END
    textA1.textContent = 'A1';

    const textA2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textA2.setAttribute('x', '15');
    textA2.setAttribute('y', '88'); // Moved UP
    textA2.setAttribute('fill', arcColor);
    textA2.setAttribute('font-size', '7');
    textA2.setAttribute('font-weight', 'bold');
    textA2.setAttribute('text-anchor', 'end'); // Anchor END
    textA2.style.opacity = '0.7';
    textA2.textContent = 'A2';

    const textB1 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textB1.setAttribute('x', '85'); // Justified to arc end
    textB1.setAttribute('y', '78'); // Moved UP
    textB1.setAttribute('fill', arcColor);
    textB1.setAttribute('font-size', '8');
    textB1.setAttribute('font-weight', 'bold');
    textB1.setAttribute('text-anchor', 'start'); // Anchor START
    textB1.textContent = 'B1';

    const textB2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textB2.setAttribute('x', '85');
    textB2.setAttribute('y', '88'); // Moved UP
    textB2.setAttribute('fill', arcColor);
    textB2.setAttribute('font-size', '7');
    textB2.setAttribute('font-weight', 'bold');
    textB2.setAttribute('text-anchor', 'start'); // Anchor START
    textB2.style.opacity = '0.7';
    textB2.textContent = 'B2';

    svg.appendChild(pathL);
    svg.appendChild(pathR);
    svg.appendChild(textA1);
    svg.appendChild(textA2);
    svg.appendChild(textB1);
    svg.appendChild(textB2);
    arc.appendChild(svg);
    knobContainer.appendChild(arc);

    control.arcLabels = {
      A1: textA1, A2: textA2,
      B1: textB1, B2: textB2
    };
  }

  knobContainer.appendChild(knob);


  // 2. Label Area (placed BELOW knob)
  const labelArea = createElement('div', 'labelArea');
  block.appendChild(labelArea);



  // Primary Label - NOW SECOND
  const lab = createElement('div', 'kLabel');
  lab.textContent = label;

  // Lock Icon - Inline with Label
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
    if (cc === 15) stateService.set(55, newState ? 127 : 0);
  });

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

  lab.appendChild(lockBtn);
  control.lockIcon = lockBtn; // Register lockIcon handle
  labelArea.appendChild(lab);

  // Sub-label (Effect specific) - NOW LAST (Bottom of stack)
  const subLab = createElement('div', 'subLabel');
  labelArea.appendChild(subLab);
  control.subLabel = subLab;


  // Ramp Control - Top Right Absolute
  if (rampCC) {
    const rampContainer = createElement('div', 'rampTopRight');

    const rampCheck = createElement('input') as HTMLInputElement;
    rampCheck.type = 'checkbox';
    rampCheck.id = `ramp${cc}`;
    rampCheck.className = 'toggleSwitch toggleSwitch--sm';

    const rampLabel = createElement('label', 'miniRampLabel');
    rampLabel.textContent = '(RAMP)'; // Or empty if icon only? User image shows text.
    rampLabel.style.fontSize = '9px';
    rampLabel.appendChild(rampCheck);

    rampCheck.addEventListener('change', () => {
      stateService.set(rampCC, rampCheck.checked ? 127 : 0);
    });

    stateService.registerControl(rampCC, {
      type: 'dip',
      set(v: MIDIValue) {
        rampCheck.checked = Number(v) === 127;
      }
    });

    rampContainer.appendChild(rampLabel);
    block.appendChild(rampContainer); // Append to main block for absolute positioning
  }

  parentEl.appendChild(block);
}
