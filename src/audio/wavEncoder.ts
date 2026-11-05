
const BITS_PER_SAMPLE = 16;
const NUM_CHANNELS = 1;
const HEADER_SIZE = 44;

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

export function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const blockAlign = (NUM_CHANNELS * BITS_PER_SAMPLE) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * blockAlign;

  const buffer = new ArrayBuffer(HEADER_SIZE + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');

  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, NUM_CHANNELS, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);

  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = HEADER_SIZE;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i];
    const clamped = sample < -1 ? -1 : sample > 1 ? 1 : sample;
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += blockAlign;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}
