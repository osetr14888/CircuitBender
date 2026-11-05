import { useState } from 'react';
import type { MutableRefObject } from 'react';
import { AudioEngine } from '../audio/audioEngine';
import type { SpiceClient, SpiceSimulationResult } from '../simulation/spiceClient';
import { Oscilloscope } from './Oscilloscope';
import { SpectrumAnalyzer } from './SpectrumAnalyzer';
import { CalibrationPanel } from './CalibrationPanel';

type InstrumentsTab = 'oscilloscope' | 'spectrum' | 'calibration';

type InstrumentsPanelProps = {
  result: SpiceSimulationResult | null;
  audioEngineRef: MutableRefObject<AudioEngine | null>;
  audioPlaying: boolean;
  client: SpiceClient | null;
  netlist: string;
  netlistError: string | null;
  onResult: (result: SpiceSimulationResult) => void;
};

export function InstrumentsPanel({
  result,
  audioEngineRef,
  audioPlaying,
  client,
  netlist,
  netlistError,
  onResult,
}: InstrumentsPanelProps) {
  const [tab, setTab] = useState<InstrumentsTab>('oscilloscope');
  const [collapsed, setCollapsed] = useState(false);

  const analyser = audioEngineRef.current?.analyser ?? null;

  return (
    <section className="instruments-panel">
      <div className="instruments-toolbar">
        <div className="instruments-tabs" role="tablist" aria-label="Instruments">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'oscilloscope'}
            className={`instruments-tab${tab === 'oscilloscope' ? ' instruments-tab-active' : ''}`}
            onClick={() => setTab('oscilloscope')}
          >
            Oscilloscope
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'spectrum'}
            className={`instruments-tab${tab === 'spectrum' ? ' instruments-tab-active' : ''}`}
            onClick={() => setTab('spectrum')}
          >
            Spectrum
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'calibration'}
            className={`instruments-tab${tab === 'calibration' ? ' instruments-tab-active' : ''}`}
            onClick={() => setTab('calibration')}
          >
            Calibrate
          </button>
        </div>
        <button
          type="button"
          className="instruments-toggle"
          onClick={() => setCollapsed((value) => !value)}
          title={collapsed ? 'Show instruments' : 'Hide instruments'}
          aria-expanded={!collapsed}
        >
          {collapsed ? 'Show ▲' : 'Hide ▼'}
        </button>
      </div>
      {!collapsed && (
        <div className="instruments-body">
          {tab === 'oscilloscope' && <Oscilloscope result={result} />}
          {tab === 'spectrum' && (
            <SpectrumAnalyzer analyser={analyser} playing={audioPlaying} />
          )}
          {tab === 'calibration' && (
            <CalibrationPanel
              client={client}
              netlist={netlist}
              netlistError={netlistError}
              result={result}
              audioEngineRef={audioEngineRef}
              onResult={onResult}
            />
          )}
        </div>
      )}
    </section>
  );
}
