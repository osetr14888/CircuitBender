import { useEffect, useRef } from 'react';

const MIN_FREQUENCY_HZ = 20;
const MIN_DB = -100;
const MAX_DB = 0;
const DECADE_TICKS_HZ = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
const DB_TICKS = [-100, -80, -60, -40, -20, 0];
const FALLBACK_SAMPLE_RATE = 48000;
const FALLBACK_FFT_SIZE = 4096;

const SCOPE_BG = '#021102';
const GRID_COLOR = '#1e5c1e';
const LABEL_COLOR = '#4a9a4a';
const TRACE_COLOR = '#3dff6e';
const HINT_COLOR = '#9e9e9e';

type SpectrumAnalyzerProps = {
  analyser: AnalyserNode | null;
  playing: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function formatFrequency(frequency: number): string {
  return frequency >= 1000 ? `${Math.round(frequency / 1000)}k` : String(frequency);
}

export function SpectrumAnalyzer({ analyser, playing }: SpectrumAnalyzerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (container === null || canvas === null) {
      return;
    }
    const ctx = canvas.getContext('2d');
    if (ctx === null) {
      return;
    }

    const frequencyData =
      analyser === null ? null : new Uint8Array(analyser.frequencyBinCount);
    const sampleRate = analyser?.context.sampleRate ?? FALLBACK_SAMPLE_RATE;
    const fftSize = analyser?.fftSize ?? FALLBACK_FFT_SIZE;
    const binWidth = sampleRate / fftSize;
    const maxFrequency = sampleRate / 2;

    let rafId = 0;
    let width = 1;
    let height = 1;

    const xForFrequency = (frequency: number): number =>
      (Math.log10(frequency / MIN_FREQUENCY_HZ) / Math.log10(maxFrequency / MIN_FREQUENCY_HZ)) *
      width;

    const draw = (): void => {
      rafId = requestAnimationFrame(draw);

      ctx.fillStyle = SCOPE_BG;
      ctx.fillRect(0, 0, width, height);

      for (const db of DB_TICKS) {
        const y = ((MAX_DB - db) / (MAX_DB - MIN_DB)) * height;
        ctx.strokeStyle = GRID_COLOR;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      for (const frequency of DECADE_TICKS_HZ) {
        if (frequency > maxFrequency) {
          continue;
        }
        const x = xForFrequency(frequency);
        ctx.strokeStyle = GRID_COLOR;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      if (analyser !== null && frequencyData !== null) {
        analyser.getByteFrequencyData(frequencyData);
        ctx.fillStyle = TRACE_COLOR;
        const firstBin = Math.max(0, Math.floor(MIN_FREQUENCY_HZ / binWidth));
        for (let i = firstBin; i < frequencyData.length; i += 1) {
          const frequency = i * binWidth;
          const x0 = xForFrequency(frequency);
          const x1 = xForFrequency(frequency + binWidth);
          // value 255 ≈ 0 dBFS; value 0 → -∞, so silence draws nothing.
          const db = 20 * Math.log10(frequencyData[i] / 255);
          const fraction = clamp((db - MIN_DB) / (MAX_DB - MIN_DB), 0, 1);
          const barHeight = fraction * height;
          const barWidth = Math.max(1, x1 - x0 - 0.5);
          ctx.fillRect(x0, height - barHeight, barWidth, barHeight);
        }
      }

      ctx.font = '10px monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = LABEL_COLOR;
      for (const db of DB_TICKS) {
        const y = ((MAX_DB - db) / (MAX_DB - MIN_DB)) * height;
        ctx.fillText(`${db} dB`, 4, Math.min(height - 2, y + 10));
      }
      ctx.textAlign = 'center';
      for (const frequency of DECADE_TICKS_HZ) {
        if (frequency > maxFrequency) {
          continue;
        }
        ctx.fillText(formatFrequency(frequency), xForFrequency(frequency), height - 4);
      }

      if (analyser === null || !playing) {
        ctx.font = '13px sans-serif';
        ctx.fillStyle = HINT_COLOR;
        ctx.fillText(
          analyser === null
            ? 'Press "Play Sound" to start the spectrum analyzer'
            : 'Playback stopped — press "Play Sound"',
          width / 2,
          height / 2,
        );
      }
    };

    const resize = (): void => {
      const bounds = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      width = Math.max(1, Math.round(bounds.width));
      height = Math.max(1, Math.round(bounds.height));
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
    };
  }, [analyser, playing]);

  return (
    <div ref={containerRef} className="spectrum">
      <canvas ref={canvasRef} className="spectrum-canvas" />
    </div>
  );
}
