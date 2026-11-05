import {
  Activity,
  ArrowDownToLine,
  Battery,
  Circle,
  CircleDot,
  GitCommitHorizontal,
  GripVertical,
  Pause,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ComponentKind } from '../types/schematic';
import { COMPONENT_DRAG_TYPE, COMPONENT_KINDS, KIND_LABELS } from './componentCatalog';

const KIND_ICONS: Record<ComponentKind, LucideIcon> = {
  resistor: Activity,
  capacitor: Pause,
  vsource: Battery,
  ground: ArrowDownToLine,
  diode: Zap,
  npn: CircleDot,
  pnp: Circle,
  nmos: GitCommitHorizontal,
  pmos: GitCommitHorizontal,
};

export function Sidebar() {
  return (
    <aside className="panel panel-left">
      <h2>Components</h2>
      <p className="palette-hint">Drag onto the canvas</p>
      <ul className="palette">
        {COMPONENT_KINDS.map((kind) => {
          const Icon = KIND_ICONS[kind];
          return (
            <li
              key={kind}
              className="palette-item"
              data-kind={kind}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(COMPONENT_DRAG_TYPE, kind);
                event.dataTransfer.setData('text/plain', kind);
                event.dataTransfer.effectAllowed = 'copy';
              }}
            >
              <span className="palette-icon" aria-hidden="true">
                <Icon size={18} />
              </span>
              <span className="palette-label">{KIND_LABELS[kind]}</span>
              <GripVertical className="palette-grip" size={14} aria-hidden="true" />
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
