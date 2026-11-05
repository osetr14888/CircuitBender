import { create } from 'zustand';
import type {
  ComponentKind,
  PinRef,
  SchematicComponent,
  SchematicNet,
  SchematicProject,
} from '../types/schematic';

const DEFAULT_PARAMS: Record<ComponentKind, Record<string, number>> = {
  resistor: { resistance: 1000 },
  capacitor: { capacitance: 1e-6 },
  inductor: { inductance: 1e-3 },
  vsource: { voltage: 5 },
  ground: {},
  diode: {},
  npn: {},
  pnp: {},
  nmos: {},
  pmos: {},
};

const initialProject: SchematicProject = {
  version: 1,
  name: 'Untitled',
  components: [],
  nets: [],
};

let nextComponentNumber = 0;
let nextNetNumber = 0;

function createComponent(kind: ComponentKind, x: number, y: number): SchematicComponent {
  nextComponentNumber += 1;
  return {
    id: `${kind}-${nextComponentNumber}`,
    kind,
    x,
    y,
    rotation: 0,
    params: { ...DEFAULT_PARAMS[kind] },
  };
}

function maxIdSuffix(ids: string[]): number {
  return ids.reduce((max, id) => {
    const match = /-(\d+)$/.exec(id);
    if (match === null) {
      return max;
    }
    const value = Number(match[1]);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
}

function samePin(a: PinRef, b: PinRef): boolean {
  return a.componentId === b.componentId && a.index === b.index;
}

function netConnects(net: SchematicNet, a: PinRef, b: PinRef): boolean {
  return (
    (samePin(net.pins[0], a) && samePin(net.pins[1], b)) ||
    (samePin(net.pins[0], b) && samePin(net.pins[1], a))
  );
}

interface AppState {
  project: SchematicProject;
  selectedId: string | null;
  selectedNetId: string | null;
  cloudProjectId: string | null;
  isProjectLoading: boolean;
  addComponent: (kind: ComponentKind, x: number, y: number) => void;
  updateComponentPosition: (id: string, x: number, y: number) => void;
  updateComponentParam: (id: string, key: string, value: number) => void;
  addNet: (pin1: PinRef, pin2: PinRef) => void;
  select: (id: string | null) => void;
  selectNet: (id: string | null) => void;
  removeComponent: (id: string) => void;
  removeNet: (id: string) => void;
  loadProject: (project: SchematicProject, cloudProjectId: string | null) => void;
  setCloudProjectId: (id: string | null) => void;
  setProjectLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>()((set) => ({
  project: initialProject,
  selectedId: null,
  selectedNetId: null,
  cloudProjectId: null,
  isProjectLoading: false,
  addComponent: (kind, x, y) =>
    set((state) => ({
      project: {
        ...state.project,
        components: [...state.project.components, createComponent(kind, x, y)],
      },
    })),
  updateComponentPosition: (id, x, y) =>
    set((state) => ({
      project: {
        ...state.project,
        components: state.project.components.map((component) =>
          component.id === id ? { ...component, x, y } : component,
        ),
      },
    })),
  updateComponentParam: (id, key, value) =>
    set((state) => ({
      project: {
        ...state.project,
        components: state.project.components.map((component) =>
          component.id === id
            ? { ...component, params: { ...component.params, [key]: value } }
            : component,
        ),
      },
    })),
  addNet: (pin1, pin2) =>
    set((state) => {
      if (samePin(pin1, pin2)) {
        return state;
      }
      if (state.project.nets.some((net) => netConnects(net, pin1, pin2))) {
        return state;
      }
      nextNetNumber += 1;
      const net: SchematicNet = { id: `net-${nextNetNumber}`, pins: [pin1, pin2] };
      return {
        project: { ...state.project, nets: [...state.project.nets, net] },
      };
    }),
  select: (id) => set({ selectedId: id, selectedNetId: null }),
  selectNet: (id) => set({ selectedNetId: id, selectedId: null }),
  removeComponent: (id) =>
    set((state) => ({
      project: {
        ...state.project,
        components: state.project.components.filter((component) => component.id !== id),
        nets: state.project.nets.filter(
          (net) =>
            net.pins[0].componentId !== id && net.pins[1].componentId !== id,
        ),
      },
      selectedId: state.selectedId === id ? null : state.selectedId,
    })),
  removeNet: (id) =>
    set((state) => ({
      project: {
        ...state.project,
        nets: state.project.nets.filter((net) => net.id !== id),
      },
      selectedNetId: state.selectedNetId === id ? null : state.selectedNetId,
    })),
  loadProject: (project, cloudProjectId) => {
    nextComponentNumber = maxIdSuffix(project.components.map((component) => component.id));
    nextNetNumber = maxIdSuffix(project.nets.map((net) => net.id));
    set({
      project,
      selectedId: null,
      selectedNetId: null,
      cloudProjectId,
      isProjectLoading: false,
    });
  },
  setCloudProjectId: (id) => set({ cloudProjectId: id }),
  setProjectLoading: (loading) => set({ isProjectLoading: loading }),
}));
