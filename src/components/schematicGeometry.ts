import type { ComponentKind, PinIndex, SchematicComponent } from '../types/schematic';

export const GRID_SIZE = 20;
export const PIN_RADIUS = 5;

const PIN_INDEXES: Record<ComponentKind, readonly PinIndex[]> = {
  resistor: [0, 1],
  capacitor: [0, 1],
  vsource: [0, 1],
  ground: [0, 1],
  diode: [0, 1],
  npn: [0, 1, 2],
  pnp: [0, 1, 2],
  nmos: [0, 1, 2],
  pmos: [0, 1, 2],
};

const PIN_OFFSETS: Record<ComponentKind, Partial<Record<PinIndex, { x: number; y: number }>>> = {
  resistor: {
    0: { x: -30, y: 0 },
    1: { x: 30, y: 0 },
  },
  capacitor: {
    0: { x: -20, y: 0 },
    1: { x: 20, y: 0 },
  },
  vsource: {
    0: { x: -40, y: 0 },
    1: { x: 40, y: 0 },
  },
  ground: {
    0: { x: -40, y: 0 },
    1: { x: 40, y: 0 },
  },
  diode: {
    0: { x: -20, y: 0 },
    1: { x: 20, y: 0 },
  },
  npn: {
    0: { x: 20, y: -30 },
    1: { x: -40, y: 0 },
    2: { x: 20, y: 30 },
  },
  pnp: {
    0: { x: 20, y: -30 },
    1: { x: -40, y: 0 },
    2: { x: 20, y: 30 },
  },
  nmos: {
    0: { x: 0, y: -40 },
    1: { x: -40, y: 0 },
    2: { x: 0, y: 40 },
  },
  pmos: {
    0: { x: 0, y: -40 },
    1: { x: -40, y: 0 },
    2: { x: 0, y: 40 },
  },
};

const HALF_SIZES: Record<ComponentKind, { halfWidth: number; halfHeight: number }> = {
  resistor: { halfWidth: 35, halfHeight: 15 },
  capacitor: { halfWidth: 25, halfHeight: 15 },
  vsource: { halfWidth: 45, halfHeight: 20 },
  ground: { halfWidth: 45, halfHeight: 25 },
  diode: { halfWidth: 25, halfHeight: 15 },
  npn: { halfWidth: 45, halfHeight: 35 },
  pnp: { halfWidth: 45, halfHeight: 35 },
  nmos: { halfWidth: 45, halfHeight: 45 },
  pmos: { halfWidth: 45, halfHeight: 45 },
};

export function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

export function pinIndexes(kind: ComponentKind): readonly PinIndex[] {
  return PIN_INDEXES[kind];
}

export function pinOffset(
  kind: ComponentKind,
  index: PinIndex,
): { x: number; y: number } {
  return PIN_OFFSETS[kind][index] ?? { x: 0, y: 0 };
}

export function componentHalfSize(kind: ComponentKind): {
  halfWidth: number;
  halfHeight: number;
} {
  return HALF_SIZES[kind];
}

export function pinPosition(
  component: SchematicComponent,
  index: PinIndex,
): { x: number; y: number } {
  const local = pinOffset(component.kind, index);
  const { x, y } = component;
  switch (component.rotation) {
    case 90:
      return { x: x + local.y, y: y - local.x };
    case 180:
      return { x: x - local.x, y: y - local.y };
    case 270:
      return { x: x - local.y, y: y + local.x };
    default:
      return { x: x + local.x, y: y + local.y };
  }
}

export function manhattanWirePoints(
  from: { x: number; y: number },
  to: { x: number; y: number },
): number[] {
  const horizontalFirst = Math.abs(to.x - from.x) >= Math.abs(to.y - from.y);
  const corner = horizontalFirst
    ? { x: to.x, y: from.y }
    : { x: from.x, y: to.y };
  return [
    from.x,
    from.y,
    corner.x,
    corner.y,
    corner.x,
    corner.y,
    to.x,
    to.y,
  ];
}
