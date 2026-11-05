import { Circle, Group, Line, Rect, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type {
  ComponentKind,
  PinIndex,
  SchematicComponent as ComponentData,
} from '../types/schematic';
import {
  COMPONENT_HEIGHT,
  COMPONENT_WIDTH,
  PIN_RADIUS,
  snapToGrid,
} from './schematicGeometry';

const SYMBOL_STROKE = '#90caf9';
const SYMBOL_FILL = '#263238';
const PIN_FILL = '#546e7a';
const PIN_STROKE = '#cfd8dc';
const ACTIVE_PIN_FILL = '#ffd740';
const SELECTION_STROKE = '#ffd740';
const SELECTION_PADDING = 8;

function formatSiValue(value: number, unit: string): string {
  if (value === 0) {
    return `0 ${unit}`;
  }
  const magnitude = Math.abs(value);
  if (magnitude >= 1e6) {
    return `${value / 1e6} M${unit}`;
  }
  if (magnitude >= 1e3) {
    return `${value / 1e3} k${unit}`;
  }
  if (magnitude < 1e-3) {
    return `${value * 1e6} µ${unit}`;
  }
  return `${value} ${unit}`;
}

function formatValue(kind: ComponentKind, params: Record<string, number>): string {
  switch (kind) {
    case 'resistor':
      return formatSiValue(params.resistance ?? 0, 'Ω');
    case 'capacitor':
      return formatSiValue(params.capacitance ?? 0, 'F');
    case 'vsource':
      return `${params.voltage ?? 0} V`;
    case 'ground':
      return 'GND';
  }
}

function SymbolPrimitives({ kind }: { kind: ComponentKind }) {
  const halfW = COMPONENT_WIDTH / 2;
  switch (kind) {
    case 'resistor':
      return (
        <>
          <Line
            points={[-halfW, 0, -halfW + 8, 0]}
            stroke={SYMBOL_STROKE}
            strokeWidth={2}
          />
          <Rect
            x={-halfW + 8}
            y={-7}
            width={COMPONENT_WIDTH - 16}
            height={14}
            fill={SYMBOL_FILL}
            stroke={SYMBOL_STROKE}
            strokeWidth={2}
          />
          <Line points={[halfW - 8, 0, halfW, 0]} stroke={SYMBOL_STROKE} strokeWidth={2} />
        </>
      );
    case 'capacitor':
      return (
        <>
          <Line points={[-halfW, 0, -8, 0]} stroke={SYMBOL_STROKE} strokeWidth={2} />
          <Line points={[-8, -14, -8, 14]} stroke={SYMBOL_STROKE} strokeWidth={2} />
          <Line points={[8, -14, 8, 14]} stroke={SYMBOL_STROKE} strokeWidth={2} />
          <Line points={[8, 0, halfW, 0]} stroke={SYMBOL_STROKE} strokeWidth={2} />
        </>
      );
    case 'vsource':
      return (
        <>
          <Line points={[-halfW, 0, -14, 0]} stroke={SYMBOL_STROKE} strokeWidth={2} />
          <Circle
            x={0}
            y={0}
            radius={14}
            fill={SYMBOL_FILL}
            stroke={SYMBOL_STROKE}
            strokeWidth={2}
          />
          <Line points={[14, 0, halfW, 0]} stroke={SYMBOL_STROKE} strokeWidth={2} />
          <Line points={[-4, -7, 4, -7]} stroke={SYMBOL_STROKE} strokeWidth={2} />
          <Line points={[0, -11, 0, -3]} stroke={SYMBOL_STROKE} strokeWidth={2} />
          <Line points={[-4, 7, 4, 7]} stroke={SYMBOL_STROKE} strokeWidth={2} />
        </>
      );
    case 'ground':
      return (
        <>
          <Line points={[-halfW, 0, 0, 0]} stroke={SYMBOL_STROKE} strokeWidth={2} />
          <Line points={[halfW, 0, 0, 0]} stroke={SYMBOL_STROKE} strokeWidth={2} />
          <Line points={[0, 0, 0, 6]} stroke={SYMBOL_STROKE} strokeWidth={2} />
          <Line points={[-12, 6, 12, 6]} stroke={SYMBOL_STROKE} strokeWidth={2} />
          <Line points={[-7, 11, 7, 11]} stroke={SYMBOL_STROKE} strokeWidth={2} />
          <Line points={[-3, 16, 3, 16]} stroke={SYMBOL_STROKE} strokeWidth={2} />
        </>
      );
  }
}

interface SchematicComponentViewProps {
  component: ComponentData;
  selected: boolean;
  activePinIndex: PinIndex | null;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  onPinClick: (index: PinIndex) => void;
}

export function SchematicComponentView({
  component,
  selected,
  activePinIndex,
  onSelect,
  onDragEnd,
  onPinClick,
}: SchematicComponentViewProps) {
  const halfW = COMPONENT_WIDTH / 2;
  const halfH = COMPONENT_HEIGHT / 2;

  const handleSelect = (event: KonvaEventObject<MouseEvent>) => {
    event.cancelBubble = true;
    onSelect();
  };

  const handlePinDown = (event: KonvaEventObject<MouseEvent>) => {
    event.cancelBubble = true;
  };

  const handlePinClick = (index: PinIndex) => (event: KonvaEventObject<MouseEvent>) => {
    event.cancelBubble = true;
    onPinClick(index);
  };

  return (
    <Group
      x={component.x}
      y={component.y}
      rotation={component.rotation}
      draggable
      onClick={handleSelect}
      onTap={handleSelect}
      onDragEnd={(event) => {
        onDragEnd(snapToGrid(event.target.x()), snapToGrid(event.target.y()));
      }}
    >
      {selected && (
        <Rect
          x={-halfW - SELECTION_PADDING}
          y={-halfH - SELECTION_PADDING}
          width={COMPONENT_WIDTH + SELECTION_PADDING * 2}
          height={COMPONENT_HEIGHT + SELECTION_PADDING * 2}
          stroke={SELECTION_STROKE}
          strokeWidth={1.5}
          dash={[6, 4]}
        />
      )}
      {/* Invisible hit area spanning the full symbol bounds so that gaps
          between primitives (e.g. inside the capacitor) stay clickable. */}
      <Rect
        x={-halfW - SELECTION_PADDING}
        y={-halfH - SELECTION_PADDING}
        width={COMPONENT_WIDTH + SELECTION_PADDING * 2}
        height={COMPONENT_HEIGHT + SELECTION_PADDING * 2}
        fill="transparent"
      />
      <SymbolPrimitives kind={component.kind} />
      <Text
        x={-halfW}
        y={halfH + 6}
        width={COMPONENT_WIDTH}
        text={formatValue(component.kind, component.params)}
        fontSize={12}
        fontFamily="monospace"
        fill="#b0bec5"
        align="center"
      />
      {([0, 1] as const).map((index) => (
        <Circle
          key={index}
          x={index === 0 ? -halfW : halfW}
          y={0}
          radius={PIN_RADIUS}
          fill={activePinIndex === index ? ACTIVE_PIN_FILL : PIN_FILL}
          stroke={PIN_STROKE}
          strokeWidth={1.5}
          hitStrokeWidth={8}
          onMouseDown={handlePinDown}
          onClick={handlePinClick(index)}
          onTap={handlePinClick(index)}
        />
      ))}
    </Group>
  );
}
