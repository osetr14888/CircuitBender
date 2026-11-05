declare module 'eecircuit-engine' {
  export type ComplexNumber = {
    real: number;
    img: number;
  };

  export type VariableType = 'voltage' | 'current' | 'time' | 'frequency' | 'notype';

  export type RealDataType = {
    name: string;
    type: VariableType;
    values: number[];
  };

  export type ComplexDataType = {
    name: string;
    type: VariableType;
    values: ComplexNumber[];
  };

  export type ResultType =
    | {
        header: string;
        numVariables: number;
        variableNames: string[];
        numPoints: number;
        dataType: 'real';
        data: RealDataType[];
      }
    | {
        header: string;
        numVariables: number;
        variableNames: string[];
        numPoints: number;
        dataType: 'complex';
        data: ComplexDataType[];
      };

  export class Simulation {
    start: () => Promise<void>;
    runSim: () => Promise<ResultType>;
    setNetList: (netlist: string) => void;
    getInfo: () => string;
    getError: () => string[];
  }
}
