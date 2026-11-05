export type SpiceWorkerRequest = {
  type: 'run-simulation';
  netlist: string;
  requestId: number;
};

export type SpiceSimulationResult = {
  status: 'success';
  time: Float32Array;
  voltage: Float32Array;
  outputName: string;
  variableNames: string[];
  numPoints: number;
};

export type SpiceSimulationFailure = {
  status: 'error';
  message: string;
};

export type SpiceWorkerResponse = {
  type: 'simulation-result';
  requestId: number;
} & (SpiceSimulationResult | SpiceSimulationFailure);
