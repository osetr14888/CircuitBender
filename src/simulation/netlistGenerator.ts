import type { PinRef, SchematicComponent, SchematicProject } from '../types/schematic';

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
    groundedRoots.add(nets.find(pinKey({ componentId: component.id, index: 0 })));
    groundedRoots.add(nets.find(pinKey({ componentId: component.id, index: 1 })));
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
    for (const index of [0, 1] as const) {
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
        ([0, 1] as const).map((index) =>
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
    if (component.kind !== 'resistor' && component.kind !== 'vsource') {
      continue;
    }
    for (const index of [0, 1] as const) {
      conductorRoots.add(nets.find(pinKey({ componentId: component.id, index })));
    }
  }
  const hasFloatingNode = orderedRoots.some((root) => !conductorRoots.has(root));

  const safeName = asciiOnly(project.name);
  const lines = [safeName.length > 0 ? `* CircuitBender - ${safeName}` : '* CircuitBender'];
  for (const component of devices) {
    const node1 = nodeForPin({ componentId: component.id, index: 0 });
    const node2 = nodeForPin({ componentId: component.id, index: 1 });
    const name = spiceDeviceName(component);
    switch (component.kind) {
      case 'resistor':
        lines.push(
          `R${name} ${node1} ${node2} ${formatSpiceNumber(component.params.resistance ?? 1000)}`,
        );
        break;
      case 'capacitor':
        lines.push(
          `C${name} ${node1} ${node2} ${formatSpiceNumber(component.params.capacitance ?? 1e-7)}`,
        );
        break;
      case 'vsource': {
        const amplitude = formatSpiceNumber(component.params.voltage ?? 5);
        lines.push(`V${name} ${node1} ${node2} PULSE(0 ${amplitude} 0 1n 1n 1m 2m)`);
        break;
      }
    }
  }

  lines.push('.tran 1u 5m', '.end');
  return {
    netlist: lines.join('\n'),
    error: hasFloatingNode ? FLOATING_NODE_ERROR : null,
  };
}
