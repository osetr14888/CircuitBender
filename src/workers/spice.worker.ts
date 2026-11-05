import { Simulation } from 'eecircuit-engine';
import type {
  SpiceWorkerRequest,
  SpiceWorkerResponse,
} from '../simulation/spiceMessages';

// Hard guard so a stuck engine can never leave the UI promise pending forever.
const SIMULATION_TIMEOUT_MS = 60_000;
const ERROR_POLL_INTERVAL_MS = 250;

let sim: Simulation | null = null;

/** Fatal ngspice error reported by the engine (e.g. bad netlist). */
class EngineFailure extends Error {}

async function getSimulation(): Promise<Simulation> {
  if (sim !== null) {
    return sim;
  }
  sim = new Simulation();
  await sim.start();
  return sim;
}


function watchEngineErrors(sim: Simulation): { promise: Promise<never>; stop: () => void } {
  let settled = false;
  let timer: number | undefined;
  const promise = new Promise<never>((_, reject) => {
    timer = self.setInterval(() => {
      if (settled) {
        return;
      }
      const errors = sim.getError();
      if (errors.length > 0) {
        settled = true;
        self.clearInterval(timer);
        reject(new EngineFailure(errors.join('\n')));
      }
    }, ERROR_POLL_INTERVAL_MS);
  });
  return {
    promise,
    stop: () => {
      settled = true;
      if (timer !== undefined) {
        self.clearInterval(timer);
      }
    },
  };
}

async function runTransient(netlist: string, requestId: number): Promise<SpiceWorkerResponse> {
  const engine = await getSimulation();
  engine.setNetList(netlist);

  const errorWatch = watchEngineErrors(engine);
  let timeoutId: number | undefined;

  try {
    const result = await Promise.race([
      engine.runSim(),
      errorWatch.promise,
      new Promise<never>((_, reject) => {
        timeoutId = self.setTimeout(() => {
          reject(new Error('SPICE simulation timed out'));
        }, SIMULATION_TIMEOUT_MS);
      }),
    ]);

    if (result.dataType !== 'real') {
      return {
        type: 'simulation-result',
        requestId,
        status: 'error',
        message: `Unsupported data type "${result.dataType}" — transient analysis must produce real data.`,
      };
    }

    const variables = new Map(result.data.map((v) => [v.name, v.values]));
    const time = variables.get('time');
    const voltage = variables.get('v(out)');
    if (time === undefined || voltage === undefined) {
      return {
        type: 'simulation-result',
        requestId,
        status: 'error',
        message: `Missing expected variables in SPICE output. Got: ${result.variableNames.join(', ') || '(none)'}. Expected "time" and "v(out)".`,
      };
    }

    return {
      type: 'simulation-result',
      requestId,
      status: 'success',
      time: new Float32Array(time),
      voltage: new Float32Array(voltage),
      outputName: 'v(out)',
      variableNames: result.variableNames,
      numPoints: result.numPoints,
    };
  } catch (error: unknown) {
    if (error instanceof EngineFailure) {
      // ngspice died; drop the broken engine so the next run starts fresh.
      sim = null;
    }
    throw error;
  } finally {
    errorWatch.stop();
    if (timeoutId !== undefined) {
      self.clearTimeout(timeoutId);
    }
  }
}

self.onmessage = (event: MessageEvent<SpiceWorkerRequest>) => {
  const message = event.data;
  if (message?.type !== 'run-simulation') {
    return;
  }

  void runTransient(message.netlist, message.requestId)
    .then((response) => {
      // Transfer the Float32Array buffers to avoid copying multi-MB results.
      const transferables: Transferable[] = [];
      if (response.status === 'success') {
        transferables.push(response.time.buffer, response.voltage.buffer);
      }
      self.postMessage(response, transferables);
    })
    .catch((error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const response: SpiceWorkerResponse = {
        type: 'simulation-result',
        requestId: message.requestId,
        status: 'error',
        message: `SPICE engine failure: ${errorMessage}`,
      };
      self.postMessage(response);
    });
};
