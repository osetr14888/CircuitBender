class SynthProcessor extends AudioWorkletProcessor {
  private buffer: Float32Array = new Float32Array(0);
  private readIndex = 0;

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent<Float32Array | null>) => {
      const samples = event.data;
      this.buffer = samples !== null && samples.length > 0 ? samples : new Float32Array(0);
      this.readIndex = 0;
    };
  }

  process(
    _inputs: Float32Array[][],
    outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>,
  ): boolean {
    const outputChannels = outputs[0];
    const frameCount = outputChannels.length > 0 ? outputChannels[0].length : 0;
    if (frameCount === 0) {
      return true;
    }

    if (this.buffer.length === 0) {
      for (let channelIndex = 0; channelIndex < outputChannels.length; channelIndex += 1) {
        const channel = outputChannels[channelIndex];
        if (channel !== undefined) {
          channel.fill(0);
        }
      }
      return true;
    }

    for (let frame = 0; frame < frameCount; frame += 1) {
      const sample = this.buffer[this.readIndex];
      this.readIndex += 1;
      if (this.readIndex >= this.buffer.length) {
        this.readIndex = 0;
      }
      for (let channelIndex = 0; channelIndex < outputChannels.length; channelIndex += 1) {
        const channel = outputChannels[channelIndex];
        if (channel !== undefined) {
          channel[frame] = sample;
        }
      }
    }

    return true;
  }
}

registerProcessor('synth-processor', SynthProcessor);

export {};
