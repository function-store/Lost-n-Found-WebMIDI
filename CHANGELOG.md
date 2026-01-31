# Changelog - Pedal Pylot: Lost+Found Edition

All notable changes to the **Lost+Found** MIDI Editor since the initial repository commit.

## [1.3.1] - 2026-01-31 (Persistence & Randomization)
### Added
- **Session Persistence Enhancements**:
  - MIDI Channel selection now persists across page reloads.
  - Selected MIDI Output device is remembered and auto-restored when available.
### Fixed
- **Tap Tempo**: Fixed Tap button not being enabled after MIDI initialization.
- **Smart Randomization**:
  - Modify knobs (L/R) now avoid the 60-68 range (effect off zone) during randomization, ensuring effects remain active.
  - Tap Subdivisions and Unsync are now included in randomization for maximum chaos.

## [1.3.0] - 2026-01-31 (Advanced Dynamic Labels)

## [1.2.2] - 2026-01-31 (Preset Swap)
### Added
- **Preset Swap Tool**:
  - Found in Preset Manage modal (bottom-left footer).
  - Use Slot 122 as a temporary buffer to swap any two hardware presets.
  - Includes progress tracking and metadata (name) swapping.
  - Safe timing delays to ensure hardware reliability.
- **UI Improvements**:
  - Renamed "Sync" button to **Push** and placed it next to Import (Export -> Import -> Push).
  - Removed "Sync+" button to simplify workflow.
  - "Store" prompt includes slot number.
  - Added **Lock** option to L EQ and R EQ knobs.
  - **Dynamic Labels**: Modify knobs now show context-aware function labels (e.g. Decay/Pitch) based on active effect.

## [1.2.1] - 2026-01-31 (State Persistence)
### Added
- **Session Memory**: The editor now remembers your complete setup across reloads.
  - Retains all parameter values, locked knobs, and toggle states.
  - Persists interface preferences: MIDI Channel, Active Preset Slot, Ramping Panel visibility, and `+Ramp` option.
### Fixed
- **Slot Selection Logic**: Fixed an issue where connecting a MIDI device would reset the selected preset slot to #1.

## [1.2.0] - 2026-01-31 (UI Refine & Deep Randomization)
### Added
- **Smart Randomization**:
  - NEW: `+Ramp` option allows conditional randomization of Ramping engine (Speed, Enables, Bounce/Sweep/Polarity).
  - NEW: `randomizeAll` now includes FX Types, Routing mode, and Swap toggles.
  - NEW: Explicit exclusions for settings protection (Latch, Trails, Bank, Clock, Stereo).
- **Advanced Locking**: Use "Lock" checkboxes on middle-column knobs (Mix, Blend, Spill, Glue, Master Wet) to protect them from randomization.
- **Improved Workflow**:
  - `Sync` Button: One-click "Push to Pedal" ensuring hardware matches editor state without saving.
  - One-way Warning badge in topbar to clarify editor-vs-hardware state.

### Changed
- **UI Layout Overhaul**:
  - **Top Bar**: Cleaned up into logical Segmented Control groups (MIDI, Random, Preset, File).
  - **Section Layout**: Moved "Stereo" and "Clock / Tempo" side-by-side for a concise view.
  - **Rebranding**: Renamed "MIDI / Other" -> "Clock / Tempo", "DIP switches" -> "Settings".
  - Moved "Manage" button to Preset group for better access.
- **Control Organization**:
  - Moved "Unsync" control to "Clock / Tempo" section.
  - Removed redundant "Randomize Hidden" button (functionality merged into Randomize All).
- **Fixes**: Correctly mapped individual Ramp Destination CCs (61-65) for precise randomization.

## [1.1.0] - 2026-01-31
### Added
- **Advanced Preset Manager**:
  - NEW: Dedicated management modal for all 122 hardware slots.
  - NEW: Persistent naming system via LocalStorage and direct table editing.
- **Enhanced Store Logic**:
  - NEW: **Quick Store** - Fast hardware-only save (reduced MIDI traffic).
  - NEW: **Sync & Store** - Optional full software-to-hardware sync before saving.
- **Knob Layout Overhaul**:
  - REMOVED: "Secondary knobs" section.
  - NEW: Unified 14-knob grid with logical grouping (L-Side, Center, R-Side) for better ergonomics.
- **Visual Synergy**: 
  - NEW: Active-state highlighting in the manager (blue/green row indicators).
  - NEW: Full sync between the main dashboard dropdown and the manager table.
- **Data Portability**: 
  - NEW: **Export/Import Pattern** - Save knob configurations to JSON.
  - NEW: **Export/Import Library** - Full metadata backup/restore.
- **Premium UX**:
  - NEW: Custom naming modal and sticky-footer navigation in the manager.
### Fixed
- **Layout Logic**: Fixed modal clipping and implemented internal scrolling.
- **Sync Reliability**: Resolved "double-store" metadata bugs and naming propagation issues.
- **Standardization**: Refined export filenames with timestamps and readable naming.

## [1.0.0] - Initial Release (Base Base)
- **Lost+Found MIDI Core**: Full control over 30+ parameters via browser-based MIDI.
- **Interactive Controls**: Custom knobs, tri-state toggles, and dip-switch arrays.
- **Randomization Engine**: Granular randomization for knobs, hidden params, or the entire state.
- **BPM Engine**: Tap tempo integration for time-based effects.
- **Responsive Design**: Premium dark-mode aesthetic with hardware-inspired layout.

---
