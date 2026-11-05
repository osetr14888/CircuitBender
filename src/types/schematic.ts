export type ComponentKind =
  | 'resistor'
  | 'capacitor'
  | 'inductor'
  | 'vsource'
  | 'ground'
  | 'diode'
  | 'npn'
  | 'pnp'
  | 'nmos'
  | 'pmos';

export type PinIndex = 0 | 1 | 2;

export interface PinRef {
  componentId: string;
  index: PinIndex;
}

export interface SchematicComponent {
  id: string;
  kind: ComponentKind;
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
  params: Record<string, number>;
}

export interface SchematicNet {
  id: string;
  pins: [PinRef, PinRef];
}

export interface SchematicProject {
  version: 1;
  name: string;
  components: SchematicComponent[];
  nets: SchematicNet[];
}
