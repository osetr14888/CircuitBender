import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { Circle, Group, Line, Layer, Stage } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { CircuitBoard, Loader2, Play, Square, Volume2, VolumeX, X } from 'lucide-react';
import { useAppStore } from './store/appStore';
import { useAuthStore } from './store/authStore';
import { useToastStore } from './store/toastStore';
import { ToastContainer } from './components/ToastContainer';
import type { PinIndex, PinRef } from './types/schematic';
import { SimulationPanel } from './components/SimulationPanel';
import { InstrumentsPanel } from './components/InstrumentsPanel';
import { ExportMenu } from './components/ExportMenu';
import { CloudMenu } from './components/CloudMenu';
import { SchematicComponentView } from './components/SchematicComponent';
import { Sidebar } from './components/Sidebar';
import { COMPONENT_DRAG_TYPE, isComponentKind } from './components/componentCatalog';
import { PropertiesPanel } from './components/PropertiesPanel';
import { GRID_SIZE, manhattanWirePoints, pinIndexes, pinPosition, snapToGrid } from './components/schematicGeometry';
import { SpiceClient, type SpiceSimulationResult } from './simulation/spiceClient';
import { generateNetlist } from './simulation/netlistGenerator';
import { AudioEngine } from './audio/audioEngine';
import { resampleToAudio } from './audio/resample';

const MIN_STAGE_WIDTH = 320;
const MIN_STAGE_HEIGHT = 240;
const WIRE_PICK_DISTANCE = 10;
const WIRE_DRAG_THRESHOLD = 4;
const WIRE_HANDLE_RADIUS = 5;
const WIRE_HANDLE_HIT_RADIUS = 10;

interface Point {
  x: number;
  y: number;
}

type NetEnd = 0 | 1;

interface WireEndpoint {
  netId: string;
  end: NetEnd;
  pin: PinRef;
  point: Point;
}

interface PinPoint {
  pin: PinRef;
  point: Point;
}

interface WireDragState {
  netId: string;
  end: NetEnd;
  fixed: Point;
  pointer: Point;
}

interface PendingWireState {
  endpoint: WireEndpoint;
  fixed: Point;
  start: Point;
  pointer: Point;
}

function nearestEndpoint(
  endpoints: WireEndpoint[],
  point: Point,
  maxDistance: number,
): WireEndpoint | null {
  let nearest: WireEndpoint | null = null;
  let nearestDistance = maxDistance;
  for (const endpoint of endpoints) {
    const distance = Math.hypot(endpoint.point.x - point.x, endpoint.point.y - point.y);
    if (distance <= nearestDistance) {
      nearest = endpoint;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function nearestPin(pins: PinPoint[], point: Point, maxDistance: number): PinPoint | null {
  let nearest: PinPoint | null = null;
  let nearestDistance = maxDistance;
  for (const pin of pins) {
    const distance = Math.hypot(pin.point.x - point.x, pin.point.y - point.y);
    if (distance <= nearestDistance) {
      nearest = pin;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function Grid({ width, height }: { width: number; height: number }) {
  const lines = useMemo(() => {
    const result: { key: string; points: number[] }[] = [];
    for (let x = 0; x <= width; x += GRID_SIZE) {
      result.push({ key: `v-${x}`, points: [x, 0, x, height] });
    }
    for (let y = 0; y <= height; y += GRID_SIZE) {
      result.push({ key: `h-${y}`, points: [0, y, width, y] });
    }
    return result;
  }, [width, height]);

  return (
    <>
      {lines.map((line) => (
        <Line
          key={line.key}
          points={line.points}
          stroke="#26272a"
          strokeWidth={1}
          listening={false}
        />
      ))}
    </>
  );
}

function Canvas() {
  const components = useAppStore((state) => state.project.components);
  const nets = useAppStore((state) => state.project.nets);
  const selectedId = useAppStore((state) => state.selectedId);
  const selectedNetId = useAppStore((state) => state.selectedNetId);
  const addComponent = useAppStore((state) => state.addComponent);
  const updateComponentPosition = useAppStore((state) => state.updateComponentPosition);
  const addNet = useAppStore((state) => state.addNet);
  const reconnectNet = useAppStore((state) => state.reconnectNet);
  const select = useAppStore((state) => state.select);
  const selectNet = useAppStore((state) => state.selectNet);
  const removeComponent = useAppStore((state) => state.removeComponent);
  const removeNet = useAppStore((state) => state.removeNet);
  const isProjectLoading = useAppStore((state) => state.isProjectLoading);

  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [activePin, setActivePin] = useState<PinRef | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [hoveredWireEnd, setHoveredWireEnd] = useState<{
    netId: string;
    end: NetEnd;
  } | null>(null);
  const [wireDrag, setWireDrag] = useState<WireDragState | null>(null);
  const [pendingWire, setPendingWire] = useState<PendingWireState | null>(null);

  const componentMap = useMemo(
    () => new Map(components.map((component) => [component.id, component])),
    [components],
  );

  const wireEndpoints = useMemo<WireEndpoint[]>(() => {
    const endpoints: WireEndpoint[] = [];
    for (const net of nets) {
      const fromComponent = componentMap.get(net.pins[0].componentId);
      const toComponent = componentMap.get(net.pins[1].componentId);
      if (fromComponent === undefined || toComponent === undefined) {
        continue;
      }
      endpoints.push({
        netId: net.id,
        end: 0,
        pin: net.pins[0],
        point: pinPosition(fromComponent, net.pins[0].index),
      });
      endpoints.push({
        netId: net.id,
        end: 1,
        pin: net.pins[1],
        point: pinPosition(toComponent, net.pins[1].index),
      });
    }
    return endpoints;
  }, [nets, componentMap]);

  const allPins = useMemo<PinPoint[]>(() => {
    const pins: PinPoint[] = [];
    for (const component of components) {
      for (const index of pinIndexes(component.kind)) {
        pins.push({
          pin: { componentId: component.id, index },
          point: pinPosition(component, index),
        });
      }
    }
    return pins;
  }, [components]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateSize = () => {
      const { width, height } = container.getBoundingClientRect();
      setStageSize({
        width: Math.max(width, MIN_STAGE_WIDTH),
        height: Math.max(height, MIN_STAGE_HEIGHT),
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (activePin === null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setActivePin(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activePin]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Delete' && event.key !== 'Backspace') {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (selectedNetId !== null) {
        removeNet(selectedNetId);
        return;
      }
      if (selectedId !== null) {
        removeComponent(selectedId);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, selectedNetId, removeComponent, removeNet]);

  useEffect(() => {
    if (wireDrag === null && pendingWire === null) return;
    const blockClick = (event: MouseEvent) => {
      event.stopPropagation();
      event.preventDefault();
    };
    const handleMouseUp = () => {
      if (wireDrag !== null) {
        const target = nearestPin(allPins, wireDrag.pointer, WIRE_PICK_DISTANCE);
        if (target === null) {
          removeNet(wireDrag.netId);
        } else {
          reconnectNet(wireDrag.netId, wireDrag.end, target.pin);
        }
      } else if (pendingWire !== null) {
        const clicked = pendingWire.endpoint.pin;
        setHoveredWireEnd(null);
        if (activePin === null) {
          setActivePin(clicked);
        } else if (
          activePin.componentId !== clicked.componentId ||
          activePin.index !== clicked.index
        ) {
          addNet(activePin, clicked);
          setActivePin(null);
        } else {
          setActivePin(null);
        }
      }
      setWireDrag(null);
      setPendingWire(null);
      setHoveredWireEnd(null);
      window.addEventListener('click', blockClick, true);
      window.setTimeout(() => {
        window.removeEventListener('click', blockClick, true);
      }, 0);
    };
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchend', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchend', handleMouseUp);
      window.removeEventListener('click', blockClick, true);
    };
  }, [wireDrag, pendingWire, activePin, allPins, reconnectNet, removeNet, addNet]);

  const handleStageClick = (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (event.target === event.target.getStage()) {
      select(null);
      selectNet(null);
      setActivePin(null);
      setHoveredWireEnd(null);
    }
  };

  const handleStageMouseMove = (event: KonvaEventObject<MouseEvent | TouchEvent>) => {
    const position = event.target.getStage()?.getPointerPosition() ?? null;
    if (activePin !== null) {
      setPointer(position);
      return;
    }
    if (position === null) return;
    if (pendingWire !== null) {
      const distance = Math.hypot(
        position.x - pendingWire.start.x,
        position.y - pendingWire.start.y,
      );
      if (distance >= WIRE_DRAG_THRESHOLD) {
        selectNet(pendingWire.endpoint.netId);
        setHoveredWireEnd(null);
        setWireDrag({
          netId: pendingWire.endpoint.netId,
          end: pendingWire.endpoint.end,
          fixed: pendingWire.fixed,
          pointer: position,
        });
        setPendingWire(null);
      }
      return;
    }
    if (wireDrag !== null) {
      setWireDrag((current) =>
        current === null ? current : { ...current, pointer: position },
      );
      return;
    }
    const nearest = nearestEndpoint(wireEndpoints, position, WIRE_PICK_DISTANCE);
    setHoveredWireEnd((current) => {
      if (nearest === null) {
        return current === null ? current : null;
      }
      if (
        current !== null &&
        current.netId === nearest.netId &&
        current.end === nearest.end
      ) {
        return current;
      }
      return { netId: nearest.netId, end: nearest.end };
    });
  };

  const handleStageMouseLeave = () => {
    if (wireDrag === null && pendingWire === null) {
      setHoveredWireEnd(null);
    }
  };

  const startWireHandle = (
    endpoint: WireEndpoint,
    event: KonvaEventObject<MouseEvent | TouchEvent>,
  ) => {
    event.cancelBubble = true;
    const other = wireEndpoints.find(
      (item) => item.netId === endpoint.netId && item.end !== endpoint.end,
    );
    if (other === undefined) return;
    const position = event.target.getStage()?.getPointerPosition() ?? endpoint.point;
    setPendingWire({
      endpoint,
      fixed: other.point,
      start: position,
      pointer: position,
    });
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const raw =
      event.dataTransfer.getData(COMPONENT_DRAG_TYPE) ||
      event.dataTransfer.getData('text/plain');
    if (!isComponentKind(raw)) return;
    const container = containerRef.current;
    if (container === null) return;
    const rect = container.getBoundingClientRect();
    addComponent(
      raw,
      snapToGrid(event.clientX - rect.left),
      snapToGrid(event.clientY - rect.top),
    );
  };

  const handlePinClick = (componentId: string, index: PinIndex) => {
    if (wireDrag !== null) return;
    setHoveredWireEnd(null);
    const clicked: PinRef = { componentId, index };
    if (activePin === null) {
      setActivePin(clicked);
      return;
    }
    if (
      activePin.componentId === clicked.componentId &&
      activePin.index === clicked.index
    ) {
      setActivePin(null);
      return;
    }
    addNet(activePin, clicked);
    setActivePin(null);
  };

  const activeComponent =
    activePin === null ? null : (componentMap.get(activePin.componentId) ?? null);
  const previewFrom =
    activePin !== null && activeComponent !== null
      ? pinPosition(activeComponent, activePin.index)
      : null;

  const hoveredEndpoint =
    hoveredWireEnd === null
      ? null
      : (wireEndpoints.find(
          (endpoint) =>
            endpoint.netId === hoveredWireEnd.netId &&
            endpoint.end === hoveredWireEnd.end,
        ) ?? null);

  const grabHandles = useMemo<WireEndpoint[]>(() => {
    if (wireDrag !== null || activePin !== null) {
      return [];
    }
    const handles: WireEndpoint[] = [];
    if (hoveredEndpoint !== null) {
      handles.push(hoveredEndpoint);
    }
    if (selectedNetId !== null) {
      for (const endpoint of wireEndpoints) {
        if (
          endpoint.netId === selectedNetId &&
          !handles.some(
            (handle) => handle.netId === endpoint.netId && handle.end === endpoint.end,
          )
        ) {
          handles.push(endpoint);
        }
      }
    }
    return handles;
  }, [wireDrag, activePin, hoveredEndpoint, selectedNetId, wireEndpoints]);

  const wireDragTarget =
    wireDrag === null ? null : nearestPin(allPins, wireDrag.pointer, WIRE_PICK_DISTANCE);
  const wireDragPreview =
    wireDrag === null ? null : (wireDragTarget?.point ?? wireDrag.pointer);

  const cursor =
    wireDrag !== null || pendingWire !== null
      ? 'grabbing'
      : activePin !== null
        ? 'crosshair'
        : hoveredEndpoint !== null
          ? 'grab'
          : 'default';

  return (
    <main className="canvas">
      <div
        ref={containerRef}
        className="canvas-inner"
        style={{ cursor }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <Stage
          width={stageSize.width}
          height={stageSize.height}
          onClick={handleStageClick}
          onTap={handleStageClick}
          onMouseMove={handleStageMouseMove}
          onTouchMove={handleStageMouseMove}
          onMouseLeave={handleStageMouseLeave}
          onTouchEnd={handleStageMouseLeave}
        >
          <Layer>
            <Grid width={stageSize.width} height={stageSize.height} />
            {nets.map((net) => {
              if (wireDrag !== null && wireDrag.netId === net.id) {
                return null;
              }
              const fromComponent = componentMap.get(net.pins[0].componentId);
              const toComponent = componentMap.get(net.pins[1].componentId);
              if (fromComponent === undefined || toComponent === undefined) {
                return null;
              }
              const from = pinPosition(fromComponent, net.pins[0].index);
              const to = pinPosition(toComponent, net.pins[1].index);
              const selected = net.id === selectedNetId;
              return (
                <Line
                  key={net.id}
                  points={manhattanWirePoints(from, to)}
                  stroke={selected ? '#ff5252' : '#4fc3f7'}
                  strokeWidth={selected ? 3 : 2}
                  hitStrokeWidth={12}
                  onClick={(event) => {
                    event.cancelBubble = true;
                    selectNet(net.id);
                  }}
                  onTap={(event) => {
                    event.cancelBubble = true;
                    selectNet(net.id);
                  }}
                />
              );
            })}
            {previewFrom !== null && (
              <Line
                points={manhattanWirePoints(previewFrom, {
                  x: pointer?.x ?? previewFrom.x,
                  y: pointer?.y ?? previewFrom.y,
                })}
                stroke="#ffd740"
                strokeWidth={2}
                dash={[6, 4]}
                listening={false}
              />
            )}
            {components.map((component) => (
              <SchematicComponentView
                key={component.id}
                component={component}
                selected={component.id === selectedId}
                activePinIndex={
                  activePin !== null && activePin.componentId === component.id
                    ? activePin.index
                    : null
                }
                onSelect={() => select(component.id)}
                onDragEnd={(x, y) => updateComponentPosition(component.id, x, y)}
                onPinClick={(index) => handlePinClick(component.id, index)}
              />
            ))}
          </Layer>
          <Layer>
            {wireDrag !== null && wireDragPreview !== null && (
              <>
                <Line
                  points={manhattanWirePoints(wireDrag.fixed, wireDragPreview)}
                  stroke="#ffd740"
                  strokeWidth={2}
                  dash={[6, 4]}
                  listening={false}
                />
                <Circle
                  x={wireDragPreview.x}
                  y={wireDragPreview.y}
                  radius={wireDragTarget !== null ? 7 : 4}
                  fill={wireDragTarget !== null ? '#ffd740' : '#4fc3f7'}
                  stroke="#263238"
                  strokeWidth={1.5}
                  listening={false}
                />
              </>
            )}
            {grabHandles.map((handle) => (
              <Group key={`${handle.netId}-${handle.end}`} x={handle.point.x} y={handle.point.y}>
                <Circle
                  radius={WIRE_HANDLE_HIT_RADIUS}
                  fill="rgba(255, 215, 64, 0.18)"
                  onMouseDown={(event) => startWireHandle(handle, event)}
                  onTouchStart={(event) => startWireHandle(handle, event)}
                />
                <Circle
                  radius={WIRE_HANDLE_RADIUS}
                  fill="#ffd740"
                  stroke="#263238"
                  strokeWidth={1.5}
                  listening={false}
                />
              </Group>
            ))}
          </Layer>
        </Stage>
      </div>
      {isProjectLoading && (
        <div className="canvas-skeleton" role="status" aria-live="polite">
          <div className="skeleton-card">
            <span className="skeleton-bar skeleton-bar-title" />
            <span className="skeleton-bar skeleton-bar-line" />
            <span className="skeleton-bar skeleton-bar-line skeleton-bar-line-short" />
            <span className="skeleton-label">
              <Loader2 className="spin" size={14} aria-hidden="true" />
              Loading project…
            </span>
          </div>
        </div>
      )}
    </main>
  );
}

type AudioStatus = 'idle' | 'initializing' | 'playing' | 'error';

function isAutoplayBlocked(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'NotAllowedError' || error.name === 'SecurityError')
  );
}

export default function App() {
 
  const [spiceClient, setSpiceClient] = useState<SpiceClient | null>(null);
  const [lastResult, setLastResult] = useState<SpiceSimulationResult | null>(null);
  const [audioStatus, setAudioStatus] = useState<AudioStatus>('idle');
  const [audioError, setAudioError] = useState<string | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const audioEngineRef = useRef<AudioEngine | null>(null);

  const project = useAppStore((state) => state.project);
  const initializeAuth = useAuthStore((state) => state.initialize);
  const pushToast = useToastStore((state) => state.pushToast);

  const netlistAnalysis = useMemo(() => generateNetlist(project), [project]);


  useEffect(() => initializeAuth(), [initializeAuth]);

  useEffect(() => {
    const client = new SpiceClient();
    setSpiceClient(client);
    return () => client.dispose();
  }, []);

 
  useEffect(() => {
    return () => {
      audioEngineRef.current?.dispose();
      audioEngineRef.current = null;
    };
  }, []);

  const ensureAudioEngine = async (): Promise<AudioEngine> => {
    if (audioEngineRef.current === null) {
      audioEngineRef.current = new AudioEngine();
    }
    const engine = audioEngineRef.current;
    await engine.init();
    return engine;
  };

  const handlePlaySound = async () => {
    if (lastResult === null) {
      return;
    }
    setAudioError(null);
    setAudioStatus('initializing');
    try {
      const engine = await ensureAudioEngine();
      await engine.resume();
      if (engine.isSuspended || engine.analyser === null) {
        setAudioBlocked(true);
        setAudioStatus('idle');
        return;
      }
      const samples = resampleToAudio(lastResult.time, lastResult.voltage, engine.sampleRate);
      engine.play(samples);
      setAudioBlocked(false);
      setAudioStatus('playing');
    } catch (error: unknown) {
      if (isAutoplayBlocked(error) || audioEngineRef.current?.isSuspended === true) {
        setAudioError(null);
        setAudioStatus('idle');
        setAudioBlocked(true);
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      setAudioError(message);
      setAudioStatus('error');
      pushToast(`Audio playback failed: ${message}`, 'error');
    }
  };

  const handleEnableSound = async () => {
    setAudioError(null);
    try {
      const engine = await ensureAudioEngine();
      await engine.resume();
      if (engine.isSuspended || engine.analyser === null) {
        setAudioBlocked(true);
        pushToast('The browser still blocks audio. Check the site sound permissions.', 'error');
        return;
      }
      setAudioBlocked(false);
      if (lastResult !== null) {
        const samples = resampleToAudio(lastResult.time, lastResult.voltage, engine.sampleRate);
        engine.play(samples);
        setAudioStatus('playing');
      }
    } catch (error: unknown) {
      if (isAutoplayBlocked(error) || audioEngineRef.current?.isSuspended === true) {
        setAudioError(null);
        setAudioStatus('idle');
        setAudioBlocked(true);
        pushToast('The browser still blocks audio. Check the site sound permissions.', 'error');
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      setAudioError(message);
      setAudioStatus('error');
      setAudioBlocked(true);
      pushToast(`Audio playback failed: ${message}`, 'error');
    }
  };

  const handleStopSound = () => {
    audioEngineRef.current?.stop();
    setAudioStatus('idle');
  };

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <CircuitBoard size={22} />
          </span>
          <div className="brand-text">
            <h1>CircuitBender</h1>
            <span className="brand-subtitle">Analog synth workbench</span>
          </div>
        </div>
        <div className="header-actions">
          <div className="audio-controls">
            <button
              type="button"
              className="audio-play-button"
              onClick={handlePlaySound}
              disabled={
                lastResult === null ||
                audioStatus === 'initializing' ||
                audioStatus === 'playing'
              }
            >
              {audioStatus === 'initializing' ? (
                <Loader2 className="spin" size={15} aria-hidden="true" />
              ) : (
                <Play size={15} aria-hidden="true" />
              )}
              {audioStatus === 'initializing' ? 'Loading…' : 'Play Sound'}
            </button>
            <button
              type="button"
              className="audio-stop-button"
              onClick={handleStopSound}
              disabled={audioStatus !== 'playing'}
            >
              <Square size={13} aria-hidden="true" />
              Stop
            </button>
          </div>
          <ExportMenu
            result={lastResult}
            netlist={netlistAnalysis.error === null ? netlistAnalysis.netlist : null}
          />
          <CloudMenu />
        </div>
      </header>
      {audioBlocked && (
        <div className="audio-banner" role="alert">
          <VolumeX className="audio-banner-icon" size={18} aria-hidden="true" />
          <span className="audio-banner-text">
            Your browser blocked audio playback.
          </span>
          <button type="button" className="audio-banner-button" onClick={handleEnableSound}>
            <Volume2 size={15} aria-hidden="true" />
            Click to enable sound
          </button>
          <button
            type="button"
            className="audio-banner-dismiss"
            aria-label="Dismiss audio notification"
            onClick={() => setAudioBlocked(false)}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}
      {audioError !== null && (
        <div className="audio-error-bar" role="status">
          {audioError}
        </div>
      )}
      <div className="workspace">
        <Sidebar />
        <Canvas />
        <PropertiesPanel />
      </div>
      <div className="bottom">
        {spiceClient !== null && (
          <SimulationPanel
            client={spiceClient}
            netlist={netlistAnalysis.error === null ? netlistAnalysis.netlist : ''}
            netlistError={netlistAnalysis.error}
            onResult={setLastResult}
          />
        )}
        <InstrumentsPanel
          result={lastResult}
          audioEngineRef={audioEngineRef}
          audioPlaying={audioStatus === 'playing'}
          client={spiceClient}
          netlist={netlistAnalysis.error === null ? netlistAnalysis.netlist : ''}
          netlistError={netlistAnalysis.error}
          onResult={setLastResult}
        />
      </div>
      <ToastContainer />
    </div>
  );
}
