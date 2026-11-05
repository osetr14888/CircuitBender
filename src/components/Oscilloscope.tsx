import { useEffect, useRef, useState } from 'react';
import uPlot from 'uplot';
import type { SpiceSimulationResult } from '../simulation/spiceClient';

const VOLTS_PER_DIV_OPTIONS = [0.1, 0.2, 0.5, 1, 2, 5];
const TIME_PER_DIV_OPTIONS = [0.1, 0.2, 0.5, 1, 2, 5]; // ms/div
const DEFAULT_VOLTS_PER_DIV = 1;
const DEFAULT_TIME_PER_DIV = 1;

const VERTICAL_DIVISIONS = 8;
const HORIZONTAL_DIVISIONS = 10;

const GRID_COLOR = '#1e5c1e';
const TRACE_COLOR = '#3dff6e';

type OscilloscopeProps = {
  result: SpiceSimulationResult | null;
};

function formatTick(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

function formatDivLabel(value: number): string {
  return formatTick(value);
}

function buildDivSplits(divSize: number, count: number): number[] {
  const splits: number[] = [];
  for (let i = 0; i <= count; i += 1) {
    splits.push(i * divSize);
  }
  return splits;
}

function buildSymmetricSplits(divSize: number, halfCount: number): number[] {
  const splits: number[] = [];
  for (let i = -halfCount; i <= halfCount; i += 1) {
    splits.push(i * divSize);
  }
  return splits;
}

export function Oscilloscope({ result }: OscilloscopeProps) {
  const [voltsPerDiv, setVoltsPerDiv] = useState(DEFAULT_VOLTS_PER_DIV);
  const [timePerDiv, setTimePerDiv] = useState(DEFAULT_TIME_PER_DIV);

  const plotContainerRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);

  useEffect(() => {
    const container = plotContainerRef.current;
    if (container === null || result === null) {
      if (plotRef.current !== null) {
        plotRef.current.destroy();
        plotRef.current = null;
      }
      return;
    }

    const timeMs = new Float32Array(result.time.length);
    for (let i = 0; i < result.time.length; i += 1) {
      timeMs[i] = result.time[i] * 1000;
    }

    const yMax = voltsPerDiv * (VERTICAL_DIVISIONS / 2);
    const xMax = timePerDiv * HORIZONTAL_DIVISIONS;

    const rect = container.getBoundingClientRect();
    const width = Math.max(10, Math.round(rect.width));
    const height = Math.max(10, Math.round(rect.height));

    const plot = new uPlot(
      {
        width,
        height,
        legend: { show: false },
        cursor: { drag: { x: true, y: false } },
        scales: {
          x: { time: false, range: [0, xMax] },
          v: { range: [-yMax, yMax] },
        },
        axes: [
          {
            scale: 'x',
            splits: () => buildDivSplits(timePerDiv, HORIZONTAL_DIVISIONS),
            grid: { stroke: GRID_COLOR, width: 1 },
            values: (_u: uPlot, values: number[]) =>
              values.map((value) => `${formatTick(value)} ms`),
          },
          {
            scale: 'v',
            splits: () => buildSymmetricSplits(voltsPerDiv, VERTICAL_DIVISIONS / 2),
            grid: { stroke: GRID_COLOR, width: 1 },
            values: (_u: uPlot, values: number[]) =>
              values.map((value) => `${formatTick(value)} V`),
          },
        ],
        series: [
          { label: 'Time' },
          { label: result.outputName, stroke: TRACE_COLOR, width: 2 },
        ],
      },
      [timeMs, result.voltage],
      container,
    );

    plotRef.current = plot;

    const resizeObserver = new ResizeObserver(() => {
      const bounds = container.getBoundingClientRect();
      const nextWidth = Math.max(10, Math.round(bounds.width));
      const nextHeight = Math.max(10, Math.round(bounds.height));
      plot.setSize({ width: nextWidth, height: nextHeight });
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      plot.destroy();
      plotRef.current = null;
    };
  }, [result, voltsPerDiv, timePerDiv]);

  return (
    <div className="scope">
      <div className="scope-controls">
        <label className="scope-control">
          Volts/Div
          <select
            className="scope-select"
            value={voltsPerDiv}
            onChange={(event) => setVoltsPerDiv(Number(event.target.value))}
          >
            {VOLTS_PER_DIV_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {formatDivLabel(value)} V
              </option>
            ))}
          </select>
        </label>
        <label className="scope-control">
          Time/Div
          <select
            className="scope-select"
            value={timePerDiv}
            onChange={(event) => setTimePerDiv(Number(event.target.value))}
          >
            {TIME_PER_DIV_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {formatDivLabel(value)} ms
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="scope-screen">
        {result === null && (
          <div className="scope-placeholder">Run Simulation to see the signal</div>
        )}
        {result !== null && <span className="scope-readout">{result.outputName}</span>}
        <div ref={plotContainerRef} className="scope-plot" />
      </div>
    </div>
  );
}
