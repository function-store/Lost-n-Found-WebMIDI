// Organic scatter decorations inspired by the Chase Bliss Lost+Found pedal

type ShapeType = 'square' | 'diamond' | 'circle' | 'rect' | 'pentagon';
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

// Carefully positioned shapes to create organic scatter effect
// Matches the aesthetic of the physical Lost+Found pedal
const SCATTER_SHAPES: ScatterShape[] = [
  // Left zone (green tints) - around L Time, L Modify knobs
  { type: 'square', x: 4, y: 8, size: 'md', rotation: 15, zone: 'left' },
  { type: 'diamond', x: 12, y: 28, size: 'sm', rotation: 0, zone: 'left' },
  { type: 'circle', x: 6, y: 52, size: 'lg', rotation: 0, zone: 'left' },
  { type: 'rect', x: 18, y: 72, size: 'md', rotation: -12, zone: 'left' },
  { type: 'pentagon', x: 8, y: 88, size: 'sm', rotation: 20, zone: 'left' },
  { type: 'square', x: 22, y: 42, size: 'sm', rotation: 45, zone: 'left' },

  // Center zone (muted cream) - around Mix, Blend knobs
  { type: 'circle', x: 42, y: 12, size: 'sm', rotation: 0, zone: 'center' },
  { type: 'rect', x: 52, y: 35, size: 'md', rotation: -25, zone: 'center' },
  { type: 'square', x: 48, y: 65, size: 'sm', rotation: 30, zone: 'center' },
  { type: 'diamond', x: 55, y: 85, size: 'md', rotation: 0, zone: 'center' },

  // Right zone (yellow tints) - around R Time, R Modify knobs
  { type: 'diamond', x: 78, y: 15, size: 'lg', rotation: 0, zone: 'right' },
  { type: 'square', x: 88, y: 32, size: 'md', rotation: -18, zone: 'right' },
  { type: 'circle', x: 82, y: 55, size: 'sm', rotation: 0, zone: 'right' },
  { type: 'rect', x: 92, y: 48, size: 'sm', rotation: 35, zone: 'right' },
  { type: 'pentagon', x: 85, y: 75, size: 'md', rotation: -10, zone: 'right' },
  { type: 'square', x: 75, y: 90, size: 'sm', rotation: 22, zone: 'right' },
];

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

  // Apply rotation (combine with any transform from the shape type)
  if (shape.rotation !== 0) {
    el.style.setProperty('--rotation', `${shape.rotation}deg`);
  }

  return el;
}

export function createScatterLayer(parentEl: HTMLElement): HTMLDivElement {
  const layer = document.createElement('div');
  layer.className = 'scatter-layer';

  // Create all scatter shapes
  SCATTER_SHAPES.forEach(shape => {
    const shapeEl = createShapeElement(shape);
    layer.appendChild(shapeEl);
  });

  // Insert at the beginning of parent to be behind content
  parentEl.insertBefore(layer, parentEl.firstChild);

  return layer;
}
