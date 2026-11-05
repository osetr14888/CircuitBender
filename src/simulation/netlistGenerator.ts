import type { PinRef, SchematicComponent, SchematicProject } from '../types/schematic';
import { pinIndexes } from '../components/schematicGeometry';

const GROUND_NODE = '0';
const OUTPUT_NODE = 'out';

export const FLOATING_NODE_ERROR = 'В схеме есть плавающий узел';

export interface NetlistAnalysis {
  netlist: string;
  error: string | null;
}

function pinKey(pin: PinRef): string {
  return `${pin.componentId}:${pin.index}`;
}

class DisjointSet {
  private readonly parent = new Map<string, string>();

  find(key: string): string {
    const parent = this.parent.get(key);
    if (parent === undefined) {
      this.parent.set(key, key);
      return key;
    }
    if (parent === key) {
      return key;
    }
    const root = this.find(parent);
    this.parent.set(key, root);
    return root;
  }

  union(a: string, b: string): void {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) {
      this.parent.set(rootB, rootA);
    }
  }
}


function formatSpiceNumber(value: number): string {
  if (!Number.isFinite(value) || value === 0) {
    return '0';
  }
  const exponent = Math.floor(Math.log10(Math.abs(value)));
  const mantissa = Number((value / 10 ** exponent).toFixed(6));
  return `${mantissa}e${exponent}`;
}


function asciiOnly(value: string): string {
  return value.replace(/[^\x20-\x7e]/g, '').replace(/[\r\n]+/g, ' ').trim();
}

function numericParam(component: SchematicComponent, key: string, fallback: number): number {
  const value = component.params[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function modelNameParam(component: SchematicComponent, fallback: string): string {
  const value = component.params.model;
  if (typeof value !== 'string') {
    return fallback;
  }
  const safe = asciiOnly(value).replace(/[^a-zA-Z0-9_]/g, '');
  return safe.length > 0 ? safe : fallback;
}

function spiceDeviceName(component: SchematicComponent): string {
  return component.id.replace(/[^a-zA-Z0-9]/g, '');
}


export function generateNetlist(project: SchematicProject): NetlistAnalysis {
  const devices = project.components.filter((component) => component.kind !== 'ground');
  if (devices.length === 0) {
    return { netlist: '', error: 'Схема пуста — добавьте компоненты.' };
  }

  const nets = new DisjointSet();
  const connectedPins = new Set<string>();
  for (const net of project.nets) {
    nets.union(pinKey(net.pins[0]), pinKey(net.pins[1]));
    connectedPins.add(pinKey(net.pins[0]));
    connectedPins.add(pinKey(net.pins[1]));
  }

  const groundedRoots = new Set<string>();
  for (const component of project.components) {
    if (component.kind !== 'ground') {
      continue;
    }
    for (const index of pinIndexes(component.kind)) {
      groundedRoots.add(nets.find(pinKey({ componentId: component.id, index })));
    }
  }
  for (const component of devices) {
    if (component.kind !== 'vsource') {
      continue;
    }
    const minusPin: PinRef = { componentId: component.id, index: 1 };
    if (!connectedPins.has(pinKey(minusPin))) {
      groundedRoots.add(nets.find(pinKey(minusPin)));
    }
  }

  const nodeByRoot = new Map<string, string>();
  const orderedRoots: string[] = [];
  let nextNodeNumber = 1;

  for (const component of devices) {
    for (const index of pinIndexes(component.kind)) {
      const root = nets.find(pinKey({ componentId: component.id, index }));
      if (nodeByRoot.has(root)) {
        continue;
      }
      if (groundedRoots.has(root)) {
        nodeByRoot.set(root, GROUND_NODE);
      } else {
        nodeByRoot.set(root, String(nextNodeNumber));
        nextNodeNumber += 1;
        orderedRoots.push(root);
      }
    }
  }

  const nodeForPin = (pin: PinRef): string =>
    nodeByRoot.get(nets.find(pinKey(pin))) ?? GROUND_NODE;

  const sourcePinRoots = new Set(
    devices
      .filter((component) => component.kind === 'vsource')
      .flatMap((component) =>
        pinIndexes(component.kind).map((index) =>
          nets.find(pinKey({ componentId: component.id, index })),
        ),
      ),
  );

  let outputRoot: string | null = null;
  for (let i = orderedRoots.length - 1; i >= 0; i -= 1) {
    if (!sourcePinRoots.has(orderedRoots[i])) {
      outputRoot = orderedRoots[i];
      break;
    }
  }
  outputRoot ??= orderedRoots[orderedRoots.length - 1] ?? null;
  if (outputRoot !== null) {
    nodeByRoot.set(outputRoot, OUTPUT_NODE);
  }

  const conductorRoots = new Set<string>();
  for (const component of devices) {
    if (component.kind === 'capacitor') {
      continue;
    }
    if (component.kind === 'nmos' || component.kind === 'pmos') {
      conductorRoots.add(nets.find(pinKey({ componentId: component.id, index: 2 })));
      continue;
    }
    for (const index of pinIndexes(component.kind)) {
      conductorRoots.add(nets.find(pinKey({ componentId: component.id, index })));
    }
  }
  const hasFloatingNode = orderedRoots.some((root) => !conductorRoots.has(root));

  const safeName = asciiOnly(project.name);
  const lines = [safeName.length > 0 ? `* CircuitBender - ${safeName}` : '* CircuitBender'];
  const modelCards = new Map<string, string>();
  const addModel = (name: string, card: string): void => {
    const key = name.toUpperCase();
    if (!modelCards.has(key)) {
      modelCards.set(key, card);
    }
  };
  for (const component of devices) {
    const node1 = nodeForPin({ componentId: component.id, index: 0 });
    const node2 = nodeForPin({ componentId: component.id, index: 1 });
    const node3 = nodeForPin({ componentId: component.id, index: 2 });
    const name = spiceDeviceName(component);
    switch (component.kind) {
      case 'resistor':
        lines.push(
          `R${name} ${node1} ${node2} ${formatSpiceNumber(numericParam(component, 'resistance', 1000))}`,
        );
        break;
      case 'capacitor':
        lines.push(
          `C${name} ${node1} ${node2} ${formatSpiceNumber(numericParam(component, 'capacitance', 1e-7))}`,
        );
        break;
      case 'inductor':
        lines.push(
          `L${name} ${node1} ${node2} ${formatSpiceNumber(numericParam(component, 'inductance', 1e-3))}`,
        );
        break;
      case 'vsource': {
        const amplitude = formatSpiceNumber(numericParam(component, 'voltage', 5));
        lines.push(`V${name} ${node1} ${node2} PULSE(0 ${amplitude} 0 1n 1n 1m 2m)`);
        break;
      }
      case 'diode': {
        const modelName = modelNameParam(component, 'DFAST');
        addModel(modelName, `.model ${modelName} D(IS=1e-14 RS=0.1)`);
        lines.push(`D${name} ${node1} ${node2} ${modelName}`);
        break;
      }
      case 'npn': {
        const modelName = `QNPN_${name}`;
        const beta = formatSpiceNumber(numericParam(component, 'beta', 100));
        addModel(modelName, `.model ${modelName} NPN(BF=${beta})`);
        lines.push(`Q${name} ${node1} ${node2} ${node3} ${modelName}`);
        break;
      }
      case 'pnp': {
        const modelName = `QPNP_${name}`;
        const beta = formatSpiceNumber(numericParam(component, 'beta', 100));
        addModel(modelName, `.model ${modelName} PNP(BF=${beta})`);
        lines.push(`Q${name} ${node1} ${node2} ${node3} ${modelName}`);
        break;
      }
      case 'nmos': {
        const modelName = `MNMOS_${name}`;
        const vto = formatSpiceNumber(numericParam(component, 'vto', 2));
        const kp = formatSpiceNumber(numericParam(component, 'kp', 0.1));
        addModel(modelName, `.model ${modelName} NMOS(VTO=${vto} KP=${kp})`);
        lines.push(`M${name} ${node1} ${node2} ${node3} ${node3} ${modelName}`);
        break;
      }
      case 'pmos': {
        const modelName = `MPMOS_${name}`;
        const vto = formatSpiceNumber(numericParam(component, 'vto', -2));
        const kp = formatSpiceNumber(numericParam(component, 'kp', 0.1));
        addModel(modelName, `.model ${modelName} PMOS(VTO=${vto} KP=${kp})`);
        lines.push(`M${name} ${node1} ${node2} ${node3} ${node3} ${modelName}`);
        break;
      }
    }
  }

  for (const card of modelCards.values()) {
    lines.push(card);
  }

  lines.push('.tran 1u 5m', '.end');
  return {
    netlist: lines.join('\n'),
    error: hasFloatingNode ? FLOATING_NODE_ERROR : null,
  };
}
