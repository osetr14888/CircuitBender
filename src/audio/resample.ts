export const DEFAULT_AUDIO_SAMPLE_RATE = 48000;
export const DEFAULT_AUDIO_LOOP_SECONDS = 2;

export function resampleToAudio(
  simTime: Float32Array,
  simVoltage: Float32Array,
  targetSampleRate: number = DEFAULT_AUDIO_SAMPLE_RATE,
  loopSeconds: number = DEFAULT_AUDIO_LOOP_SECONDS,
): Float32Array {
  const numSamples = Math.max(1, Math.round(targetSampleRate * loopSeconds));
  const output = new Float32Array(numSamples);

  const pointCount = Math.min(simTime.length, simVoltage.length);
  if (pointCount < 2) {
    return output; 
  }

  let mean = 0;
  for (let i = 0; i < pointCount; i += 1) {
    mean += simVoltage[i];
  }
  mean /= pointCount;

  let peak = 0;
  for (let i = 0; i < pointCount; i += 1) {
    const centered = simVoltage[i] - mean;
    const magnitude = centered < 0 ? -centered : centered;
    if (magnitude > peak) {
      peak = magnitude;
    }
  }

  const duration = simTime[pointCount - 1] - simTime[0];
  const gain = peak > 1e-9 ? 1 / peak : 0;
  if (duration <= 0 || gain === 0) {
    return output; 
  }

  for (let i = 0; i < numSamples; i += 1) {
    const t = simTime[0] + ((i / targetSampleRate) % duration);
    const value = (interpolate(simTime, simVoltage, pointCount, t, duration) - mean) * gain;
    output[i] = value < -1 ? -1 : value > 1 ? 1 : value;
  }

  return output;
}

function interpolate(
  time: Float32Array,
  values: Float32Array,
  count: number,
  t: number,
  duration: number,
): number {
  let low = 0;
  let high = count - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (time[mid] <= t) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  let next = low + 1;
  let t1: number;
  if (next >= count) {
    next = 0;
    t1 = time[0] + duration;
  } else {
    t1 = time[next];
  }

  const t0 = time[low];
  const span = t1 - t0;
  if (span <= 0) {
    return values[low];
  }

  const fraction = (t - t0) / span;
  return values[low] + (values[next] - values[low]) * fraction;
}
