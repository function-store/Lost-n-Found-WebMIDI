import type { CCNumber, MIDIValue, Side } from '../types';
import { stateService } from '../services/state';
import { triValueForCC, triPosFromValue, createElement } from '../utils/helpers';
import { TOOLTIPS } from '../config';

// Get tooltip for effect option
function getEffectTooltip(blockTitle: string, optionName: string): string | null {
  // Map block title to config key
  let blockKey: string | null = null;
  if (blockTitle === 'Left FX') blockKey = 'leftFx';
  else if (blockTitle === 'Right FX') blockKey = 'rightFx';
  else if (blockTitle === 'Routing') blockKey = 'routing';
  else if (blockTitle === 'Spread') {
    // Spread options no longer have individual tooltips
    // The block itself has a tooltip, but not each option
    return null;
  }

  if (!blockKey) return null;

  const effectConfig = TOOLTIPS.effects[blockKey as keyof typeof TOOLTIPS.effects];
  if (!effectConfig) return null;

  const optionTooltips = effectConfig.options as Record<string, string>;
  return optionTooltips[optionName] || null;
}

// Get block description
function getBlockTooltip(blockTitle: string): string | null {
  // Map block title to config key
  if (blockTitle === 'Spread') {
    return TOOLTIPS.stereo.spread.description;
  }

  let blockKey: string | null = null;
  if (blockTitle === 'Left FX') blockKey = 'leftFx';
  else if (blockTitle === 'Right FX') blockKey = 'rightFx';
  else if (blockTitle === 'Routing') blockKey = 'routing';

  if (!blockKey) return null;

  const effectConfig = TOOLTIPS.effects[blockKey as keyof typeof TOOLTIPS.effects];
  return effectConfig?.description || null;
}

interface TriBlockOptions {
  title: string;
  cc: CCNumber;
  options: string[];
  swappedOptions?: string[];
  side?: Side | null;
  engageCC?: CCNumber;
  swapCC?: CCNumber;
  hasRandomize?: boolean;
  onRandomizeColumn?: (side: Side) => void;
  onUpdateReadout?: () => void;
  onUpdateLabels?: () => void;
  noSpacer?: boolean;
}

export function createTriBlock(options: TriBlockOptions, parentEl: HTMLElement): void {
  const {
    title, cc, options: optionLabels, swappedOptions, side,
    engageCC, swapCC, hasRandomize, onRandomizeColumn, onUpdateReadout, onUpdateLabels
  } = options;

  // Initialize state
  const defaultValue = cc === 23 ? 4 : 1; // R Effects mode defaults different
  stateService.set(cc, defaultValue, false);

  const block = createElement('div', 'toggleBlock');
  if (side) {
    block.classList.add(`toggle-${side.toLowerCase()}`);
  }

  // Add block tooltip
  const blockTooltip = getBlockTooltip(title);
  if (blockTooltip) {
    block.setAttribute('data-tooltip', blockTooltip);
  }

  // Title row
  const tRow = createElement('div', 'toggleHeader');

  const titleRow = createElement('div', 'toggleTitle');
  const titleText = createElement('span');
  titleText.textContent = title;

  // Prepare Randomize button if needed
  let randomBtn: HTMLButtonElement | null = null;
  if (hasRandomize && side && (side === 'L' || side === 'R')) {
    randomBtn = createElement('button', 'randomizeBtn');
    randomBtn.textContent = '🎲';
    randomBtn.title = `Randomize ${side === 'L' ? 'Left' : 'Right'} Column`;
    randomBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onRandomizeColumn?.(side);
    });
  }

  // Prepare Swap toggle if needed
  let swapCheck: HTMLInputElement | null = null;
  let sLabel: HTMLElement | null = null;
  if (side && swapCC) {
    sLabel = createElement('label');
    sLabel.style.cssText = 'font-size:11px;display:flex;align-items:center;gap:4px;cursor:pointer;font-weight:500;color:var(--cream-muted)';
    sLabel.innerHTML = `<input type="checkbox" class="toggleSwitch" id="${side.toLowerCase()}SwapToggle"> Swap`;

    swapCheck = sLabel.querySelector('input') as HTMLInputElement;
    swapCheck.addEventListener('change', () => {
      const v = swapCheck!.checked ? 127 : 0;
      stateService.set(swapCC, v);
      updateLabels();
      onUpdateReadout?.();
    });

    stateService.registerControl(swapCC, {
      type: 'dip',
      set(v: MIDIValue) {
        swapCheck!.checked = Number(v) === 127;
        updateLabels();
        onUpdateReadout?.();
      }
    });
  }


  // Assemble the header based on side (Mirrored for Right)
  if (side === 'R') {
    // 1. Swap on the left
    if (sLabel) tRow.appendChild(sLabel);

    // 2. Title block on the right
    if (randomBtn) titleRow.appendChild(randomBtn);
    titleRow.appendChild(titleText);
    tRow.appendChild(titleRow);
  } else {
    // Standard order (Left FX, Routing, etc.)
    // 1. Title block on the left
    titleRow.appendChild(titleText);
    if (randomBtn) titleRow.appendChild(randomBtn);
    tRow.appendChild(titleRow);

    // 2. Lock for Routing (cc 22)
    if (cc === 22) {
      const lockBtn = createElement('button', 'lockIconBtnMini inlineLock');
      lockBtn.style.position = 'relative';
      lockBtn.style.left = 'auto';
      lockBtn.style.top = 'auto';
      lockBtn.style.transform = 'none';
      lockBtn.style.marginLeft = '6px';

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
      tRow.appendChild(lockBtn);
    }

    // 3. Swap on the right
    if (sLabel) tRow.appendChild(sLabel);
  }

  // Segment buttons
  const seg = createElement('div', 'seg');
  const btns: HTMLButtonElement[] = [];
  const defaultLabels = [...optionLabels];
  const swapped = swappedOptions || optionLabels;

  function updateLabels() {
    const isSwapped = swapCheck?.checked ?? false;
    const labels = isSwapped ? swapped : defaultLabels;
    btns.forEach((b, i) => {
      b.textContent = labels[i];
      // Update button tooltip
      const tooltip = getEffectTooltip(title, labels[i]);
      if (tooltip) {
        b.setAttribute('data-tooltip', tooltip);
        b.setAttribute('data-tooltip-position', 'bottom');
      }
    });
    onUpdateLabels?.();
    onUpdateReadout?.();
  }

  function paint(pos: number) {
    btns.forEach((b, i) => {
      b.classList.toggle('active', i === pos);
    });
    // Update slider position via CSS custom property
    seg.style.setProperty('--active-index', String(pos));
  }

  optionLabels.forEach((name, i) => {
    const b = createElement('button');
    b.type = 'button';
    b.textContent = name;
    b.onclick = () => {
      const v = triValueForCC(cc, i as 0 | 1 | 2);
      stateService.set(cc, v);
      paint(i);
      updateLabels();
      onUpdateReadout?.();
    };
    btns.push(b);
    seg.appendChild(b);
  });

  stateService.registerControl(cc, {
    type: 'tri',
    set(v: MIDIValue) {
      paint(triPosFromValue(cc, v));
      updateLabels();
      onUpdateReadout?.();
    }
  });

  paint(0);

  block.appendChild(tRow);
  block.appendChild(seg);

  // Footswitch Rack (LED + Foot Button) for side columns
  if (side && engageCC && (side === 'L' || side === 'R')) {
    const footswitchRack = createElement('div', 'footswitchRack');

    // Status LED
    const led = createElement('div', 'statusLed');
    footswitchRack.appendChild(led);

    // Determine hold CC based on side
    const holdCC = side === 'L' ? 105 : 106;

    // Initialize hold state
    stateService.set(holdCC, 0, false);

    // Realistic Footswitch (Metallic Button)
    const footswitch = createElement('button', 'footswitch plunger');
    footswitch.type = 'button';

    // Long-press detection
    let pressTimer: number | null = null;
    const LONG_PRESS_DURATION = 500; // ms

    footswitch.addEventListener('mousedown', () => {
      pressTimer = window.setTimeout(() => {
        // Long press detected - activate hold mode
        // Hardware requires engage to be active before hold can be set
        const currentHold = stateService.get(holdCC) === 1;
        const newHold = currentHold ? 0 : 1;

        if (newHold === 1) {
          // Turning hold ON: first engage, then hold
          stateService.set(engageCC!, 1);
          stateService.set(holdCC, 1);
          led.classList.add('active', 'hold');
          footswitch.classList.add('active');
        } else {
          // Turning hold OFF: turn off hold but keep engage ON
          stateService.set(holdCC, 0);
          led.classList.remove('hold');
          // Keep active class (engage stays on)
        }

        // Add press animation
        footswitch.classList.add('pressed');
        setTimeout(() => footswitch.classList.remove('pressed'), 100);

        pressTimer = null;
      }, LONG_PRESS_DURATION);
    });

    footswitch.addEventListener('mouseup', () => {
      if (pressTimer !== null) {
        // Short press - if either engage or hold is active, turn both off
        // Otherwise, turn engage on
        clearTimeout(pressTimer);
        pressTimer = null;

        const isEngaged = stateService.get(engageCC!) === 1;
        const isHold = stateService.get(holdCC) === 1;

        // If either is on, turn both off. Otherwise turn engage on.
        if (isEngaged || isHold) {
          stateService.set(engageCC!, 0);
          stateService.set(holdCC, 0);
          led.classList.remove('active', 'hold');
          footswitch.classList.remove('active');
        } else {
          stateService.set(engageCC!, 1);
          led.classList.add('active');
          footswitch.classList.add('active');
        }

        // Add a momentary press class for animation
        footswitch.classList.add('pressed');
        setTimeout(() => footswitch.classList.remove('pressed'), 100);
      }
    });

    footswitch.addEventListener('mouseleave', () => {
      if (pressTimer !== null) {
        clearTimeout(pressTimer);
        pressTimer = null;
      }
    });

    stateService.registerControl(engageCC, {
      type: 'engage',
      set(v: MIDIValue) {
        const isActive = Number(v) === 1;
        led.classList.toggle('active', isActive);
        footswitch.classList.toggle('active', isActive);
      }
    });

    stateService.registerControl(holdCC, {
      type: 'dip',
      set(v: MIDIValue) {
        const isHold = Number(v) === 1;
        led.classList.toggle('hold', isHold);
      }
    });

    footswitchRack.appendChild(footswitch);
    block.appendChild(footswitchRack);
  } else if (!options.noSpacer) {
    // Spacer to keep middle column aligned
    const spacer = createElement('div', 'footswitchSpacer');
    block.appendChild(spacer);
  }

  parentEl.appendChild(block);
}
