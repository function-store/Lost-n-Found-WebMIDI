import type { CCNumber, MIDIValue, KnobKind, UIControl } from '../types';
import { stateService } from '../services/state';
import { valueToDegrees, valueToPercent, createElement, clampMIDI } from '../utils/helpers';
import { KNOB_RAMP_MAP, TOOLTIPS } from '../config';

interface KnobOptions {
  label: string;
  cc: CCNumber;
  kind: KnobKind;
  rampCC?: CCNumber;
  column?: string; // 'left', 'center', 'right'
  onUpdateReadout?: () => void;
  small?: boolean;
}

export function createKnobBlock(options: KnobOptions, parentEl: HTMLElement): void {
  const { label, cc, kind, rampCC: optionsRampCC, column, onUpdateReadout, small } = options;
  const rampCC = KNOB_RAMP_MAP[String(cc)] || optionsRampCC;

  // Initialize state with default
  const defaultValue = stateService.getKnobDefault(cc);
  stateService.set(cc, defaultValue, false);

  const block = createElement('div', 'knobBlock');
  if (column) {
    block.classList.add(`knob-${column}`);
  }
  if (small) block.classList.add('knobBlock--small');
  parentEl.appendChild(block);

  // Add tooltip from config
  const tooltipData = (TOOLTIPS.knobs as Record<string, { label: string; description: string }>)[String(cc)];
  if (tooltipData) {
    block.setAttribute('data-tooltip', tooltipData.description);
  }

  // Value display
  const val = createElement('div', 'kValue');
  val.textContent = '50%';

  // Knob element
  const knob = createElement('div', 'knob');
  if (small) knob.classList.add('knob--small');
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

  // Drag handling - Mouse events
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

  // Touch event handling for mobile
  let touchDragging = false;
  let lastTouchY = 0;
  let lastTapTime = 0;
  const DOUBLE_TAP_DELAY = 300; // ms

  knob.addEventListener('touchstart', (e) => {
    e.preventDefault(); // Prevent scrolling
    touchDragging = true;
    lastTouchY = e.touches[0].clientY;

    // Double-tap detection
    const now = Date.now();
    const timeSinceLastTap = now - lastTapTime;

    if (timeSinceLastTap < DOUBLE_TAP_DELAY && timeSinceLastTap > 0) {
      // Double-tap detected - reset to default
      stateService.set(cc, defaultValue);
      set(defaultValue);
      lastTapTime = 0; // Reset to prevent triple-tap
    } else {
      lastTapTime = now;
    }
  });

  window.addEventListener('touchend', () => {
    touchDragging = false;
  });

  window.addEventListener('touchmove', (e) => {
    if (!touchDragging) return;
    e.preventDefault(); // Prevent scrolling
    const touch = e.touches[0];
    const deltaY = lastTouchY - touch.clientY;
    lastTouchY = touch.clientY;

    const currentVal = stateService.get(cc) ?? 64;
    const newVal = clampMIDI(currentVal + deltaY);
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
  // 1. Arc/Knob Container
  const knobContainer = createElement('div', 'knobContainer');
  block.appendChild(knobContainer);

  // 2. Percentage Display (Sitting just below knob)
  const vRow = createElement('div', 'valueRow');
  vRow.style.width = '100%';
  vRow.style.textAlign = 'center';
  vRow.style.marginTop = '-6px'; // Pull value up towards knob
  vRow.style.marginBottom = '-2px'; // Pull labels up towards value
  vRow.appendChild(val);
  block.appendChild(vRow);

  if (kind === 'modify') {
    const arc = createElement('div', 'modifyArc');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.style.overflow = 'visible'; // Prevent clipping

    // Determine Arc Color based on column
    const arcColor = column === 'left' ? 'var(--green-muted)' : 'var(--yellow-muted)';

    // Arc configuration - procedurally adjustable
    const ARC_GAP_DEGREES = 30; // Gap at the top (in degrees)
    const RADIUS = 38;
    const CENTER_X = 50;
    const CENTER_Y = 50;
    const START_ANGLE = 135; // Bottom-left starting point (in degrees)
    const END_ANGLE = 405; // Bottom-right ending point (in degrees)

    // Calculate arc endpoints based on gap
    const halfGap = ARC_GAP_DEGREES / 2;
    const topLeftAngle = 270 - halfGap; // Top-left arc endpoint
    const topRightAngle = 270 + halfGap; // Top-right arc endpoint

    // Convert angles to radians and calculate coordinates
    const toRadians = (deg: number) => (deg * Math.PI) / 180;

    // Left arc: from START_ANGLE to topLeftAngle
    const leftStartX = CENTER_X + RADIUS * Math.cos(toRadians(START_ANGLE));
    const leftStartY = CENTER_Y + RADIUS * Math.sin(toRadians(START_ANGLE));
    const leftEndX = CENTER_X + RADIUS * Math.cos(toRadians(topLeftAngle));
    const leftEndY = CENTER_Y + RADIUS * Math.sin(toRadians(topLeftAngle));

    // Right arc: from topRightAngle to END_ANGLE
    const rightStartX = CENTER_X + RADIUS * Math.cos(toRadians(topRightAngle));
    const rightStartY = CENTER_Y + RADIUS * Math.sin(toRadians(topRightAngle));
    const rightEndX = CENTER_X + RADIUS * Math.cos(toRadians(END_ANGLE));
    const rightEndY = CENTER_Y + RADIUS * Math.sin(toRadians(END_ANGLE));

    // Left segment
    const pathL = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathL.setAttribute('d', `M ${leftStartX.toFixed(1)} ${leftStartY.toFixed(1)} A ${RADIUS} ${RADIUS} 0 0 1 ${leftEndX.toFixed(1)} ${leftEndY.toFixed(1)}`);
    pathL.setAttribute('fill', 'none');
    pathL.setAttribute('stroke', arcColor);
    pathL.setAttribute('stroke-width', '4');
    pathL.setAttribute('stroke-linecap', 'round');

    // Right segment
    const pathR = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathR.setAttribute('d', `M ${rightStartX.toFixed(1)} ${rightStartY.toFixed(1)} A ${RADIUS} ${RADIUS} 0 0 1 ${rightEndX.toFixed(1)} ${rightEndY.toFixed(1)}`);
    pathR.setAttribute('fill', 'none');
    pathR.setAttribute('stroke', arcColor);
    pathR.setAttribute('stroke-width', '4');
    pathR.setAttribute('stroke-linecap', 'round');

    const textA1 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textA1.classList.add('arcText', 'arcText--primary', 'arcText--left');
    textA1.setAttribute('x', '15'); // Justified to arc end
    textA1.setAttribute('y', '78'); // Moved UP
    textA1.setAttribute('fill', arcColor);
    textA1.setAttribute('text-anchor', 'end'); // Anchor END
    textA1.textContent = 'A1';

    const textA2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textA2.classList.add('arcText', 'arcText--secondary', 'arcText--left');
    textA2.setAttribute('x', '15');
    textA2.setAttribute('y', '88'); // Moved UP
    textA2.setAttribute('fill', arcColor);
    textA2.setAttribute('text-anchor', 'end'); // Anchor END
    textA2.textContent = 'A2';

    const textB1 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textB1.classList.add('arcText', 'arcText--primary', 'arcText--right');
    textB1.setAttribute('x', '85'); // Justified to arc end
    textB1.setAttribute('y', '78'); // Moved UP
    textB1.setAttribute('fill', arcColor);
    textB1.setAttribute('text-anchor', 'start'); // Anchor START
    textB1.textContent = 'B1';

    const textB2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    textB2.classList.add('arcText', 'arcText--secondary', 'arcText--right');
    textB2.setAttribute('x', '85');
    textB2.setAttribute('y', '88'); // Moved UP
    textB2.setAttribute('fill', arcColor);
    textB2.setAttribute('text-anchor', 'start'); // Anchor START
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



  // Primary Label
  const lab = createElement('div', 'kLabel');
  lab.textContent = label;
  labelArea.appendChild(lab);

  // Lock Icon - Inline with Label (Excluded for Master Wet)
  if (cc !== 30) {
    const lockBtn = createElement('button', 'lockIconBtnMini inlineLock');
    lab.appendChild(lockBtn);
    const isLockedInitial = stateService.isLocked(cc);
    lockBtn.innerHTML = isLockedInitial ? '🔒' : '🔓';
    lockBtn.classList.toggle('locked', isLockedInitial);

    lockBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const newState = !stateService.isLocked(cc);
      stateService.setLocked(cc, newState);
      lockBtn.innerHTML = newState ? '🔒' : '🔓';
      lockBtn.classList.toggle('locked', newState);
      if (cc === 15) stateService.set(55, newState ? 127 : 0);
    });
    control.lockIcon = lockBtn;

    // Special case for Mix knob lock sync
    if (cc === 15) {
      stateService.registerControl(55, {
        type: 'dip',
        set(v: MIDIValue) {
          const locked = Number(v) === 127;
          stateService.setLocked(15, locked);
          lockBtn.innerHTML = locked ? '🔒' : '🔓';
          lockBtn.classList.toggle('locked', locked);
        }
      });
    }
  }

  // Sub-label (Effect specific) - NOW LAST (Bottom of stack)
  const subLab = createElement('div', 'subLabel');
  labelArea.appendChild(subLab);
  control.subLabel = subLab;


  // Ramp Control - Top Center Pill
  if (rampCC) {
    const rampContainer = createElement('div', 'rampTopCenter');
    const rampPill = createElement('button', 'rampPillToggle');
    rampPill.textContent = 'RAMP';

    rampPill.addEventListener('click', () => {
      const current = stateService.get(rampCC);
      const newVal = current === 127 ? 0 : 127;
      stateService.set(rampCC, newVal);
      rampPill.classList.toggle('active', newVal === 127);
    });

    stateService.registerControl(rampCC, {
      type: 'dip',
      set(v: MIDIValue) {
        rampPill.classList.toggle('active', Number(v) === 127);
      }
    });

    rampContainer.appendChild(rampPill);
    block.appendChild(rampContainer);
  }

  parentEl.appendChild(block);
}
