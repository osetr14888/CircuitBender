import { DEFAULT_AUDIO_SAMPLE_RATE } from './resample';

export const MAX_REFERENCE_SECONDS = 2;

function clampToUnit(value: number): number {
  return value < -1 ? -1 : value > 1 ? 1 : value;
}


export async function loadAndNormalizeAudio(file: File): Promise<Float32Array> {
  const arrayBuffer = await file.arrayBuffer();

  let context: AudioContext;
  try {
    context = new AudioContext({ sampleRate: DEFAULT_AUDIO_SAMPLE_RATE });
  } catch {
    context = new AudioContext();
  }

  try {
    const audioBuffer = await context.decodeAudioData(arrayBuffer);
    const channelData = audioBuffer.getChannelData(0);
    if (channelData.length === 0) {
      throw new Error('The audio file contains no samples.');
    }

    let peak = 0;
    for (let i = 0; i < channelData.length; i += 1) {
      const magnitude = channelData[i] < 0 ? -channelData[i] : channelData[i];
      if (magnitude > peak) {
        peak = magnitude;
      }
    }
    const gain = peak > 1e-9 ? 1 / peak : 0;

    const maxSamples = Math.round(DEFAULT_AUDIO_SAMPLE_RATE * MAX_REFERENCE_SECONDS);
    const targetCount = Math.min(
      maxSamples,
      Math.max(1, Math.round(audioBuffer.duration * DEFAULT_AUDIO_SAMPLE_RATE)),
    );
    const samples = new Float32Array(maxSamples);
    for (let i = 0; i < targetCount; i += 1) {
      const position = (i * audioBuffer.sampleRate) / DEFAULT_AUDIO_SAMPLE_RATE;
      const index = Math.floor(position);
      const fraction = position - index;
      const next = index + 1 < channelData.length ? channelData[index + 1] : channelData[index];
      const value = (channelData[index] + (next - channelData[index]) * fraction) * gain;
      samples[i] = clampToUnit(value);
    }

    return samples;
  } finally {
    void context.close();
  }
}

export function buildLinearTimeAxis(sampleRate: number, count: number): Float32Array {
  const axis = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    axis[i] = i / sampleRate;
  }
  return axis;
}

export function buildOverlayTimeGrid(durationSeconds: number, pointCount: number): Float32Array {
  const count = Math.max(2, Math.round(pointCount));
  const grid = new Float32Array(count);
  for (let i = 0; i < count; i += 1) {
    grid[i] = ((durationSeconds * i) / (count - 1)) * 1000;
  }
  return grid;
}

export function interpolateOntoGrid(
  sourceTime: Float32Array,
  sourceValues: Float32Array,
  targetTimeMs: Float32Array,
): (number | null)[] {
  const result: (number | null)[] = new Array<number | null>(targetTimeMs.length).fill(null);
  const count = Math.min(sourceTime.length, sourceValues.length);
  if (count < 2) {
    return result;
  }

  const start = sourceTime[0];
  const end = sourceTime[count - 1];
  for (let i = 0; i < targetTimeMs.length; i += 1) {
    const t = targetTimeMs[i] / 1000;
    if (t < start || t > end) {
      continue;
    }

    let low = 0;
    let high = count - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (sourceTime[mid] <= t) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }

    const nextIndex = low + 1 < count ? low + 1 : low;
    const t0 = sourceTime[low];
    const t1 = sourceTime[nextIndex];
    const span = t1 - t0;
    result[i] =
      span > 0
        ? sourceValues[low] + ((sourceValues[nextIndex] - sourceValues[low]) * (t - t0)) / span
        : sourceValues[low];
  }
  return result;
}

export function normalizeForOverlay(values: Float32Array): Float32Array {
  const count = values.length;
  const normalized = new Float32Array(count);
  if (count === 0) {
    return normalized;
  }

  let mean = 0;
  for (let i = 0; i < count; i += 1) {
    mean += values[i];
  }
  mean /= count;

  let peak = 0;
  for (let i = 0; i < count; i += 1) {
    const centered = values[i] - mean;
    const magnitude = centered < 0 ? -centered : centered;
    if (magnitude > peak) {
      peak = magnitude;
    }
  }

  const gain = peak > 1e-9 ? 1 / peak : 0;
  for (let i = 0; i < count; i += 1) {
    normalized[i] = (values[i] - mean) * gain;
  }
  return normalized;
}
