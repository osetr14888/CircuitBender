import { useState } from 'react';
import { Play, Loader2 } from 'lucide-react';
import type { SpiceClient, SpiceSimulationResult } from '../simulation/spiceClient';
import { useToastStore } from '../store/toastStore';

export type SimulationStatus = 'idle' | 'running' | 'success' | 'error';

type SimulationPanelProps = {
  client: SpiceClient;
  netlist: string;
  netlistError?: string | null;
  onResult?: (result: SpiceSimulationResult) => void;
};

export function SimulationPanel({
  client,
  netlist,
  netlistError = null,
  onResult,
}: SimulationPanelProps) {
  const [status, setStatus] = useState<SimulationStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<SpiceSimulationResult | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const pushToast = useToastStore((state) => state.pushToast);

  const failWithToast = (message: string) => {
    setErrorMessage(message);
    setStatus('error');
    pushToast('Simulation failed — check the schematic.', 'error');
  };

  const runSimulation = async () => {
    setStatus('running');
    setErrorMessage(null);
    setResult(null);
    if (netlistError !== null) {
      failWithToast(netlistError);
      return;
    }
    if (netlist.trim() === '') {
      failWithToast('Ошибка симуляции. Проверьте, все ли компоненты заземлены и подключены.');
      return;
    }
    const startedAt = performance.now();
    try {
      const simulationResult = await client.runSimulation(netlist);
      setResult(simulationResult);
      setElapsedMs(performance.now() - startedAt);
      setStatus('success');
      onResult?.(simulationResult);
    } catch (error: unknown) {
      const rawMessage = error instanceof Error ? error.message : String(error);
      failWithToast(
        `Ошибка симуляции. Проверьте, все ли компоненты заземлены и подключены.\n\n${rawMessage}`,
      );
    }
  };

  return (
    <section className="sim-panel">
      <div className="sim-toolbar">
        <button
          type="button"
          className="sim-run-button"
          onClick={runSimulation}
          disabled={status === 'running'}
        >
          {status === 'running' ? (
            <Loader2 className="spin" size={15} aria-hidden="true" />
          ) : (
            <Play size={15} aria-hidden="true" />
          )}
          {status === 'running' ? 'Simulating…' : 'Run Simulation'}
        </button>
        <span className="sim-status" data-status={status}>
          {status === 'idle' && 'Ready'}
          {status === 'running' && 'ngspice is running in a Web Worker…'}
          {status === 'success' &&
            result !== null &&
            `${result.numPoints} points · ${elapsedMs?.toFixed(0)} ms`}
          {status === 'error' && 'Simulation failed'}
        </span>
      </div>
      {errorMessage !== null && <p className="sim-error">{errorMessage}</p>}
    </section>
  );
}
