import { useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { KIND_LABELS } from './componentCatalog';
import { generateNetlist } from '../simulation/netlistGenerator';

const PARAM_LABELS: Record<string, string> = {
  resistance: 'Resistance (Ω)',
  capacitance: 'Capacitance (F)',
  voltage: 'Voltage (V)',
};

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
  const updateComponentParam = useAppStore((state) => state.updateComponentParam);

  if (selected === undefined) {
    return (
      <aside className="panel panel-right">
        <h2>Properties</h2>
        <p className="props-empty">Nothing selected</p>
        <NetlistDebug />
      </aside>
    );
  }

  return (
    <aside className="panel panel-right">
      <h2>Properties</h2>
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
      {Object.keys(selected.params).length === 0 ? (
        <p className="props-empty">No parameters</p>
      ) : (
        <div className="props-params">
          {Object.entries(selected.params).map(([name, value]) => (
            <label key={name} className="props-param">
              <span className="props-param-label">{PARAM_LABELS[name] ?? name}</span>
              <input
                key={`${selected.id}-${name}`}
                type="number"
                step="any"
                className="props-param-input"
                defaultValue={value}
                onChange={(event) => {
                  const next = event.currentTarget.valueAsNumber;
                  if (!Number.isNaN(next)) {
                    updateComponentParam(selected.id, name, next);
                  }
                }}
              />
            </label>
          ))}
        </div>
      )}
      <NetlistDebug />
    </aside>
  );
}
