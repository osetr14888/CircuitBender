import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAppStore } from '../store/appStore';
import { KIND_LABELS } from './componentCatalog';
import { generateNetlist } from '../simulation/netlistGenerator';
import type { ComponentKind } from '../types/schematic';

interface ParamUnit {
  label: string;
  scale: number;
}

interface NumericParamField {
  key: string;
  label: string;
  type: 'number';
  units: ParamUnit[];
}

interface TextParamField {
  key: string;
  label: string;
  type: 'text';
  placeholder?: string;
}

type ParamField = NumericParamField | TextParamField;

const VOLT: ParamUnit = { label: 'V', scale: 1 };
const AMPERE_PER_VOLT_SQUARED: ParamUnit = { label: 'A/V²', scale: 1 };
const UNITLESS: ParamUnit[] = [{ label: '', scale: 1 }];

const PARAM_FIELDS: Record<ComponentKind, ParamField[]> = {
  resistor: [
    {
      key: 'resistance',
      label: 'Resistance',
      type: 'number',
      units: [
        { label: 'Ω', scale: 1 },
        { label: 'kΩ', scale: 1e3 },
      ],
    },
  ],
  capacitor: [
    {
      key: 'capacitance',
      label: 'Capacitance',
      type: 'number',
      units: [
        { label: 'F', scale: 1 },
        { label: 'µF', scale: 1e-6 },
      ],
    },
  ],
  inductor: [
    {
      key: 'inductance',
      label: 'Inductance',
      type: 'number',
      units: [
        { label: 'H', scale: 1 },
        { label: 'mH', scale: 1e-3 },
      ],
    },
  ],
  vsource: [{ key: 'voltage', label: 'Voltage', type: 'number', units: [VOLT] }],
  ground: [],
  diode: [{ key: 'model', label: 'Model', type: 'text', placeholder: 'DFAST' }],
  npn: [{ key: 'beta', label: 'Beta (hFE)', type: 'number', units: UNITLESS }],
  pnp: [{ key: 'beta', label: 'Beta (hFE)', type: 'number', units: UNITLESS }],
  nmos: [
    { key: 'vto', label: 'Threshold voltage (VTO)', type: 'number', units: [VOLT] },
    {
      key: 'kp',
      label: 'Transconductance (KP)',
      type: 'number',
      units: [AMPERE_PER_VOLT_SQUARED],
    },
  ],
  pmos: [
    { key: 'vto', label: 'Threshold voltage (VTO)', type: 'number', units: [VOLT] },
    {
      key: 'kp',
      label: 'Transconductance (KP)',
      type: 'number',
      units: [AMPERE_PER_VOLT_SQUARED],
    },
  ],
};

const UNIT_SELECT_STYLE = {
  padding: '4px 6px',
  border: '1px solid #3a3a3a',
  borderRadius: 4,
  background: '#262626',
  color: '#e0e0e0',
  fontFamily: 'inherit',
  fontSize: 12,
};

function pickUnitIndex(field: NumericParamField, value: number): number {
  const magnitude = Math.abs(value);
  const index = field.units.findIndex((unit) => {
    const scaled = magnitude / unit.scale;
    return scaled >= 1 && scaled < 1000;
  });
  return index === -1 ? 0 : index;
}

function formatScaledValue(value: number, scale: number): string {
  const scaled = value / scale;
  if (!Number.isFinite(scaled)) {
    return '0';
  }
  return String(Number(scaled.toPrecision(6)));
}

function ParamFieldControl({
  field,
  value,
  onChange,
}: {
  field: NumericParamField;
  value: number;
  onChange: (value: number) => void;
}) {
  const [unitIndex, setUnitIndex] = useState(() => pickUnitIndex(field, value));
  const unit = field.units[unitIndex] ?? field.units[0];

  return (
    <label className="props-param">
      <span className="props-param-label">{field.label}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          key={unitIndex}
          type="number"
          step="any"
          className="props-param-input"
          defaultValue={formatScaledValue(value, unit.scale)}
          onChange={(event) => {
            const next = event.currentTarget.valueAsNumber;
            if (!Number.isNaN(next)) {
              onChange(next * unit.scale);
            }
          }}
        />
        {field.units.length > 1 ? (
          <select
            value={unitIndex}
            style={UNIT_SELECT_STYLE}
            onChange={(event) => setUnitIndex(Number(event.currentTarget.value))}
          >
            {field.units.map((option, index) => (
              <option key={option.label} value={index}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
          unit.label.length > 0 && <span className="props-param-label">{unit.label}</span>
        )}
      </span>
    </label>
  );
}

function TextParamControl({
  field,
  value,
  onChange,
}: {
  field: TextParamField;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="props-param">
      <span className="props-param-label">{field.label}</span>
      <input
        type="text"
        className="props-param-input"
        value={value}
        placeholder={field.placeholder}
        spellCheck={false}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  );
}

function NetlistDebug() {
  const project = useAppStore((state) => state.project);
  const analysis = useMemo(() => generateNetlist(project), [project]);

  return (
    <details className="netlist-debug" open>
      <summary>SPICE Netlist</summary>
      {analysis.error !== null && <p className="netlist-error">{analysis.error}</p>}
      <pre>{analysis.netlist}</pre>
    </details>
  );
}

export function PropertiesPanel() {
  const selectedId = useAppStore((state) => state.selectedId);
  const selected = useAppStore((state) =>
    state.project.components.find((component) => component.id === selectedId),
  );
  const selectedNet = useAppStore((state) =>
    state.project.nets.find((net) => net.id === state.selectedNetId),
  );
  const updateComponentParam = useAppStore((state) => state.updateComponentParam);
  const removeComponent = useAppStore((state) => state.removeComponent);
  const removeNet = useAppStore((state) => state.removeNet);

  if (selected === undefined) {
    if (selectedNet !== undefined) {
      return (
        <aside className="panel panel-right">
          <div className="props-header">
            <h2>Properties</h2>
            <button
              type="button"
              className="props-delete-button"
              title="Delete wire (Delete)"
              aria-label="Delete selected wire"
              onClick={() => removeNet(selectedNet.id)}
            >
              <Trash2 size={15} aria-hidden="true" />
              Delete
            </button>
          </div>
          <dl className="props">
            <dt>kind</dt>
            <dd>Wire</dd>
            <dt>id</dt>
            <dd>{selectedNet.id}</dd>
            <dt>from</dt>
            <dd>
              {selectedNet.pins[0].componentId} pin {selectedNet.pins[0].index}
            </dd>
            <dt>to</dt>
            <dd>
              {selectedNet.pins[1].componentId} pin {selectedNet.pins[1].index}
            </dd>
          </dl>
          <p className="props-empty">Press Delete to remove wire</p>
          <NetlistDebug />
        </aside>
      );
    }

    return (
      <aside className="panel panel-right">
        <h2>Properties</h2>
        <p className="props-empty">Nothing selected</p>
        <NetlistDebug />
      </aside>
    );
  }

  const fields = PARAM_FIELDS[selected.kind];

  return (
    <aside className="panel panel-right">
      <div className="props-header">
        <h2>Properties</h2>
        <button
          type="button"
          className="props-delete-button"
          title="Delete component (Delete)"
          aria-label="Delete selected component"
          onClick={() => removeComponent(selected.id)}
        >
          <Trash2 size={15} aria-hidden="true" />
          Delete
        </button>
      </div>
      <dl className="props">
        <dt>kind</dt>
        <dd>{KIND_LABELS[selected.kind]}</dd>
        <dt>id</dt>
        <dd>{selected.id}</dd>
        <dt>x</dt>
        <dd>{selected.x}</dd>
        <dt>y</dt>
        <dd>{selected.y}</dd>
        <dt>rotation</dt>
        <dd>{selected.rotation}°</dd>
      </dl>
      <h3 className="props-params-heading">Parameters</h3>
      {fields.length === 0 ? (
        <p className="props-empty">No parameters</p>
      ) : (
        <div className="props-params" key={selected.id}>
          {fields.map((field) => {
            const value = selected.params[field.key];
            if (field.type === 'text') {
              return (
                <TextParamControl
                  key={field.key}
                  field={field}
                  value={typeof value === 'string' ? value : ''}
                  onChange={(next) => updateComponentParam(selected.id, field.key, next)}
                />
              );
            }
            return (
              <ParamFieldControl
                key={field.key}
                field={field}
                value={typeof value === 'number' ? value : 0}
                onChange={(next) => updateComponentParam(selected.id, field.key, next)}
              />
            );
          })}
        </div>
      )}
      <NetlistDebug />
    </aside>
  );
}
