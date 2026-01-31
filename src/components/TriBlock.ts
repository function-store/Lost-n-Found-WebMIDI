import type { CCNumber, MIDIValue, Side } from '../types';
import { stateService } from '../services/state';
import { triValueForCC, triPosFromValue, createElement } from '../utils/helpers';

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

  // Title row
  const tRow = createElement('div');
  tRow.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px';

  const titleRow = createElement('div', 'toggleTitle');
  titleRow.style.cssText = 'margin:0;display:flex;gap:8px;align-items:center';

  const titleText = createElement('span');
  titleText.textContent = title;
  titleRow.appendChild(titleText);

  // Randomize button for Left/Right FX
  if (hasRandomize && side && (side === 'L' || side === 'R')) {
    const randomBtn = createElement('button', 'randomizeBtn');
    randomBtn.textContent = '🎲';
    randomBtn.title = `Randomize ${side === 'L' ? 'Left' : 'Right'} Column`;
    randomBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      onRandomizeColumn?.(side);
    });
    titleRow.appendChild(randomBtn);
  }

  tRow.appendChild(titleRow);

  // Swap toggle
  let swapCheck: HTMLInputElement | null = null;
  if (side && swapCC) {
    const sLabel = createElement('label');
    sLabel.style.cssText = 'font-size:11px;display:flex;align-items:center;gap:4px;cursor:pointer;font-weight:500;color:var(--muted)';
    sLabel.innerHTML = `<input type="checkbox" id="${side.toLowerCase()}SwapToggle"> Swap`;

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

    tRow.appendChild(sLabel);
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
    });
    onUpdateLabels?.();
    onUpdateReadout?.();
  }

  function paint(pos: number) {
    btns.forEach((b, i) => {
      const on = i === pos;
      b.style.border = on ? '1px solid rgba(63,95,78,.55)' : '1px solid rgba(95,125,106,.24)';
      b.style.background = on
        ? 'linear-gradient(180deg, rgba(207,224,214,.95), rgba(207,224,214,.65))'
        : 'rgba(255,255,255,.90)';
      b.style.color = on ? 'var(--text)' : 'var(--muted)';
    });
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

  // Engage toggle for Left/Right FX
  if (side && engageCC && (side === 'L' || side === 'R')) {
    stateService.set(engageCC, 0, false);

    const engageLabel = createElement('label', 'engageToggle');
    engageLabel.id = `engage${side}`;

    const engageCb = createElement('input') as HTMLInputElement;
    engageCb.type = 'checkbox';
    engageCb.checked = false;

    const engageText = createElement('span');
    engageText.textContent = 'ENGAGE';

    engageCb.addEventListener('change', () => {
      const v = engageCb.checked ? 1 : 0;
      stateService.set(engageCC, v);
      engageLabel.classList.toggle('active', engageCb.checked);
    });

    stateService.registerControl(engageCC, {
      type: 'engage',
      set(v: MIDIValue) {
        engageCb.checked = Number(v) === 1;
        engageLabel.classList.toggle('active', engageCb.checked);
      }
    });

    engageLabel.appendChild(engageCb);
    engageLabel.appendChild(engageText);
    block.appendChild(engageLabel);
  }

  parentEl.appendChild(block);
}
