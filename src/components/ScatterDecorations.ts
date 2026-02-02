// Organic scatter decorations inspired by the Chase Bliss Lost+Found pedal
// Now procedurally generated for a unique look on every reload

type ShapeType =
  | 'square' | 'diamond' | 'circle' | 'rect' | 'pentagon'
  | 'squircle' | 'pill' | 'blossom' | 'semicircle' | 'starburst';

type Zone = 'left' | 'center' | 'right';
type Size = 'sm' | 'md' | 'lg';

interface ScatterShape {
  type: ShapeType;
  x: number;       // percentage from left
  y: number;       // percentage from top
  size: Size;
  rotation: number; // degrees
  zone: Zone;
}

const SHAPE_TYPES: ShapeType[] = [
  'square', 'diamond', 'circle', 'rect', 'pentagon',
  'squircle', 'pill', 'blossom', 'semicircle', 'starburst'
];

function getRandomZone(x: number): Zone {
  if (x < 35) return 'left';
  if (x > 65) return 'right';
  return 'center';
}

function getRandomSize(): Size {
  const r = Math.random();
  if (r < 0.4) return 'sm';
  if (r < 0.8) return 'md';
  return 'lg';
}

function generateRandomShapes(count: number): ScatterShape[] {
  const shapes: ScatterShape[] = [];

  for (let i = 0; i < count; i++) {
    const x = Math.random() * 100;
    const y = Math.random() * 100;

    shapes.push({
      type: SHAPE_TYPES[Math.floor(Math.random() * SHAPE_TYPES.length)],
      x,
      y,
      size: getRandomSize(),
      rotation: Math.floor(Math.random() * 360),
      zone: getRandomZone(x)
    });
  }

  return shapes;
}

function createShapeElement(shape: ScatterShape): HTMLDivElement {
  const el = document.createElement('div');

  // Build class list
  const classes = [
    'scatter-shape',
    `scatter-shape--${shape.type}`,
    `scatter-shape--${shape.size}`,
    `scatter-shape--${shape.zone}`
  ];
  el.className = classes.join(' ');

  // Position and rotation
  el.style.left = `${shape.x}%`;
  el.style.top = `${shape.y}%`;

  // Apply rotation
  if (shape.rotation !== 0) {
    el.style.setProperty('--rotation', `${shape.rotation}deg`);
  }

  // Animation variables
  el.style.setProperty('--delay', `${(Math.random() * 5).toFixed(1)}s`);
  el.style.setProperty('--duration', `${(3 + Math.random() * 7).toFixed(1)}s`);
  el.style.setProperty('--drift', `${(Math.random() * 8 - 4).toFixed(1)}%`);

  return el;
}

let currentLayer: HTMLDivElement | null = null;
let shapeEls: HTMLDivElement[] = [];
let animationFrameId: number | null = null;

// Floating state for each shape
interface FloatingState {
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  speed: number; // pixels per second
  nextUpdateTime: number;
}

const floatingStates = new Map<HTMLDivElement, FloatingState>();

function animateFloating() {
  const now = Date.now();

  shapeEls.forEach(el => {
    const state = floatingStates.get(el);
    if (!state) return;

    // Check if it's time to pick a new target
    if (now >= state.nextUpdateTime) {
      state.targetX = Math.random() * 100;
      state.targetY = Math.random() * 100;

      // 5% chance of a quick "scoot", 95% gentle float
      const shouldScoot = false;//Math.random() < 0.001;

      if (shouldScoot) {
        // Quick scoot (rare)
        state.speed = 2 + Math.random() * 2; // 4-8% per second (fast)
        state.nextUpdateTime = now + (1000 + Math.random() * 2000); // 2-5 seconds
      } else {
        // Gentle float (most of the time)
        state.speed = 0.5 + Math.random() * 1; // 0.5-1.5% per second (gentle)
        state.nextUpdateTime = now + (15000 + Math.random() * 10000); // 15-25 seconds
      }

      const zone = getRandomZone(state.targetX);
      el.classList.remove('scatter-shape--left', 'scatter-shape--center', 'scatter-shape--right');
      el.classList.add(`scatter-shape--${zone}`);
    }

    // Smoothly move towards target
    const deltaX = state.targetX - state.currentX;
    const deltaY = state.targetY - state.currentY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance > 0.1) {
      // Move at constant speed
      const moveAmount = (state.speed / 60); // Per frame at 60fps
      const ratio = Math.min(moveAmount / distance, 1);

      state.currentX += deltaX * ratio;
      state.currentY += deltaY * ratio;

      el.style.left = `${state.currentX}%`;
      el.style.top = `${state.currentY}%`;
    }
  });

  // Continue animation loop
  animationFrameId = requestAnimationFrame(animateFloating);
}

export function createScatterLayer(parentEl: HTMLElement): HTMLDivElement {
  const layer = document.createElement('div');
  layer.className = 'scatter-layer';
  currentLayer = layer;
  shapeEls = [];
  floatingStates.clear();

  // Generate ~45 random shapes (organic variety)
  const shapes = generateRandomShapes(45);

  shapes.forEach(shape => {
    const shapeEl = createShapeElement(shape);
    layer.appendChild(shapeEl);
    shapeEls.push(shapeEl);

    // Initialize floating state
    floatingStates.set(shapeEl, {
      currentX: shape.x,
      currentY: shape.y,
      targetX: Math.random() * 100,
      targetY: Math.random() * 100,
      speed: 0.5 + Math.random() * 1, // Start with gentle speed
      nextUpdateTime: Date.now() + (Math.random() * 15000) // Stagger initial updates
    });
  });

  // Insert at the beginning of parent to be behind content
  parentEl.insertBefore(layer, parentEl.firstChild);

  // Start floating animation
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId);
  }
  animationFrameId = requestAnimationFrame(animateFloating);

  return layer;
}

export function randomizeScatter(): void {
  if (!currentLayer || shapeEls.length === 0) return;

  shapeEls.forEach(el => {
    const state = floatingStates.get(el);
    if (!state) return;

    // Generate new position that's far from current position
    let x, y, distance;
    do {
      x = Math.random() * 100;
      y = Math.random() * 100;
      const deltaX = x - state.currentX;
      const deltaY = y - state.currentY;
      distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    } while (distance < 20); // Ensure at least 20% distance for noticeable jump

    const rotation = Math.floor(Math.random() * 360);
    const zone = getRandomZone(x);

    // Update rotation immediately
    el.style.setProperty('--rotation', `${rotation}deg`);

    // Update zone class
    el.classList.remove('scatter-shape--left', 'scatter-shape--center', 'scatter-shape--right');
    el.classList.add(`scatter-shape--${zone}`);

    // Randomize drift too for variety
    el.style.setProperty('--drift', `${(Math.random() * 8 - 4).toFixed(1)}%`);

    // Set new target position with very fast speed
    state.targetX = x;
    state.targetY = y;
    // Very fast speed for randomize - 200% per second (will reach most targets in ~0.5s)
    state.speed = 200;
    // Return to gentle floating after 0.5 seconds
    state.nextUpdateTime = Date.now() + 500;
  });
}
