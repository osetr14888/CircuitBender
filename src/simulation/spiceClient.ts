import type {
  SpiceSimulationResult,
  SpiceWorkerRequest,
  SpiceWorkerResponse,
} from './spiceMessages';

export type { SpiceSimulationResult };

export class SpiceClient {
  private readonly worker: Worker;
  private readonly pending = new Map<number, (response: SpiceWorkerResponse) => void>();
  private nextRequestId = 0;

  constructor() {
    this.worker = new Worker(new URL('../workers/spice.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (event: MessageEvent<SpiceWorkerResponse>) => {
      const resolve = this.pending.get(event.data.requestId);
      if (resolve !== undefined) {
        this.pending.delete(event.data.requestId);
        resolve(event.data);
      }
    };
    this.worker.onerror = (event: ErrorEvent) => {
      this.rejectAll(event.message || 'SPICE worker crashed');
    };
  }

  runSimulation(netlist: string): Promise<SpiceSimulationResult> {
    const requestId = this.nextRequestId++;
    const responsePromise = new Promise<SpiceWorkerResponse>((resolve) => {
      this.pending.set(requestId, resolve);
    });

    const request: SpiceWorkerRequest = {
      type: 'run-simulation',
      netlist,
      requestId,
    };
    this.worker.postMessage(request);

    return responsePromise.then((response) => {
      if (response.status === 'error') {
        throw new Error(response.message);
      }
      return response;
    });
  }

  dispose(): void {
    this.worker.terminate();
    this.rejectAll('SPICE worker was disposed');
  }

  private rejectAll(message: string): void {
    for (const [requestId, resolve] of this.pending) {
      resolve({
        type: 'simulation-result',
        requestId,
        status: 'error',
        message,
      });
    }
    this.pending.clear();
  }
}
