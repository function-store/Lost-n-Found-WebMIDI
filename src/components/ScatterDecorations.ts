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

export function createScatterLayer(parentEl: HTMLElement): HTMLDivElement {
  const layer = document.createElement('div');
  layer.className = 'scatter-layer';
  currentLayer = layer;
  shapeEls = [];

  // Generate ~45 random shapes (organic variety)
  const shapes = generateRandomShapes(45);

  shapes.forEach(shape => {
    const shapeEl = createShapeElement(shape);
    layer.appendChild(shapeEl);
    shapeEls.push(shapeEl);
  });

  // Insert at the beginning of parent to be behind content
  parentEl.insertBefore(layer, parentEl.firstChild);

  return layer;
}

export function randomizeScatter(): void {
  if (!currentLayer || shapeEls.length === 0) return;

  shapeEls.forEach(el => {
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    const rotation = Math.floor(Math.random() * 360);
    const zone = getRandomZone(x);

    // Update position
    el.style.left = `${x}%`;
    el.style.top = `${y}%`;

    // Update rotation
    el.style.setProperty('--rotation', `${rotation}deg`);

    // Update zone class
    el.classList.remove('scatter-shape--left', 'scatter-shape--center', 'scatter-shape--right');
    el.classList.add(`scatter-shape--${zone}`);

    // Randomize drift too for variety
    el.style.setProperty('--drift', `${(Math.random() * 8 - 4).toFixed(1)}%`);
  });
}
