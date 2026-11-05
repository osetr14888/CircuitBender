import { Circle, Group, Path, Rect, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type {
  ComponentKind,
  PinIndex,
  SchematicComponent as ComponentData,
} from '../types/schematic';
import {
  PIN_RADIUS,
  componentHalfSize,
  pinIndexes,
  pinOffset,
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
    case 'inductor':
      return formatSiValue(params.inductance ?? 0, 'H');
    case 'vsource':
      return `${params.voltage ?? 0} V`;
    case 'ground':
      return 'GND';
    case 'diode':
      return 'Diode';
    case 'npn':
      return 'NPN';
    case 'pnp':
      return 'PNP';
    case 'nmos':
      return 'NMOS';
    case 'pmos':
      return 'PMOS';
  }
}

function SymbolPrimitives({ kind }: { kind: ComponentKind }) {
  switch (kind) {
    case 'resistor':
      return (
        <>
          <Path data="M -30,0 L -20,0" stroke={SYMBOL_STROKE} strokeWidth={2} />
          <Path
            data="M -20,0 L -15,-10 L -5,10 L 5,-10 L 15,10 L 20,0"
            stroke={SYMBOL_STROKE}
            strokeWidth={2}
            lineJoin="round"
          />
          <Path data="M 20,0 L 30,0" stroke={SYMBOL_STROKE} strokeWidth={2} />
        </>
      );
    case 'capacitor':
      return (
        <>
          <Path data="M -20,0 L -8,0" stroke={SYMBOL_STROKE} strokeWidth={2} />
          <Path
            data="M -8,-12 L -8,12 M 8,-12 L 8,12"
            stroke={SYMBOL_STROKE}
            strokeWidth={2}
          />
          <Path data="M 8,0 L 20,0" stroke={SYMBOL_STROKE} strokeWidth={2} />
        </>
      );
    case 'inductor':
      return (
        <>
          <Path data="M -30,0 L -24,0" stroke={SYMBOL_STROKE} strokeWidth={2} />
          <Path
            data="M -24,0 A 6,6 0 0 1 -12,0 A 6,6 0 0 1 0,0 A 6,6 0 0 1 12,0 A 6,6 0 0 1 24,0"
            stroke={SYMBOL_STROKE}
            strokeWidth={2}
            lineJoin="round"
          />
          <Path data="M 24,0 L 30,0" stroke={SYMBOL_STROKE} strokeWidth={2} />
        </>
      );
    case 'vsource':
      return (
        <>
          <Path data="M -40,0 L -15,0" stroke={SYMBOL_STROKE} strokeWidth={2} />
          <Circle
            x={0}
            y={0}
            radius={15}
            fill={SYMBOL_FILL}
            stroke={SYMBOL_STROKE}
            strokeWidth={2}
          />
          <Path data="M 15,0 L 40,0" stroke={SYMBOL_STROKE} strokeWidth={2} />
          <Path
            data="M -4,-7 L 4,-7 M 0,-11 L 0,-3 M -4,7 L 4,7"
            stroke={SYMBOL_STROKE}
            strokeWidth={2}
          />
        </>
      );
    case 'ground':
      return (
        <>
          <Path data="M -40,0 L 40,0" stroke={SYMBOL_STROKE} strokeWidth={2} />
          <Path
            data="M 0,0 L 0,6 M -14,6 L 14,6 M -9,11 L 9,11 M -4,16 L 4,16"
            stroke={SYMBOL_STROKE}
            strokeWidth={2}
          />
        </>
      );
    case 'diode':
      return (
        <>
          <Path data="M -20,0 L -8,0" stroke={SYMBOL_STROKE} strokeWidth={2} />
          <Path
            data="M -8,-8 L 8,0 L -8,8 Z"
            fill={SYMBOL_FILL}
            stroke={SYMBOL_STROKE}
            strokeWidth={2}
            lineJoin="round"
          />
          <Path
            data="M 8,-8 L 8,8"
            stroke={SYMBOL_STROKE}
            strokeWidth={2}
            lineCap="square"
          />
          <Path data="M 8,0 L 20,0" stroke={SYMBOL_STROKE} strokeWidth={2} />
        </>
      );
    case 'npn':
    case 'pnp':
      return (
        <>
          <Circle
            x={0}
            y={0}
            radius={20}
            fill={SYMBOL_FILL}
            stroke={SYMBOL_STROKE}
            strokeWidth={2}
          />
          <Path data="M -40,0 L -5,0" stroke={SYMBOL_STROKE} strokeWidth={2} />
          <Path data="M -5,-10 L -5,10" stroke={SYMBOL_STROKE} strokeWidth={2} />
          <Path
            data="M -5,-5 L 15,-15 L 15,-30"
            stroke={SYMBOL_STROKE}
            strokeWidth={2}
            lineJoin="round"
          />
          <Path
            data="M -5,5 L 15,15 L 15,30"
            stroke={SYMBOL_STROKE}
            strokeWidth={2}
            lineJoin="round"
          />
          <Path
            data={
              kind === 'npn'
                ? 'M 5,5 L 9,12 L 1,13'
                : 'M 11,8 L 3,9 L 7,16'
            }
            stroke={SYMBOL_STROKE}
            strokeWidth={2}
            lineCap="round"
            lineJoin="round"
          />
        </>
      );
    case 'nmos':
    case 'pmos':
      return (
        <>
          <Circle
            x={0}
            y={0}
            radius={20}
            fill={SYMBOL_FILL}
            stroke={SYMBOL_STROKE}
            strokeWidth={2}
          />
          <Path data="M -40,0 L -8,0" stroke={SYMBOL_STROKE} strokeWidth={2} />
          <Path data="M -8,-14 L -8,14" stroke={SYMBOL_STROKE} strokeWidth={2} />
          <Path
            data="M 0,-14 L 0,-6 M 0,-4 L 0,4 M 0,6 L 0,14"
            stroke={SYMBOL_STROKE}
            strokeWidth={2}
          />
          <Path data="M 0,-14 L 0,-40" stroke={SYMBOL_STROKE} strokeWidth={2} />
          <Path data="M 0,14 L 0,40" stroke={SYMBOL_STROKE} strokeWidth={2} />
          <Path data="M 0,0 L 10,0" stroke={SYMBOL_STROKE} strokeWidth={2} />
          <Path
            data={
              kind === 'nmos'
                ? 'M 10,-5 L 4,0 L 10,5'
                : 'M 4,-5 L 10,0 L 4,5'
            }
            stroke={SYMBOL_STROKE}
            strokeWidth={2}
            lineCap="round"
            lineJoin="round"
          />
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
  const { halfWidth, halfHeight } = componentHalfSize(component.kind);
  const pins = pinIndexes(component.kind);

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
          x={-halfWidth - SELECTION_PADDING}
          y={-halfHeight - SELECTION_PADDING}
          width={(halfWidth + SELECTION_PADDING) * 2}
          height={(halfHeight + SELECTION_PADDING) * 2}
          stroke={SELECTION_STROKE}
          strokeWidth={1.5}
          dash={[6, 4]}
        />
      )}
      <Rect
        x={-halfWidth - SELECTION_PADDING}
        y={-halfHeight - SELECTION_PADDING}
        width={(halfWidth + SELECTION_PADDING) * 2}
        height={(halfHeight + SELECTION_PADDING) * 2}
        fill="transparent"
      />
      <SymbolPrimitives kind={component.kind} />
      <Text
        x={-halfWidth}
        y={halfHeight + 6}
        width={halfWidth * 2}
        text={formatValue(component.kind, component.params)}
        fontSize={12}
        fontFamily="monospace"
        fill="#b0bec5"
        align="center"
      />
      {pins.map((index) => {
        const offset = pinOffset(component.kind, index);
        return (
          <Circle
            key={index}
            x={offset.x}
            y={offset.y}
            radius={PIN_RADIUS}
            fill={activePinIndex === index ? ACTIVE_PIN_FILL : PIN_FILL}
            stroke={PIN_STROKE}
            strokeWidth={1.5}
            hitStrokeWidth={8}
            onMouseDown={handlePinDown}
            onClick={handlePinClick(index)}
            onTap={handlePinClick(index)}
          />
        );
      })}
    </Group>
  );
}
