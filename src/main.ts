import './styles/main.css';
import { midiService, stateService, presetService, randomizerService } from './services';
import {
  createKnobBlock,
  createTriBlock,
  createDipRow,
  createRampToggle,
  createStereoToggle,
  createOtherCheckbox,
  createOtherSelect,
  createRampSlider,
  createRampEnabled,
} from './components';
import { createScatterLayer } from './components/ScatterDecorations';
import { EFFECTS, KNOBS, CONTROLS } from './config';
import { triPosFromValue, getVariantFromModify, createElement } from './utils/helpers';
import type { Side, MIDIChannel, KnobKind } from './types';

// Tap tempo state
let lastTapMs: number | null = null;

// Initialize the application
function init(): void {
  console.log('[Lost+Found Editor] Initializing...');

  buildUI();
  setupEventListeners();
  stateService.load();
  updateReadout();
  initSlots();
  updateMidiStatusUI();

  midiService.setOnStateChange(() => {
    updateMidiStatusUI();
  });

  console.log('[Lost+Found Editor] Ready');
}

function updateMidiStatusUI(): void {
  const isEnabled = midiService.isEnabled;
  document.body.classList.toggle('midi-disabled', !isEnabled);
}

// Build the main UI
function buildUI(): void {
  const toggleRow = document.getElementById('toggleRow');
  const knobGrid = document.getElementById('knobGrid');
  const pedal = document.querySelector('.pedal') as HTMLElement | null;

  if (!toggleRow || !knobGrid) {
    console.error('Required DOM elements not found');
    return;
  }

  // Add organic scatter decorations
  if (pedal) {
    createScatterLayer(pedal);
  }

  // Create effect selector blocks
  CONTROLS.triBlocks.forEach(block => {
    createTriBlock({
      title: block.title,
      cc: block.cc,
      options: block.options,
      swappedOptions: block.swappedOptions,
      side: block.side as Side | null,
      engageCC: block.engageCC,
      swapCC: block.swapCC,
      hasRandomize: block.hasRandomize,
      onRandomizeColumn: (side: Side) => randomizerService.randomizeColumn(side),
      onUpdateReadout: updateReadout,
    }, toggleRow);
  });

  // Create knob grid
  KNOBS.layout.forEach(knob => {
    createKnobBlock({
      label: knob.label,
      cc: knob.cc,
      kind: knob.kind as KnobKind,
      column: knob.column, // Pass column for styling
      onUpdateReadout: updateReadout,
    }, knobGrid);
  });

  // Add spacer for centered Master Wet
  const spacer = createElement('div', 'knobBlock');
  spacer.style.visibility = 'hidden';
  knobGrid.appendChild(spacer);

  // Master Wet knob
  createKnobBlock({
    label: KNOBS.masterWet.label,
    cc: KNOBS.masterWet.cc,
    kind: KNOBS.masterWet.kind as KnobKind,
    onUpdateReadout: updateReadout,
  }, knobGrid);

  // Build Ramp Section
  buildRampSection();

  // Build Stereo Section
  buildStereoSection();

  // Build Clock/Tempo Section
  buildClockSection();

  // Build DIP Switches Section
  buildDipSection();

  // Update channel selector
  fillChannels();
}

// Build Ramp Control Section
function buildRampSection(): void {
  const rampToggles = document.getElementById('rampToggles');
  const rampSliderWrap = document.getElementById('rampSliderWrap');
  const rampEnabledWrap = document.getElementById('rampEnabledWrap');

  if (!rampToggles || !rampSliderWrap || !rampEnabledWrap) return;

  // Ramp toggles (Bounce, Sweep, Polarity)
  CONTROLS.rampToggles.forEach(toggle => {
    createRampToggle(toggle.label, toggle.cc, rampToggles);
  });

  // Ramp slider
  createRampSlider(rampSliderWrap);

  // Ramp enabled toggle
  createRampEnabled(rampEnabledWrap);

  // Ramp collapse functionality
  setupRampCollapse();
}

// Build Stereo Section
function buildStereoSection(): void {
  const stereoControls = document.getElementById('stereoControls');
  if (!stereoControls) return;

  // Spread 3-way toggle
  const spreadBlock = createElement('div');
  spreadBlock.style.flex = '1';

  createTriBlock({
    title: CONTROLS.stereoControls.spread.title,
    cc: CONTROLS.stereoControls.spread.cc,
    options: CONTROLS.stereoControls.spread.options,
    onUpdateReadout: updateReadout,
  }, spreadBlock);

  stereoControls.appendChild(spreadBlock.firstChild!);

  // MISO and Spread DIP toggles
  CONTROLS.stereoControls.toggles.forEach(toggle => {
    createStereoToggle(toggle.label, toggle.cc, stereoControls);
  });
}

// Build Clock/Tempo Section
function buildClockSection(): void {
  const otherGrid = document.getElementById('otherGrid');
  if (!otherGrid) return;

  // MIDI Clock Follow and Unsync
  CONTROLS.clockControls.forEach(ctrl => {
    createOtherCheckbox(ctrl.label, ctrl.cc, otherGrid);
  });

  // Subdivision selects
  CONTROLS.subdivisionSelects.forEach(sel => {
    createOtherSelect(sel.label, sel.cc, CONTROLS.subdivisions, otherGrid);
  });
}

// Build DIP Switches Section
function buildDipSection(): void {
  const dipGrid = document.getElementById('dipGrid');
  if (!dipGrid) return;

  CONTROLS.dipSwitches.forEach(dip => {
    createDipRow(dip.label, dip.cc, dipGrid);
  });
}

// Setup ramp collapse functionality
function setupRampCollapse(): void {
  const rampHeader = document.getElementById('rampHeader');
  const rampControls = document.getElementById('rampControls');
  const rampCollapseBtn = document.getElementById('rampCollapseBtn');

  if (!rampHeader || !rampControls || !rampCollapseBtn) return;

  const toggleCollapse = () => {
    stateService.rampCollapsed = !stateService.rampCollapsed;
    rampControls.classList.toggle('collapsed', stateService.rampCollapsed);
    rampCollapseBtn.textContent = stateService.rampCollapsed ? 'Show' : 'Hide';
    stateService.save();
  };

  rampHeader.addEventListener('click', (e) => {
    if (e.target === rampCollapseBtn) return;
    toggleCollapse();
  });

  rampCollapseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleCollapse();
  });

  // Restore collapsed state
  rampControls.classList.toggle('collapsed', stateService.rampCollapsed);
  rampCollapseBtn.textContent = stateService.rampCollapsed ? 'Show' : 'Hide';
}

// Fill channel selector
function fillChannels(): void {
  const sel = document.getElementById('chanSelect') as HTMLSelectElement;
  if (!sel) return;

  sel.innerHTML = '';
  for (let ch = 1; ch <= 16; ch++) {
    const o = document.createElement('option');
    o.value = String(ch - 1);
    o.textContent = String(ch);
    sel.appendChild(o);
  }
  sel.value = String(midiService.currentChannel);
}

// Initialize preset slots
function initSlots(): void {
  const sel = document.getElementById('slotSelect') as HTMLSelectElement;
  if (!sel) return;

  const targetSlot = stateService.currentActiveSlot || Number(sel.value) || 1;
  sel.innerHTML = '';

  const meta = presetService.getMeta();

  // Slot 0 = Live
  const o0 = document.createElement('option');
  o0.value = '0';
  o0.textContent = '0 (Live)';
  sel.appendChild(o0);

  for (let i = 1; i <= presetService.maxSlots; i++) {
    const o = document.createElement('option');
    o.value = String(i);
    const name = meta[i]?.name ? `${i}: ${meta[i].name}` : String(i);
    o.textContent = name + (meta[i]?.occupied ? ' [x]' : '');
    sel.appendChild(o);
  }

  if (targetSlot >= 0 && targetSlot <= presetService.maxSlots) {
    sel.value = String(targetSlot);
    stateService.currentActiveSlot = targetSlot;
  }
}

// Update effect readout display
function updateReadout(): void {
  const lSwap = stateService.get(74) === 127;
  const rSwap = stateService.get(75) === 127;

  const L_NAMES = lSwap ? EFFECTS.leftSwappedFamilies : EFFECTS.leftFamilies;
  const R_NAMES = rSwap ? EFFECTS.rightSwappedFamilies : EFFECTS.rightFamilies;

  const leftPos = triPosFromValue(21, stateService.get(21));
  triPosFromValue(22, stateService.get(22));
  const rightPos = triPosFromValue(23, stateService.get(23));

  const leftAB = getVariantFromModify(stateService.get(17));
  const rightAB = getVariantFromModify(stateService.get(19));

  const leftFamily = L_NAMES[leftPos];
  const rightFamily = R_NAMES[rightPos];

  // Families/sets not needed anymore for readout




  // Update Modify Knob Labels
  const modifyLabels = EFFECTS.modifyLabels as Record<string, string[]>;
  const effectDetails = EFFECTS.effectDetails as Record<string, { A: { time: string; modify: string; alt: string }; B: { time: string; modify: string; alt: string } }>;

  const lLabels = modifyLabels[leftFamily] || ['', ''];
  const rLabels = modifyLabels[rightFamily] || ['', ''];
  const lDetails = effectDetails[leftFamily] || { A: { modify: '' }, B: { modify: '' } };
  const rDetails = effectDetails[rightFamily] || { A: { modify: '' }, B: { modify: '' } };

  const lModifyControl = stateService.getControl(17);
  const rModifyControl = stateService.getControl(19);

  // Left Modify Knob Arcs
  if (lModifyControl?.arcLabels) {
    lModifyControl.arcLabels.A1.textContent = lLabels[0];
    lModifyControl.arcLabels.A2.textContent = lDetails.A.modify;
    lModifyControl.arcLabels.B1.textContent = lLabels[1];
    lModifyControl.arcLabels.B2.textContent = lDetails.B.modify;
  }

  // Right Modify Knob Arcs
  if (rModifyControl?.arcLabels) {
    rModifyControl.arcLabels.A1.textContent = rLabels[0];
    rModifyControl.arcLabels.A2.textContent = rDetails.A.modify;
    rModifyControl.arcLabels.B1.textContent = rLabels[1];
    rModifyControl.arcLabels.B2.textContent = rDetails.B.modify;
  }


  // Update effect-specific sub-labels
  const lDetail = effectDetails[leftFamily]?.[leftAB === 'B' ? 'B' : 'A'];
  const rDetail = effectDetails[rightFamily]?.[rightAB === 'B' ? 'B' : 'A'];

  if (lDetail) {
    stateService.getControl(14)?.subLabel && (stateService.getControl(14)!.subLabel!.textContent = lDetail.time);
    stateService.getControl(17)?.subLabel && (stateService.getControl(17)!.subLabel!.textContent = lDetail.modify);
    stateService.getControl(24)?.subLabel && (stateService.getControl(24)!.subLabel!.textContent = lDetail.alt);
  }
  if (rDetail) {
    stateService.getControl(16)?.subLabel && (stateService.getControl(16)!.subLabel!.textContent = rDetail.time);
    stateService.getControl(19)?.subLabel && (stateService.getControl(19)!.subLabel!.textContent = rDetail.modify);
    stateService.getControl(26)?.subLabel && (stateService.getControl(26)!.subLabel!.textContent = rDetail.alt);
  }
}

// Setup event listeners
function setupEventListeners(): void {
  // MIDI Toggle
  const btnMIDI = document.getElementById('btnEnableMIDI');
  if (btnMIDI) {
    btnMIDI.textContent = midiService.isEnabled ? 'Disable MIDI' : 'Enable MIDI';
    btnMIDI.addEventListener('click', toggleMIDI);
  }

  // MIDI Output select
  document.getElementById('midiSelect')?.addEventListener('change', (e) => {
    const sel = e.target as HTMLSelectElement;
    midiService.selectOutput(sel.value);
    stateService.save();
  });

  // Channel select
  document.getElementById('chanSelect')?.addEventListener('change', (e) => {
    const sel = e.target as HTMLSelectElement;
    midiService.setChannel(Number(sel.value) as MIDIChannel);
    stateService.save();
  });

  // Tap tempo
  document.getElementById('btnTap')?.addEventListener('click', handleTap);

  // Randomize
  document.getElementById('btnRandom')?.addEventListener('click', () => {
    const inclRamp = (document.getElementById('chkInclRamp') as HTMLInputElement)?.checked ?? false;
    randomizerService.randomizeAll(inclRamp);
    updateReadout();
  });

  document.getElementById('btnRandomKnobs')?.addEventListener('click', () => {
    const inclRamp = (document.getElementById('chkInclRamp') as HTMLInputElement)?.checked ?? false;
    randomizerService.randomizeKnobs(inclRamp);
    updateReadout();
  });

  document.getElementById('btnUnlockAll')?.addEventListener('click', () => {
    stateService.unlockAllKnobs();
  });

  // Include Ramp checkbox
  document.getElementById('chkInclRamp')?.addEventListener('change', () => {
    stateService.inclRamp = (document.getElementById('chkInclRamp') as HTMLInputElement)?.checked ?? false;
    stateService.save();
  });

  // Preset controls
  document.getElementById('btnRecall')?.addEventListener('click', () => {
    const slot = Number((document.getElementById('slotSelect') as HTMLSelectElement).value);
    presetService.recall(slot);
  });

  document.getElementById('btnStore')?.addEventListener('click', () => {
    showStoreDialog();
  });

  document.getElementById('btnPushOnly')?.addEventListener('click', () => {
    if (!midiService.isEnabled) {
      alert('Enable MIDI first.');
      return;
    }
    stateService.pushToPedal();
  });

  // Export/Import
  document.getElementById('btnExportPreset')?.addEventListener('click', () => {
    presetService.exportPreset();
  });

  document.getElementById('btnImportPreset')?.addEventListener('click', () => {
    document.getElementById('filePreset')?.click();
  });

  document.getElementById('filePreset')?.addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      await presetService.importPreset(file);
      updateReadout();
    } catch (err) {
      alert(`Preset load failed: ${(err as Error).message}`);
    }
  });

  // Slot select change
  document.getElementById('slotSelect')?.addEventListener('change', () => {
    stateService.currentActiveSlot = Number((document.getElementById('slotSelect') as HTMLSelectElement).value);
    stateService.save();
  });

  // Preset Manager
  document.getElementById('btnShowManager')?.addEventListener('click', openManager);
  document.getElementById('btnSaveManager')?.addEventListener('click', saveManagerChanges);
  document.getElementById('btnExportMeta')?.addEventListener('click', () => presetService.exportMeta());
  document.getElementById('btnImportMeta')?.addEventListener('click', () => {
    document.getElementById('fileMeta')?.click();
  });

  document.getElementById('fileMeta')?.addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (confirm('Restore all preset names and occupied status? This replaces your current list.')) {
        await presetService.importMeta(file);
        initSlots();
        openManager();
      }
    } catch (err) {
      alert(`Failed to import: ${(err as Error).message}`);
    }
    input.value = '';
  });

  // Name modal confirm
  document.getElementById('btnConfirmName')?.addEventListener('click', () => {
    const input = document.getElementById('customNameInput') as HTMLInputElement;
    const modal = document.getElementById('nameModal');
    const slot = Number((document.getElementById('slotSelect') as HTMLSelectElement).value);

    if (slot === 0) {
      alert('Choose slot 1-122 to store.');
      return;
    }

    presetService.store(slot, input.value, false, () => {
      initSlots();
    });
    if (modal) modal.style.display = 'none';
  });
}

// Toggle MIDI
async function toggleMIDI(): Promise<void> {
  const btnEnable = document.getElementById('btnEnableMIDI') as HTMLButtonElement;
  const midiSelect = document.getElementById('midiSelect') as HTMLSelectElement;
  const chanSelect = document.getElementById('chanSelect') as HTMLSelectElement;
  const btnTap = document.getElementById('btnTap') as HTMLButtonElement;

  if (midiService.isEnabled) {
    // Disable
    midiService.disable();
    if (btnEnable) {
      btnEnable.textContent = 'Enable MIDI';
      btnEnable.disabled = false;
    }
    if (midiSelect) {
      midiSelect.disabled = true;
      midiSelect.innerHTML = '<option value="">MIDI Output</option>';
    }
    if (chanSelect) chanSelect.disabled = true;
    if (btnTap) btnTap.disabled = true;
  } else {
    // Enable
    const success = await midiService.enable();
    if (!success) {
      alert('MIDI Access Failed');
      return;
    }

    populateOutputs();
    midiService.setOnStateChange(populateOutputs);

    if (btnEnable) {
      btnEnable.textContent = 'Disable MIDI';
      btnEnable.disabled = false;
    }
    if (midiSelect) midiSelect.disabled = false;
    if (chanSelect) chanSelect.disabled = false;
    if (btnTap) btnTap.disabled = false;
  }

  updateMidiStatusUI();
}

// Populate MIDI outputs
function populateOutputs(): void {
  const sel = document.getElementById('midiSelect') as HTMLSelectElement;
  if (!sel) return;

  const oldVal = sel.value || (window as unknown as { lastMidiOutId?: string }).lastMidiOutId;
  sel.innerHTML = '<option value="">Select Output...</option>';

  const outputs = midiService.getOutputs();
  outputs.forEach(out => {
    const opt = document.createElement('option');
    opt.value = out.id;
    opt.textContent = out.name;
    sel.appendChild(opt);
  });

  if (oldVal) {
    const exists = outputs.some(o => o.id === oldVal);
    if (exists) {
      sel.value = oldVal;
      midiService.selectOutput(oldVal);
    }
  } else if (outputs.length > 0) {
    sel.value = outputs[0].id;
    midiService.selectOutput(outputs[0].id);
  }
}

// Handle tap tempo
function handleTap(): void {
  if (!midiService.isEnabled) {
    alert('Enable MIDI first.');
    return;
  }

  const now = performance.now();
  midiService.sendTap();

  if (lastTapMs !== null) {
    const dt = now - lastTapMs;
    if (dt > 120 && dt < 4000) {
      const bpm = Math.round(60000 / dt);
      const el = document.getElementById('tapReadout');
      if (el) el.textContent = `${bpm} BPM`;
    }
  }
  lastTapMs = now;
}

// Show store dialog
function showStoreDialog(): void {
  const slot = Number((document.getElementById('slotSelect') as HTMLSelectElement).value);
  if (slot === 0) {
    alert('Choose slot 1-122 to store.');
    return;
  }

  const meta = presetService.getMeta();
  const existingName = meta[slot]?.name || '';

  const modal = document.getElementById('nameModal');
  const input = document.getElementById('customNameInput') as HTMLInputElement;

  if (modal && input) {
    input.value = existingName;
    modal.style.display = 'flex';
    input.focus();
  }
}

// Open preset manager
function openManager(): void {
  const meta = presetService.getMeta();
  const tbody = document.getElementById('pmTableBody');
  const pmContent = document.getElementById('pmContent');

  if (!tbody || !pmContent) return;

  // Create swap box if it doesn't exist
  let swapBox = document.getElementById('pmSwapBox');
  if (!swapBox) {
    swapBox = document.createElement('div');
    swapBox.id = 'pmSwapBox';
    swapBox.style.cssText = 'display:flex;align-items:center;gap:8px;margin-right:auto;';

    const lbl = document.createElement('span');
    lbl.innerHTML = '<b>Swap</b> <span style="font-size:10px;color:var(--cream-muted)">(uses #122)</span>: ';
    lbl.style.fontSize = '12px';

    const inputA = document.createElement('input');
    inputA.type = 'number';
    inputA.min = '1';
    inputA.max = '122';
    inputA.placeholder = 'A';
    inputA.id = 'swapSlotA';
    inputA.style.cssText = 'width:48px;padding:4px 6px;border-radius:6px;border:1px solid var(--border);background:var(--bg-input);color:var(--cream);';

    const inputB = document.createElement('input');
    inputB.type = 'number';
    inputB.min = '1';
    inputB.max = '122';
    inputB.placeholder = 'B';
    inputB.id = 'swapSlotB';
    inputB.style.cssText = 'width:48px;padding:4px 6px;border-radius:6px;border:1px solid var(--border);background:var(--bg-input);color:var(--cream);';

    const btnSwap = document.createElement('button');
    btnSwap.textContent = 'Go';
    btnSwap.className = 'pmBtn primary';
    btnSwap.style.padding = '4px 10px';

    const swapStatus = document.createElement('span');
    swapStatus.id = 'swapStatus';
    swapStatus.style.cssText = 'font-size:10px;color:var(--cream-muted);margin-left:4px;';

    btnSwap.onclick = async () => {
      const a = parseInt((document.getElementById('swapSlotA') as HTMLInputElement).value);
      const b = parseInt((document.getElementById('swapSlotB') as HTMLInputElement).value);
      const statusEl = document.getElementById('swapStatus');

      if (!midiService.isEnabled) {
        alert('Enable MIDI first.');
        return;
      }

      if (!a || !b || a < 1 || a > 122 || b < 1 || b > 122 || a === b) {
        alert('Invalid slots. Enter two different numbers between 1-122.');
        return;
      }

      btnSwap.disabled = true;
      btnSwap.textContent = 'Working...';

      try {
        await presetService.swapSlots(a, b, (step) => {
          if (statusEl) statusEl.textContent = step;
        });
        openManager();
        initSlots();
      } catch (e) {
        if (statusEl) statusEl.textContent = 'Error';
        alert('Swap failed: ' + (e as Error).message);
      }

      btnSwap.disabled = false;
      btnSwap.textContent = 'Go';
      setTimeout(() => {
        if (statusEl) statusEl.textContent = '';
      }, 3000);
    };

    swapBox.appendChild(lbl);
    swapBox.appendChild(inputA);
    swapBox.appendChild(document.createTextNode(' ↔ '));
    swapBox.appendChild(inputB);
    swapBox.appendChild(btnSwap);
    swapBox.appendChild(swapStatus);

    // Insert into footer (the div with border-top)
    const footer = pmContent.querySelector('div[style*="border-top"]');
    if (footer) {
      footer.insertBefore(swapBox, footer.firstChild);
      (footer as HTMLElement).style.flexWrap = 'wrap';
      (footer as HTMLElement).style.gap = '12px';
    }
  }

  tbody.innerHTML = '';

  for (let i = 1; i <= presetService.maxSlots; i++) {
    const row = document.createElement('tr');
    const m = meta[i] || { name: '', occupied: false };

    if (i === stateService.currentActiveSlot) {
      row.classList.add('pmRowActive');
    }

    const isBuffer = i === 122;
    row.innerHTML = `
      <td><div class="pmCellWrap center"><span class="pmIndex">${i}</span></div></td>
      <td><div class="pmCellWrap"><input type="text" class="pmName" data-slot="${i}" value="${m.name}" placeholder="Unnamed"></div></td>
      <td><div class="pmCellWrap center">${isBuffer ? '<span style="color:var(--orange);font-size:10px;">BUFFER</span>' : `<input type="checkbox" class="pmOccupied" data-slot="${i}" ${m.occupied ? 'checked' : ''}>`}</div></td>
      <td>
        <div class="pmCellWrap center" style="gap:6px;">
          <button class="pmBtn secondary" data-action="recall" data-slot="${i}">Recall</button>
          <button class="pmBtn primary" data-action="store" data-slot="${i}">Store</button>
        </div>
      </td>
    `;

    // Add event listeners for buttons
    row.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        const slot = Number(btn.dataset.slot);
        if (action === 'recall') {
          presetService.recall(slot);
          openManager();
        } else if (action === 'store') {
          const nameInput = document.querySelector(`.pmName[data-slot="${slot}"]`) as HTMLInputElement;
          presetService.store(slot, nameInput?.value || '', false, () => {
            openManager();
          });
        }
      });
    });

    tbody.appendChild(row);
  }

  const modal = document.getElementById('pmModal');
  if (modal) modal.style.display = 'flex';
}

// Save manager changes
function saveManagerChanges(): void {
  const meta = presetService.getMeta();

  document.querySelectorAll('#pmTableBody tr').forEach(row => {
    const nameInput = row.querySelector('.pmName') as HTMLInputElement;
    const occupiedInput = row.querySelector('.pmOccupied') as HTMLInputElement;
    if (!nameInput) return;

    const slot = nameInput.dataset.slot;
    const name = nameInput.value;
    const occupied = occupiedInput?.checked ?? false;

    if (name || occupied) {
      meta[Number(slot)] = { name, occupied };
    } else {
      delete meta[Number(slot)];
    }
  });

  presetService.setMeta(meta);
  initSlots();

  const modal = document.getElementById('pmModal');
  if (modal) modal.style.display = 'none';
}

// Make functions available globally for modal close buttons
(window as unknown as {
  pmRecall: (slot: number) => void;
  pmStore: (slot: number) => void;
  closeManager: () => void;
  closeNameModal: () => void;
}).pmRecall = (slot: number) => {
  presetService.recall(slot);
  openManager();
};

(window as unknown as { pmStore: (slot: number) => void }).pmStore = (slot: number) => {
  const nameInput = document.querySelector(`.pmName[data-slot="${slot}"]`) as HTMLInputElement;
  presetService.store(slot, nameInput?.value || '', false, () => {
    openManager();
  });
};

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
