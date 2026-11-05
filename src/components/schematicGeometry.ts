import type { PinIndex, SchematicComponent } from '../types/schematic';

export const GRID_SIZE = 20;
export const COMPONENT_WIDTH = 80;
export const COMPONENT_HEIGHT = 40;
export const PIN_RADIUS = 5;

export function snapToGrid(value: number): number {
  return Math.round(value / GRID_SIZE) * GRID_SIZE;
}

const PIN_OFFSETS: Record<PinIndex, { x: number; y: number }> = {
  0: { x: -COMPONENT_WIDTH / 2, y: 0 },
  1: { x: COMPONENT_WIDTH / 2, y: 0 },
};

export function pinPosition(
  component: SchematicComponent,
  index: PinIndex,
): { x: number; y: number } {
  const local = PIN_OFFSETS[index];
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
