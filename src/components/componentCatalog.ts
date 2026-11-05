import type { ComponentKind } from '../types/schematic';

export const COMPONENT_DRAG_TYPE = 'application/x-circuitbender-component';

export const COMPONENT_KINDS: readonly ComponentKind[] = [
  'resistor',
  'capacitor',
  'vsource',
  'ground',
];

export const KIND_LABELS: Record<ComponentKind, string> = {
  resistor: 'Resistor',
  capacitor: 'Capacitor',
  vsource: 'Voltage source',
  ground: 'Ground',
};

export function isComponentKind(value: string): value is ComponentKind {
  return (COMPONENT_KINDS as readonly string[]).includes(value);
}
