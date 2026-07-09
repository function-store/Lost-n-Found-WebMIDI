import './styles/main.css';
import { midiService, stateService, presetService, randomizerService, cloudService, scribbleService } from './services';
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
  showAlert,
  showConfirm,
  showPrompt,
} from './components';
import { createScatterLayer, randomizeScatter } from './components/ScatterDecorations';
import { EFFECTS, KNOBS, CONTROLS } from './config';
import { triPosFromValue, getVariantFromModify, createElement } from './utils/helpers';
import type { Side, MIDIChannel, KnobKind, CCNumber } from './types';

// Tap tempo state
let lastTapMs: number | null = null;

// Initialize the application
function init(): void {
  console.log('[Lost+Found Editor] Initializing...');

  buildUI();
  setupEventListeners();
  stateService.load();
  fillChannels(); // Update UI with loaded channel
  updateReadout();
  initSlots();
  updateAutoRecallUI();
  updateMidiStatusUI();

  midiService.setOnStateChange(() => {
    updateMidiStatusUI();
  });

  setupCloudUI();

  console.log('[Lost+Found Editor] Ready');
}

async function downloadFromCloud(silent = false): Promise<void> {
  try {
    updateCloudStatusUI('syncing', silent ? undefined : 'Downloading...');
    const cloudPresets = await cloudService.loadPresets();
    if (cloudPresets) {
      presetService.setMeta(cloudPresets);
      initSlots();
      const modal = document.getElementById('pmModal');
      if (modal && getComputedStyle(modal).display !== 'none') openManager();
      updateCloudStatusUI('online', 'Synced');
      if (!silent) showAlert('Downloaded from Cloud!');
    } else {
      updateCloudStatusUI('online', 'No backup');
      if (!silent) showAlert('No backup found.');
    }
  } catch (err) {
    updateCloudStatusUI('error');
    if (!silent) showAlert('Download failed: ' + (err as Error).message);
  }
}

async function triggerAutoUpload(): Promise<boolean> {
  if (stateService.autoSync && cloudService.currentUser) {
    try {
      updateCloudStatusUI('syncing', 'Uploading...');
      const meta = presetService.getMeta();
      await cloudService.savePresets(meta);
      updateCloudStatusUI('online', 'Synced');
      return true;
    } catch (e) {
      console.error('Auto-upload failed:', e);
      updateCloudStatusUI('error', 'Upload failed');
      return false;
    }
  } else if (cloudService.currentUser && !stateService.autoSync) {
    updateCloudStatusUI('modified');
  }
  return false;
}

function setupCloudUI(): void {
  let isManualLogin = false;

  // Finish a pending email-link sign-in (page was opened via a login link).
  if (cloudService.isEmailLinkLogin()) {
    isManualLogin = true;
    cloudService.completeEmailLinkLogin().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      showAlert(`Email login failed: ${message}`);
    });
  }

  const attachCloudSyncUI = (container: HTMLElement) => {
    const wrapper = createElement('div');
    wrapper.style.position = 'relative';
    wrapper.style.display = 'flex';
    wrapper.style.alignItems = 'center';

    const syncBtn = createElement('button');
    syncBtn.id = 'btnCloudSync';
    syncBtn.style.cssText = 'background:transparent;border:none;color:var(--cream-muted);cursor:pointer;font-size:14px;margin-left:3px;opacity:0.4;transition:opacity 0.2s;';
    syncBtn.textContent = '☁️';
    syncBtn.title = 'Cloud Sync & Account';

    // Cloud Menu
    const menu = createElement('div', 'cloud-menu');
    menu.style.display = 'none';

    wrapper.appendChild(syncBtn);
    wrapper.appendChild(menu);
    container.appendChild(wrapper);

    const rebuildMenu = (user: any) => {
      menu.innerHTML = '';
      if (user) {
        // Auto-Sync Toggle
        const syncGroup = createElement('div');
        syncGroup.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border);margin-bottom:4px;';

        const syncLbl = createElement('label');
        syncLbl.style.cssText = 'font-size:11px;color:var(--cream);cursor:pointer;display:flex;align-items:center;gap:6px;width:100%;';
        syncLbl.innerHTML = `<input type="checkbox" ${stateService.autoSync ? 'checked' : ''}> 🔄 Auto-Sync`;

        syncLbl.onchange = async (e) => {
          const chk = (e.currentTarget as HTMLElement).querySelector('input') as HTMLInputElement;
          const isChecked = chk.checked;

          stateService.autoSync = isChecked;
          stateService.save();

          if (isChecked) {
            if (await showConfirm('Download presets from Cloud now?')) {
              await downloadFromCloud();
            } else {
              triggerAutoUpload();
            }
          } else {
            updateCloudStatusUI('modified', 'Sync Off');
          }
        };

        syncGroup.appendChild(syncLbl);
        menu.appendChild(syncGroup);

        const header = createElement('div', 'menu-header');
        header.textContent = user.displayName || user.email || 'USER';
        menu.appendChild(header);

        const btnUpload = createElement('button');
        btnUpload.textContent = '⬆ Upload to Cloud';
        btnUpload.onclick = async (e) => {
          e.stopPropagation();
          menu.style.display = 'none';
          if (!await showConfirm('Overwrite Cloud backup with current Local presets?')) return;
          try {
            updateCloudStatusUI('syncing');
            const meta = presetService.getMeta();
            await cloudService.savePresets(meta);
            updateCloudStatusUI('online');
            showAlert('Uploaded!');
          } catch (err) {
            updateCloudStatusUI('error');
            showAlert('Upload failed: ' + (err as Error).message);
          }
        };

        const btnDownload = createElement('button');
        btnDownload.textContent = '⬇ Download from Cloud';
        btnDownload.onclick = async (e) => {
          e.stopPropagation();
          menu.style.display = 'none';
          if (!await showConfirm('Overwrite Local presets with Cloud backup?')) return;
          await downloadFromCloud();
        };

        menu.appendChild(btnUpload);
        menu.appendChild(btnDownload);
        menu.appendChild(createElement('div', 'menu-sep'));

        const btnLogout = createElement('button');
        btnLogout.textContent = '🚪 Logout';
        btnLogout.onclick = async (e) => {
          e.stopPropagation();
          menu.style.display = 'none';
          if (await showConfirm('Logout?')) cloudService.logout();
        };
        menu.appendChild(btnLogout);
        syncBtn.style.opacity = '1';
        syncBtn.style.color = 'var(--yellow)';
      } else {
        updateCloudStatusUI('offline');
        const btnLogin = createElement('button');
        btnLogin.textContent = '🔑 Login with Google';
        btnLogin.onclick = (e) => {
          e.stopPropagation();
          menu.style.display = 'none';
          isManualLogin = true;
          cloudService.login().catch((error) => {
            const message = error instanceof Error ? error.message : String(error);
            showAlert(`Google login failed: ${message}`);
          });
        };
        menu.appendChild(btnLogin);

        const btnEmailLogin = createElement('button');
        btnEmailLogin.textContent = '✉️ Login with Email';
        btnEmailLogin.onclick = async (e) => {
          e.stopPropagation();
          menu.style.display = 'none';
          const email = await showPrompt('Enter your email address (use the same one as your Google account to keep your presets):');
          if (!email) return;
          try {
            await cloudService.sendLoginLink(email.trim());
            showAlert('Login link sent! Check your inbox (and spam folder). Open the email on this device, copy the link, and paste it into THIS browser\'s address bar to finish signing in.');
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            showAlert(`Could not send login link: ${message}`);
          }
        };
        menu.appendChild(btnEmailLogin);

        syncBtn.style.opacity = '0.4';
        syncBtn.style.color = 'var(--cream-muted)';
      }
    };

    syncBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
    });
    window.addEventListener('click', () => {
      menu.style.display = 'none';
    });

    cloudService.onUserChange(async (user) => {
      rebuildMenu(user);

      if (user) {
        if (isManualLogin) {
          isManualLogin = false;
          if (await showConfirm('Enable Auto-Sync? This will keep your presets backed up automatically.')) {
            stateService.autoSync = true;
            stateService.save();
            // Rebuild menu to show checked state
            rebuildMenu(user);
            if (await showConfirm('Download presets from Cloud now?')) {
              await downloadFromCloud();
            } else {
              // Assuming if they enabled auto-sync but didn't download, 
              // they want their current local state to be the source of truth.
              triggerAutoUpload();
            }
          } else {
            // User denied Auto-Sync, but still ask about download
            if (await showConfirm('Download presets from Cloud?')) {
              await downloadFromCloud();
            }
          }
        } else {
          // Automatic login (Page load)
          if (stateService.autoSync) {
            downloadFromCloud(true); // Silent download
          } else {
            updateCloudStatusUI('online', 'Connected');
          }
        }
      } else {
        updateCloudStatusUI('offline');
      }
    });
  };

  // Topbar
  const tbGroups = document.querySelectorAll('.topbar .tbGroup');
  if (tbGroups[2]) attachCloudSyncUI(tbGroups[2] as HTMLElement);

  // Manage Modal
  const pmCloudActions = document.getElementById('pmCloudActions');
  if (pmCloudActions) attachCloudSyncUI(pmCloudActions);
}

function updateMidiStatusUI(): void {
  const isEnabled = midiService.isEnabled;
  document.body.classList.toggle('midi-disabled', !isEnabled);

  const btnEnable = document.getElementById('btnEnableMIDI');
  if (btnEnable) {
    btnEnable.classList.toggle('on', isEnabled);
    btnEnable.setAttribute('data-tip', isEnabled ? 'Disable MIDI' : 'Enable MIDI');
  }
}

function updateCloudStatusUI(status: 'offline' | 'online' | 'syncing' | 'error' | 'modified', text?: string): void {
  const dot = document.getElementById('cloudStatusDot');
  const txt = document.getElementById('cloudStatusText');
  if (!dot || !txt) return;

  const colors = {
    offline: '#666',
    online: '#4CAF50',
    syncing: '#FFC107',
    modified: '#FF9800',
    error: '#F44336'
  };

  dot.style.background = colors[status];
  const label = text || (
    status === 'offline' ? 'Offline' :
      status === 'online' ? 'Synced' :
        status === 'syncing' ? 'Syncing...' :
          status === 'modified' ? 'Modified' :
            'Error'
  );
  txt.textContent = label;
  // Text is visually hidden; expose the status on hover instead
  const container = document.getElementById('cloudStatus');
  if (container) container.title = `Cloud: ${label} — tracks local changes vs Cloud backup`;
}

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

  // Separate tri-blocks into FX selectors and Routing
  const leftFxBlock = CONTROLS.triBlocks.find(b => b.id === 'leftFx');
  const rightFxBlock = CONTROLS.triBlocks.find(b => b.id === 'rightFx');
  const routingBlock = CONTROLS.triBlocks.find(b => b.id === 'routing');

  // Create knob grid
  KNOBS.layout.forEach(knob => {
    createKnobBlock({
      label: knob.label,
      cc: knob.cc as CCNumber,
      kind: knob.kind as KnobKind,
      column: knob.column,
      onUpdateReadout: updateReadout,
    }, knobGrid);

    // After creating Blend knob (CC 18), add Routing positioned between rows
    if (knob.cc === 18 && routingBlock) {
      // Find the Blend knob block that was just created
      const blendBlock = knobGrid.querySelector('.knobBlock:last-child') as HTMLElement;
      if (blendBlock) {
        // Make blend block position: relative so routing can be absolutely positioned
        blendBlock.style.position = 'relative';

        const routingContainer = createElement('div', 'routingBetweenRows');
        createTriBlock({
          title: routingBlock.title,
          cc: routingBlock.cc,
          options: routingBlock.options,
          swappedOptions: routingBlock.swappedOptions,
          side: routingBlock.side as Side | null,
          engageCC: routingBlock.engageCC,
          swapCC: routingBlock.swapCC,
          hasRandomize: routingBlock.hasRandomize,
          onRandomizeColumn: (side: Side) => randomizerService.randomizeColumn(side),
          onUpdateReadout: updateReadout,
          noSpacer: true,
        }, routingContainer);

        // Add compact class to the tri-block inside the container
        const triBlock = routingContainer.querySelector('.toggleBlock');
        if (triBlock) triBlock.classList.add('triBlock--compact');

        // Create lock button directly here, not in TriBlock - cleaner architecture
        const lockBtn = createElement('button', 'lockIconBtnMini');
        const isLocked = stateService.isLocked(22);
        lockBtn.innerHTML = isLocked ? '🔒' : '🔓';
        lockBtn.classList.toggle('locked', isLocked);

        lockBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const newState = !stateService.isLocked(22);
          stateService.setLocked(22, newState);
          lockBtn.innerHTML = newState ? '🔒' : '🔓';
          lockBtn.classList.toggle('locked', newState);
        });

        // Append lock directly to routing container
        routingContainer.appendChild(lockBtn);

        blendBlock.appendChild(routingContainer);
      }
    }
  });

  // Add Left FX to knob grid
  if (leftFxBlock) {
    const leftFxContainer = createElement('div', 'knobBlock');
    leftFxContainer.classList.add('triBlock--inGrid');
    createTriBlock({
      title: leftFxBlock.title,
      cc: leftFxBlock.cc,
      options: leftFxBlock.options,
      swappedOptions: leftFxBlock.swappedOptions,
      side: leftFxBlock.side as Side | null,
      engageCC: leftFxBlock.engageCC,
      swapCC: leftFxBlock.swapCC,
      hasRandomize: leftFxBlock.hasRandomize,
      onRandomizeColumn: (side: Side) => randomizerService.randomizeColumn(side),
      onUpdateReadout: updateReadout,
    }, leftFxContainer);
    knobGrid.appendChild(leftFxContainer);
  }

  // Master Wet knob (Center column between FX)
  createKnobBlock({
    label: KNOBS.masterWet.label,
    cc: KNOBS.masterWet.cc as CCNumber,
    kind: KNOBS.masterWet.kind as KnobKind,
    onUpdateReadout: updateReadout,
    small: true, // Make it smaller!
  }, knobGrid);


  // Random Controls - floating below Master Wet
  const masterWetBlock = knobGrid.querySelector('.knobBlock:last-child') as HTMLElement;
  if (masterWetBlock) {
    masterWetBlock.style.position = 'relative';

    const randomFloater = createElement('div', 'randomFloater');

    const randomLabel = createElement('div', 'randomFloater__label');
    randomLabel.textContent = 'RANDOM';

    const buttonRow = createElement('div', 'randomFloater__btns');

    const btnRandomAll = createElement('button', 'randomFloater__btn');
    btnRandomAll.id = 'btnRandom';
    btnRandomAll.textContent = 'ALL';
    btnRandomAll.title = 'Randomize All';

    const btnRandomKnobs = createElement('button', 'randomFloater__btn');
    btnRandomKnobs.id = 'btnRandomKnobs';
    btnRandomKnobs.textContent = 'KNOBS';
    btnRandomKnobs.title = 'Randomize Knobs Only';

    buttonRow.appendChild(btnRandomAll);
    buttonRow.appendChild(btnRandomKnobs);

    const bottomRow = createElement('div', 'randomFloater__row');

    const rampLabel = createElement('label', 'randomFloater__ramp');
    rampLabel.title = 'Include Ramp Controls in Random All';

    const chkInclRamp = createElement('input');
    chkInclRamp.id = 'chkInclRamp';
    chkInclRamp.type = 'checkbox';
    chkInclRamp.className = 'toggleSwitch toggleSwitch--xs';
    if (stateService.inclRamp) chkInclRamp.checked = true;

    const rampText = createElement('span');
    rampText.textContent = '+Ramp';

    rampLabel.appendChild(chkInclRamp);
    rampLabel.appendChild(rampText);

    const btnUnlockAll = createElement('span');
    btnUnlockAll.id = 'btnUnlockAll';
    btnUnlockAll.textContent = '🔓';
    btnUnlockAll.title = 'Unlock All Knobs';

    bottomRow.appendChild(rampLabel);
    bottomRow.appendChild(btnUnlockAll);

    randomFloater.appendChild(randomLabel);
    randomFloater.appendChild(buttonRow);
    randomFloater.appendChild(bottomRow);

    masterWetBlock.appendChild(randomFloater);
  }

  // Add Right FX to knob grid
  if (rightFxBlock) {
    const rightFxContainer = createElement('div', 'knobBlock');
    rightFxContainer.classList.add('triBlock--inGrid');
    createTriBlock({
      title: rightFxBlock.title,
      cc: rightFxBlock.cc,
      options: rightFxBlock.options,
      swappedOptions: rightFxBlock.swappedOptions,
      side: rightFxBlock.side as Side | null,
      engageCC: rightFxBlock.engageCC,
      swapCC: rightFxBlock.swapCC,
      hasRandomize: rightFxBlock.hasRandomize,
      onRandomizeColumn: (side: Side) => randomizerService.randomizeColumn(side),
      onUpdateReadout: updateReadout,
    }, rightFxContainer);
    knobGrid.appendChild(rightFxContainer);
  }

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
    noSpacer: true,
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

// Step preset slot up/down (wraps around, slot 0 = Live)
function stepSlot(delta: number): void {
  const sel = document.getElementById('slotSelect') as HTMLSelectElement;
  if (!sel) return;

  const max = presetService.maxSlots;
  let slot = Number(sel.value) + delta;
  if (slot < 0) slot = max;
  if (slot > max) slot = 0;

  sel.value = String(slot);
  stateService.currentActiveSlot = slot;
  stateService.save();

  if (stateService.autoRecall) presetService.recall(slot);
}

function updateAutoRecallUI(): void {
  document.getElementById('btnAutoRecall')?.classList.toggle('active', stateService.autoRecall);
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
  const lDetail = leftAB === 'NONE' ? null : effectDetails[leftFamily]?.[leftAB === 'B' ? 'B' : 'A'];
  const rDetail = rightAB === 'NONE' ? null : effectDetails[rightFamily]?.[rightAB === 'B' ? 'B' : 'A'];

  if (leftAB === 'NONE') {
    // Show NONE for all left column sub-labels
    stateService.getControl(14)?.subLabel && (stateService.getControl(14)!.subLabel!.textContent = 'NONE');
    stateService.getControl(17)?.subLabel && (stateService.getControl(17)!.subLabel!.textContent = 'NONE');
    stateService.getControl(24)?.subLabel && (stateService.getControl(24)!.subLabel!.textContent = 'NONE');
  } else if (lDetail) {
    stateService.getControl(14)?.subLabel && (stateService.getControl(14)!.subLabel!.textContent = lDetail.time);
    stateService.getControl(17)?.subLabel && (stateService.getControl(17)!.subLabel!.textContent = lDetail.modify);
    stateService.getControl(24)?.subLabel && (stateService.getControl(24)!.subLabel!.textContent = lDetail.alt);
  }

  if (rightAB === 'NONE') {
    // Show NONE for all right column sub-labels
    stateService.getControl(16)?.subLabel && (stateService.getControl(16)!.subLabel!.textContent = 'NONE');
    stateService.getControl(19)?.subLabel && (stateService.getControl(19)!.subLabel!.textContent = 'NONE');
    stateService.getControl(26)?.subLabel && (stateService.getControl(26)!.subLabel!.textContent = 'NONE');
  } else if (rDetail) {
    stateService.getControl(16)?.subLabel && (stateService.getControl(16)!.subLabel!.textContent = rDetail.time);
    stateService.getControl(19)?.subLabel && (stateService.getControl(19)!.subLabel!.textContent = rDetail.modify);
    stateService.getControl(26)?.subLabel && (stateService.getControl(26)!.subLabel!.textContent = rDetail.alt);
  }
}

// Setup event listeners
function setupEventListeners(): void {
  // MIDI Toggle
  document.getElementById('btnEnableMIDI')?.addEventListener('click', toggleMIDI);

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
    randomizeScatter(); // Re-roll background
    updateReadout();
  });

  document.getElementById('btnRandomKnobs')?.addEventListener('click', () => {
    const inclRamp = (document.getElementById('chkInclRamp') as HTMLInputElement)?.checked ?? false;
    randomizerService.randomizeKnobs(inclRamp);
    randomizeScatter(); // Re-roll background
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
  document.getElementById('btnSlotUp')?.addEventListener('click', () => stepSlot(1));
  document.getElementById('btnSlotDown')?.addEventListener('click', () => stepSlot(-1));

  document.getElementById('btnAutoRecall')?.addEventListener('click', () => {
    stateService.autoRecall = !stateService.autoRecall;
    stateService.save();
    updateAutoRecallUI();
  });

  document.getElementById('btnRecall')?.addEventListener('click', () => {
    const slot = Number((document.getElementById('slotSelect') as HTMLSelectElement).value);
    presetService.recall(slot);
  });

  document.getElementById('btnStore')?.addEventListener('click', () => {
    showStoreDialog();
  });

  document.getElementById('btnPushOnly')?.addEventListener('click', (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    if (!midiService.isEnabled) {
      showAlert('Enable MIDI first.');
      return;
    }
    const originalHTML = btn.innerHTML;
    btn.style.opacity = '0.5';
    btn.disabled = true;

    stateService.pushToPedal(() => {
      btn.innerHTML = originalHTML;
      btn.style.opacity = '';
      btn.disabled = false;
    });
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
      showAlert(`Preset load failed: ${(err as Error).message}`);
    }
  });

  // Slot select change
  document.getElementById('slotSelect')?.addEventListener('change', () => {
    const slot = Number((document.getElementById('slotSelect') as HTMLSelectElement).value);
    stateService.currentActiveSlot = slot;
    stateService.save();
    if (stateService.autoRecall) presetService.recall(slot);
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
      if (await showConfirm('Restore all preset names and occupied status? This replaces your current list.')) {
        await presetService.importMeta(file);
        initSlots();
        openManager();
        triggerAutoUpload();
      }
    } catch (err) {
      showAlert(`Meta load failed: ${(err as Error).message}`);
    }
  });

  // Scribble compatibility export
  document.getElementById('btnExportScribble')?.addEventListener('click', async () => {
    const useBase = await showConfirm(
      'Merge preset names into a config exported from the Scribble editor? This keeps all your device settings.\n\nCancel to export a default template instead.',
      'Scribble Export'
    );
    if (useBase) {
      document.getElementById('fileScribble')?.click();
    } else {
      scribbleService.exportDefault();
    }
  });

  document.getElementById('fileScribble')?.addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      await scribbleService.exportMerged(file);
    } catch (err) {
      showAlert(`Scribble export failed: ${(err as Error).message}`);
    }
  });

  // Info Modal
  document.getElementById('btnShowInfo')?.addEventListener('click', () => {
    const modal = document.getElementById('infoModal');
    if (modal) modal.style.display = 'flex';
  });
}


// Name modal confirm
const btnConfirmName = document.getElementById('btnConfirmName');
const customNameInput = document.getElementById('customNameInput') as HTMLInputElement;

const handleConfirmStore = () => {
  const slot = Number((document.getElementById('slotSelect') as HTMLSelectElement).value);
  if (slot === 0) {
    showAlert('Choose slot 1-122 to store.');
    return;
  }

  presetService.store(slot, customNameInput.value, false, () => {
    initSlots();
    triggerAutoUpload();

    // If manager is ALREADY open (visible), refresh it.
    // Check computed style to correctly detect visibility.
    const modal = document.getElementById('pmModal');
    if (modal && getComputedStyle(modal).display !== 'none') {
      openManager();
    }
  });

  const modal = document.getElementById('nameModal');
  if (modal) modal.style.display = 'none';
};

btnConfirmName?.addEventListener('click', handleConfirmStore);
customNameInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    handleConfirmStore();
  }
});

// Escape to close modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const pmModal = document.getElementById('pmModal');
    const nameModal = document.getElementById('nameModal');
    const cloudMenu = document.querySelector('.cloud-menu') as HTMLElement;

    if (pmModal && getComputedStyle(pmModal).display !== 'none') {
      pmModal.style.display = 'none';
    }
    if (nameModal && getComputedStyle(nameModal).display !== 'none') {
      nameModal.style.display = 'none';
    }
    if (cloudMenu && getComputedStyle(cloudMenu).display !== 'none') {
      cloudMenu.style.display = 'none';
    }
    const infoModal = document.getElementById('infoModal');
    if (infoModal && getComputedStyle(infoModal).display !== 'none') {
      infoModal.style.display = 'none';
    }
  }
});


// Toggle MIDI
async function toggleMIDI(): Promise<void> {
  const btnEnable = document.getElementById('btnEnableMIDI') as HTMLButtonElement;
  const midiSelect = document.getElementById('midiSelect') as HTMLSelectElement;
  const chanSelect = document.getElementById('chanSelect') as HTMLSelectElement;
  const btnTap = document.getElementById('btnTap') as HTMLButtonElement;

  if (midiService.isEnabled) {
    // Disable
    midiService.disable();
    if (btnEnable) btnEnable.disabled = false;
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
      showAlert('MIDI Access Failed');
      return;
    }

    populateOutputs();
    midiService.setOnStateChange(populateOutputs);

    if (btnEnable) btnEnable.disabled = false;
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
    showAlert('Enable MIDI first.');
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
    showAlert('Choose slot 1-122 to store.');
    return;
  }

  const meta = presetService.getMeta();
  const existingName = meta[slot]?.name || '';

  const modal = document.getElementById('nameModal');
  const input = document.getElementById('customNameInput') as HTMLInputElement;
  const slotLabel = document.getElementById('storeSlotLabel');

  if (modal && input) {
    if (slotLabel) slotLabel.textContent = `(Slot ${slot})`;
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

    const swapStatus = document.createElement('span');
    swapStatus.id = 'swapStatus';
    swapStatus.style.cssText = 'font-size:10px;color:var(--cream-muted);margin-left:4px;';

    btnSwap.onclick = async () => {
      const a = parseInt((document.getElementById('swapSlotA') as HTMLInputElement).value);
      const b = parseInt((document.getElementById('swapSlotB') as HTMLInputElement).value);
      const statusEl = document.getElementById('swapStatus');

      if (!midiService.isEnabled) {
        showAlert('Enable MIDI first.');
        return;
      }

      if (!a || !b || a < 1 || a > 122 || b < 1 || b > 122 || a === b) {
        showAlert('Invalid slots. Enter two different numbers between 1-122.');
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
        triggerAutoUpload();
      } catch (e) {
        if (statusEl) statusEl.textContent = 'Error';
        showAlert('Swap failed: ' + (e as Error).message);
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
          <button class="pmBtn secondary" data-action="export" data-slot="${i}" title="Export this slot to JSON" ${!m.occupied ? 'disabled' : ''}>Export</button>
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
            initSlots();
            triggerAutoUpload();
          });
        } else if (action === 'export') {
          presetService.exportSlot(slot);
        }
      });
    });

    // Auto-save on change
    const nameInput = row.querySelector('.pmName') as HTMLInputElement;
    const occInput = row.querySelector('.pmOccupied') as HTMLInputElement;

    const handleAutoSave = () => {
      const meta = presetService.getMeta();
      const existing = meta[i];
      const newName = nameInput.value;
      const newOcc = occInput.checked;

      if (newName || newOcc) {
        meta[i] = { ...existing, name: newName, occupied: newOcc };
      } else {
        delete meta[i];
      }
      presetService.setMeta(meta);
      initSlots();
      triggerAutoUpload();
    };

    nameInput?.addEventListener('change', handleAutoSave);
    occInput?.addEventListener('change', handleAutoSave);

    tbody.appendChild(row);
  }

  const modal = document.getElementById('pmModal');
  if (modal) modal.style.display = 'flex';
}

// Save function is now handled automatically per-row, ensuring instant updates.
// We keep this function stub in case it's referenced elsewhere, but it's largely superseded.
function saveManagerChanges(): void {
  // no-op or full scan if needed
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
    initSlots();
    triggerAutoUpload();
  });
};

// Console access for tuning the outgoing CC throttle against the pedal's
// real intake rate, e.g. midiService.setCCThrottleInterval(100)
(window as unknown as { midiService: typeof midiService }).midiService = midiService;

// Alt/Option key enables tooltips
window.addEventListener('keydown', (e) => {
  if (e.altKey) document.body.classList.add('tooltips-enabled');
});
window.addEventListener('keyup', (e) => {
  if (!e.altKey) document.body.classList.remove('tooltips-enabled');
});
window.addEventListener('blur', () => {
  document.body.classList.remove('tooltips-enabled');
});

// Position fixed tooltips on hover (only show innermost tooltip)
let activeTooltipEl: HTMLElement | null = null;
document.addEventListener('mouseover', (e) => {
  const target = (e.target as HTMLElement).closest('[data-tooltip]') as HTMLElement;
  if (activeTooltipEl && activeTooltipEl !== target) {
    activeTooltipEl.classList.remove('tooltip-active');
  }
  if (!target) {
    activeTooltipEl = null;
    return;
  }
  const rect = target.getBoundingClientRect();
  target.style.setProperty('--tooltip-x', `${rect.left + rect.width / 2}px`);
  target.style.setProperty('--tooltip-y', `${rect.top - 12}px`);
  target.classList.add('tooltip-active');
  activeTooltipEl = target;
});
document.addEventListener('mouseout', (e) => {
  const target = (e.target as HTMLElement).closest('[data-tooltip]') as HTMLElement;
  if (target) target.classList.remove('tooltip-active');
});

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
