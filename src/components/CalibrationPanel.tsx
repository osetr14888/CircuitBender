import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, MutableRefObject } from 'react';
import uPlot from 'uplot';
import { useAppStore } from '../store/appStore';
import { KIND_LABELS } from './componentCatalog';
import { AudioEngine } from '../audio/audioEngine';
import { DEFAULT_AUDIO_SAMPLE_RATE, resampleToAudio } from '../audio/resample';
import type { SpiceClient, SpiceSimulationResult } from '../simulation/spiceClient';
import {
  buildLinearTimeAxis,
  buildOverlayTimeGrid,
  interpolateOntoGrid,
  loadAndNormalizeAudio,
  normalizeForOverlay,
} from '../audio/calibrationUtils';

const PLOT_POINTS = 2000;
const AUTO_RUN_DEBOUNCE_MS = 300;

const REFERENCE_COLOR = '#ff5252';
const SIMULATION_COLOR = '#4fc3f7';
const GRID_COLOR = '#1e5c1e';

const WINDOW_OPTIONS_MS = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000];
const DEFAULT_WINDOW_MS = 10;

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error';
type PlayTarget = 'reference' | 'simulation';

type ParamSliderConfig = {
  label: string;
  min: number;
  max: number;
  logarithmic: boolean;
  format: (value: number) => string;
};

function trimNumber(value: number): string {
  const text = String(Math.round(value * 100) / 100);
  if (!text.includes('.')) {
    return text;
  }
  const trimmed = text.replace(/0+$/, '').replace(/\.$/, '');
  return trimmed === '' ? '0' : trimmed;
}

function formatSi(value: number, unit: string): string {
  const steps: [string, number][] = [
    ['M', 1e6],
    ['k', 1e3],
    ['', 1],
    ['m', 1e-3],
    ['µ', 1e-6],
    ['n', 1e-9],
    ['p', 1e-12],
  ];
  for (const [prefix, scale] of steps) {
    if (Math.abs(value) >= scale) {
      return `${trimNumber(value / scale)} ${prefix}${unit}`;
    }
  }
  return `${value.toExponential(2)} ${unit}`;
}

const PARAM_SLIDERS: Record<string, ParamSliderConfig> = {
  resistance: {
    label: 'Resistance',
    min: 1,
    max: 1_000_000,
    logarithmic: true,
    format: (value) => formatSi(value, 'Ω'),
  },
  capacitance: {
    label: 'Capacitance',
    min: 1e-9,
    max: 1e-4,
    logarithmic: true,
    format: (value) => formatSi(value, 'F'),
  },
  voltage: {
    label: 'Voltage',
    min: 0.1,
    max: 12,
    logarithmic: false,
    format: (value) => `${trimNumber(value)} V`,
  },
};

type CalibrationPanelProps = {
  client: SpiceClient | null;
  netlist: string;
  netlistError: string | null;
  result: SpiceSimulationResult | null;
  audioEngineRef: MutableRefObject<AudioEngine | null>;
  onResult: (result: SpiceSimulationResult) => void;
};

export function CalibrationPanel({
  client,
  netlist,
  netlistError,
  result,
  audioEngineRef,
  onResult,
}: CalibrationPanelProps) {
  const components = useAppStore((state) => state.project.components);
  const updateComponentParam = useAppStore((state) => state.updateComponentParam);

  const [reference, setReference] = useState<Float32Array | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<LoadStatus>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [simRunning, setSimRunning] = useState(false);
  const [simError, setSimError] = useState<string | null>(null);
  const [playTarget, setPlayTarget] = useState<PlayTarget | null>(null);
  const [playError, setPlayError] = useState<string | null>(null);
  const [windowMs, setWindowMs] = useState(DEFAULT_WINDOW_MS);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const plotContainerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const runIdRef = useRef(0);

  useEffect(() => {
    if (client === null || netlist.trim() === '' || netlistError !== null) {
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      runIdRef.current += 1;
      const runId = runIdRef.current;
      setSimRunning(true);
      setSimError(null);
      client
        .runSimulation(netlist)
        .then((simulationResult) => {
          if (!cancelled && runId === runIdRef.current) {
            onResult(simulationResult);
            setSimRunning(false);
          }
        })
        .catch((error: unknown) => {
          if (!cancelled && runId === runIdRef.current) {
            setSimError(error instanceof Error ? error.message : String(error));
            setSimRunning(false);
          }
        });
    }, AUTO_RUN_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [client, netlist, netlistError, onResult]);

  useEffect(() => {
    const container = plotContainerRef.current;
    if (container === null) {
      return;
    }
    if (reference === null && result === null) {
      if (plotRef.current !== null) {
        plotRef.current.destroy();
        plotRef.current = null;
      }
      return;
    }

    const timeMs = buildOverlayTimeGrid(windowMs / 1000, PLOT_POINTS);
    const referenceSeries =
      reference !== null && reference.length > 1
        ? interpolateOntoGrid(
            buildLinearTimeAxis(DEFAULT_AUDIO_SAMPLE_RATE, reference.length),
            reference,
            timeMs,
          )
        : null;
    const simulationSeries =
      result !== null && result.time.length > 1
        ? interpolateOntoGrid(result.time, normalizeForOverlay(result.voltage), timeMs)
        : null;

    const series: uPlot.Series[] = [{ label: 'Time' }];
    if (referenceSeries !== null) {
      series.push({ label: 'Reference', stroke: REFERENCE_COLOR, width: 2 });
    }
    if (simulationSeries !== null) {
      series.push({ label: 'Simulation', stroke: SIMULATION_COLOR, width: 2 });
    }

    let data: uPlot.AlignedData;
    if (referenceSeries !== null && simulationSeries !== null) {
      data = [timeMs, referenceSeries, simulationSeries];
    } else if (referenceSeries !== null) {
      data = [timeMs, referenceSeries];
    } else if (simulationSeries !== null) {
      data = [timeMs, simulationSeries];
    } else {
      data = [timeMs];
    }

    const rect = container.getBoundingClientRect();
    const width = Math.max(10, Math.round(rect.width));
    const height = Math.max(10, Math.round(rect.height));

    const plot = new uPlot(
      {
        width,
        height,
        legend: { show: true },
        scales: {
          x: { time: false, range: [0, windowMs] },
          y: { range: [-1.05, 1.05] },
        },
        axes: [
          {
            scale: 'x',
            grid: { stroke: GRID_COLOR, width: 1 },
            values: (_u: uPlot, values: number[]) =>
              values.map((value) => `${Math.round(value * 100) / 100} ms`),
          },
          {
            scale: 'y',
            grid: { stroke: GRID_COLOR, width: 1 },
            values: (_u: uPlot, values: number[]) => values.map((value) => value.toFixed(1)),
          },
        ],
        series,
      },
      data,
      container,
    );

    plotRef.current = plot;

    const resizeObserver = new ResizeObserver(() => {
      const bounds = container.getBoundingClientRect();
      plot.setSize({
        width: Math.max(10, Math.round(bounds.width)),
        height: Math.max(10, Math.round(bounds.height)),
      });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      plot.destroy();
      plotRef.current = null;
    };
  }, [reference, result, windowMs]);

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = '';
    if (file === null) {
      return;
    }
    setLoadStatus('loading');
    setLoadError(null);
    try {
      const samples = await loadAndNormalizeAudio(file);
      setReference(samples);
      setFileName(file.name);
      setLoadStatus('ready');
    } catch (error: unknown) {
      setReference(null);
      setFileName(null);
      setLoadError(error instanceof Error ? error.message : String(error));
      setLoadStatus('error');
    }
  };

  const ensureAudioEngine = async (): Promise<AudioEngine> => {
    if (audioEngineRef.current === null) {
      audioEngineRef.current = new AudioEngine();
    }
    const engine = audioEngineRef.current;
    await engine.init();
    return engine;
  };

  const playSamples = async (target: PlayTarget): Promise<void> => {
    setPlayTarget(target);
    setPlayError(null);
    try {
      const engine = await ensureAudioEngine();
      let samples: Float32Array;
      if (target === 'reference') {
        samples = reference ?? new Float32Array(0);
      } else {
        samples =
          result !== null
            ? resampleToAudio(result.time, result.voltage, engine.sampleRate)
            : new Float32Array(0);
      }
      if (samples.length > 0) {
        engine.play(samples);
      } else {
        setPlayTarget(null);
      }
    } catch (error: unknown) {
      setPlayTarget(null);
      setPlayError(error instanceof Error ? error.message : String(error));
    }
  };

  const handlePlayReference = (): void => {
    if (reference !== null) {
      void playSamples('reference');
    }
  };

  const handlePlaySimulation = (): void => {
    if (result !== null) {
      void playSamples('simulation');
    }
  };

  const handleStop = (): void => {
    audioEngineRef.current?.stop();
    setPlayTarget(null);
  };

  const sliderPosition = (config: ParamSliderConfig, value: number): number => {
    const clamped = Math.min(config.max, Math.max(config.min, value));
    const position = config.logarithmic
      ? Math.log10(clamped / config.min) / Math.log10(config.max / config.min)
      : (clamped - config.min) / (config.max - config.min);
    return Math.min(1, Math.max(0, position));
  };

  const handleSliderChange = (
    componentId: string,
    name: string,
    config: ParamSliderConfig,
    position: number,
  ): void => {
    const next = config.logarithmic
      ? config.min * Math.pow(config.max / config.min, position)
      : config.min + (config.max - config.min) * position;
    updateComponentParam(componentId, name, next);
  };

  const tunableParams = components.flatMap((component) =>
    Object.entries(component.params)
      .filter(([name]) => PARAM_SLIDERS[name] !== undefined)
      .map(([name, value]) => ({
        componentId: component.id,
        kindLabel: KIND_LABELS[component.kind],
        name,
        value,
        config: PARAM_SLIDERS[name],
      })),
  );

  return (
    <div className="calibration">
      <div className="calibration-main">
        <div className="calibration-toolbar">
          <button
            type="button"
            className="calibration-load-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loadStatus === 'loading'}
          >
            {loadStatus === 'loading' ? 'Loading…' : 'Load Reference Audio'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*,.wav,.mp3"
            className="calibration-file-input"
            onChange={handleFileChange}
          />
          {fileName !== null && (
            <span className="calibration-file-name" title={fileName}>
              {fileName}
            </span>
          )}
          <label className="calibration-window-control">
            Window
            <select
              className="calibration-window-select"
              value={windowMs}
              onChange={(event) => setWindowMs(Number(event.target.value))}
            >
              {WINDOW_OPTIONS_MS.map((value) => (
                <option key={value} value={value}>
                  {value} ms
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="calibration-play-button calibration-play-reference"
            onClick={handlePlayReference}
            disabled={reference === null}
          >
            {playTarget === 'reference' ? 'Playing reference…' : 'Play Reference'}
          </button>
          <button
            type="button"
            className="calibration-play-button calibration-play-simulation"
            onClick={handlePlaySimulation}
            disabled={result === null}
          >
            {playTarget === 'simulation' ? 'Playing simulation…' : 'Play Simulation'}
          </button>
          <button
            type="button"
            className="calibration-stop-button"
            onClick={handleStop}
            disabled={playTarget === null}
          >
            Stop
          </button>
          {simRunning && <span className="calibration-status">Simulating…</span>}
        </div>

        <div className="calibration-plot">
          {reference === null && result === null && (
            <div className="calibration-placeholder">
              Load a reference audio file and run the simulation to compare them here
            </div>
          )}
          <div ref={plotContainerRef} className="calibration-plot-canvas" />
        </div>

        {(netlistError !== null ||
          loadError !== null ||
          simError !== null ||
          playError !== null) && (
          <div className="calibration-errors">
            {netlistError !== null && <p className="calibration-error">{netlistError}</p>}
            {loadError !== null && (
              <p className="calibration-error">Reference file: {loadError}</p>
            )}
            {simError !== null && <p className="calibration-error">Simulation: {simError}</p>}
            {playError !== null && <p className="calibration-error">Playback: {playError}</p>}
          </div>
        )}
      </div>

      <aside className="calibration-controls">
        <h3 className="calibration-controls-heading">Tuning</h3>
        {tunableParams.length === 0 ? (
          <p className="calibration-hint">
            Add a resistor, capacitor or voltage source to the schematic to tune it here.
          </p>
        ) : (
          tunableParams.map(({ componentId, kindLabel, name, value, config }) => (
            <label key={`${componentId}-${name}`} className="calibration-slider-row">
              <span className="calibration-slider-header">
                <span className="calibration-slider-label">
                  {kindLabel} · {config.label}
                </span>
                <span className="calibration-slider-value">{config.format(value)}</span>
              </span>
              <input
                type="range"
                className="calibration-slider-input"
                min={0}
                max={1}
                step={0.001}
                value={sliderPosition(config, value)}
                onChange={(event) =>
                  handleSliderChange(componentId, name, config, Number(event.currentTarget.value))
                }
              />
            </label>
          ))
        )}
        <p className="calibration-hint">
          Moving a slider updates the schematic and re-runs the simulation, so the blue trace
          follows your changes in real time.
        </p>
      </aside>
    </div>
  );
}
