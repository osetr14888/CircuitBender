import { useEffect, useRef, useState } from 'react';
import { AudioLines, ChevronDown, Download, FileCode2 } from 'lucide-react';
import { DEFAULT_AUDIO_SAMPLE_RATE, resampleToAudio } from '../audio/resample';
import { encodeWav } from '../audio/wavEncoder';
import { downloadBlob } from '../utils/download';
import type { SpiceSimulationResult } from '../simulation/spiceClient';

type ExportMenuProps = {
  result: SpiceSimulationResult | null;
  netlist: string | null;
};

export function ExportMenu({ result, netlist }: ExportMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;
      if (target !== null && containerRef.current !== null && !containerRef.current.contains(target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const handleExportWav = (): void => {
    if (result === null) {
      return;
    }
    const samples = resampleToAudio(result.time, result.voltage, DEFAULT_AUDIO_SAMPLE_RATE);
    downloadBlob(encodeWav(samples, DEFAULT_AUDIO_SAMPLE_RATE), 'circuitbender-audio.wav');
    setOpen(false);
  };

  const handleExportCir = (): void => {
    if (netlist === null) {
      return;
    }
    downloadBlob(
      new Blob([netlist], { type: 'text/plain;charset=utf-8' }),
      'circuitbender-schematic.cir',
    );
    setOpen(false);
  };

  const handleExportNet = (): void => {
    if (netlist === null) {
      return;
    }
    downloadBlob(
      new Blob([netlist], { type: 'text/plain;charset=utf-8' }),
      'circuitbender-schematic.net',
    );
    setOpen(false);
  };

  const netlistDisabled = netlist === null;
  const netlistHint = netlistDisabled
    ? 'The schematic must be valid before exporting a netlist.'
    : undefined;

  return (
    <div className="export-menu" ref={containerRef}>
      <button
        type="button"
        className="export-toggle"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Download size={15} aria-hidden="true" />
        Export
        <ChevronDown
          className={open ? 'chevron chevron-open' : 'chevron'}
          size={14}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div className="export-dropdown" role="menu">
          <button
            type="button"
            role="menuitem"
            className="export-item"
            disabled={result === null}
            onClick={handleExportWav}
            title={result === null ? 'Run Simulation first.' : undefined}
          >
            <AudioLines size={15} aria-hidden="true" />
            Export WAV (Audio)
          </button>
          <button
            type="button"
            role="menuitem"
            className="export-item"
            disabled={netlistDisabled}
            onClick={handleExportCir}
            title={netlistHint}
          >
            <FileCode2 size={15} aria-hidden="true" />
            Export SPICE Netlist (.cir)
          </button>
          <button
            type="button"
            role="menuitem"
            className="export-item"
            disabled={netlistDisabled}
            onClick={handleExportNet}
            title={netlistHint}
          >
            <FileCode2 size={15} aria-hidden="true" />
            Export SPICE Netlist for KiCad (.net)
          </button>
        </div>
      )}
    </div>
  );
}
