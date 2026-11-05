import { DEFAULT_AUDIO_SAMPLE_RATE } from './resample';
import synthProcessorUrl from './synth-processor.ts?worker&url';

type AudioEngineState = 'uninitialized' | 'ready' | 'failed';

export class AudioEngine {
  private context: AudioContext | null = null;
  private node: AudioWorkletNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private state: AudioEngineState = 'uninitialized';

  
  async init(): Promise<void> {
    if (this.state === 'ready') {
      return;
    }

    if (this.context === null) {
      this.context = new AudioContext({ sampleRate: DEFAULT_AUDIO_SAMPLE_RATE });
    }

    try {
      await this.context.audioWorklet.addModule(synthProcessorUrl);
      const node = new AudioWorkletNode(this.context, 'synth-processor', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      const analyser = this.context.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.65;
      node.connect(analyser);
      analyser.connect(this.context.destination);
      if (this.context.state === 'suspended') {
        await this.context.resume();
      }
      this.node = node;
      this.analyserNode = analyser;
      this.state = 'ready';
    } catch (error) {
      this.state = 'failed';
      throw error;
    }
  }

  get sampleRate(): number {
    return this.context?.sampleRate ?? DEFAULT_AUDIO_SAMPLE_RATE;
  }

  get isSuspended(): boolean {
    return this.context !== null && this.context.state !== 'running';
  }

  async resume(): Promise<void> {
    if (this.context === null) {
      await this.init();
      return;
    }
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  get analyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  play(samples: Float32Array): void {
    if (this.node === null) {
      throw new Error('AudioEngine is not initialized — call init() first.');
    }
    this.node.port.postMessage(samples);
  }

  stop(): void {
    this.node?.port.postMessage(new Float32Array(0));
  }

  dispose(): void {
    this.stop();
    if (this.node !== null) {
      this.node.disconnect();
      this.node.port.close();
      this.node = null;
    }
    if (this.analyserNode !== null) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }
    if (this.context !== null) {
      void this.context.close();
      this.context = null;
    }
    this.state = 'uninitialized';
  }
}
