import type { ComponentKind } from '../types/schematic';

export const COMPONENT_DRAG_TYPE = 'application/x-circuitbender-component';

export const COMPONENT_KINDS: readonly ComponentKind[] = [
  'resistor',
  'capacitor',
  'inductor',
  'vsource',
  'ground',
  'diode',
  'npn',
  'pnp',
  'nmos',
  'pmos',
];

export const KIND_LABELS: Record<ComponentKind, string> = {
  resistor: 'Resistor',
  capacitor: 'Capacitor',
  inductor: 'Inductor',
  vsource: 'Voltage source',
  ground: 'Ground',
  diode: 'Diode',
  npn: 'NPN transistor',
  pnp: 'PNP transistor',
  nmos: 'NMOS transistor',
  pmos: 'PMOS transistor',
};

export function isComponentKind(value: string): value is ComponentKind {
  return (COMPONENT_KINDS as readonly string[]).includes(value);
}
