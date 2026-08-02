'use client';

import Link from 'next/link';
import { PointerEvent, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import layoutsData from '../../public/reference/11th-edition/data/event-layouts.json';
import necronBaseData from '../../public/reference/11th-edition/data/necron-base-sizes.json';
import TerrainVisibility from './TerrainVisibility';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const referenceRoot = `${basePath}/reference/11th-edition`;
const TABLE_WIDTH = 44;
const TABLE_HEIGHT = 60;
const MM_PER_INCH = 25.4;
const necronUnits = necronBaseData.presets.flatMap((preset) => preset.units.map((unit) => ({
  unit,
  widthMm: preset.widthMm,
  heightMm: preset.heightMm,
}))).sort((left, right) => left.unit.localeCompare(right.unit));

type Side = 'blue' | 'red';
type BaseMarker = {
  id: number;
  x: number;
  y: number;
  widthMm: number;
  heightMm: number;
  label: string;
  side: Side;
};

function dimensions(widthMm: number, heightMm: number) {
  return widthMm === heightMm ? `${widthMm}mm` : `${widthMm}×${heightMm}mm`;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export default function DeploymentPlanner() {
  const searchParams = useSearchParams();
  const requestedId = searchParams.get('layout');
  const layout = layoutsData.layouts.find(({ id }) => id === requestedId) ?? layoutsData.layouts[0];
  const page = String(layout.pdfPage).padStart(2, '0');
  const boardRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const dragId = useRef<number | null>(null);
  const measureDrag = useRef(false);
  const [markers, setMarkers] = useState<BaseMarker[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [side, setSide] = useState<Side>('blue');
  const [unitName, setUnitName] = useState('Necron Warriors');
  const [visibilityEnabled, setVisibilityEnabled] = useState(false);
  const [screenEnabled, setScreenEnabled] = useState(false);
  const [screenSide, setScreenSide] = useState<Side>('blue');
  const [measureEnabled, setMeasureEnabled] = useState(false);
  const [measurement, setMeasurement] = useState<null | {
    start: { x: number; y: number };
    end: { x: number; y: number };
  }>(null);

  const selected = markers.find(({ id }) => id === selectedId) ?? null;

  function pointFromEvent(event: PointerEvent) {
    const bounds = boardRef.current!.getBoundingClientRect();
    return {
      x: clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
      y: clamp((event.clientY - bounds.top) / bounds.height, 0, 1),
    };
  }

  function addBase(widthMm: number, heightMm: number, label: string) {
    const offset = (markers.length % 7) * 0.025;
    const marker: BaseMarker = {
      id: nextId.current++,
      x: clamp(0.5 + offset, 0.1, 0.9),
      y: clamp(0.5 + offset, 0.1, 0.9),
      widthMm,
      heightMm,
      label,
      side,
    };
    setMarkers((current) => [...current, marker]);
    setSelectedId(marker.id);
  }

  function moveMarker(id: number, point: { x: number; y: number }) {
    setMarkers((current) => current.map((marker) => {
      if (marker.id !== id) return marker;
      const radiusX = marker.widthMm / MM_PER_INCH / 2;
      const radiusY = marker.heightMm / MM_PER_INCH / 2;
      return {
        ...marker,
        x: clamp(point.x, radiusX / TABLE_WIDTH, 1 - radiusX / TABLE_WIDTH),
        y: clamp(point.y, radiusY / TABLE_HEIGHT, 1 - radiusY / TABLE_HEIGHT),
      };
    }));
  }

  function onBoardPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (dragId.current !== null) {
      moveMarker(dragId.current, pointFromEvent(event));
    } else if (measureDrag.current) {
      const point = pointFromEvent(event);
      setMeasurement((current) => current ? {
        ...current,
        end: { x: point.x * TABLE_WIDTH, y: point.y * TABLE_HEIGHT },
      } : current);
    }
  }

  function onBoardPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!measureEnabled || event.target !== event.currentTarget) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    measureDrag.current = true;
    const point = pointFromEvent(event);
    const tablePoint = { x: point.x * TABLE_WIDTH, y: point.y * TABLE_HEIGHT };
    setMeasurement({ start: tablePoint, end: tablePoint });
  }

  function removeSelected() {
    if (selectedId === null) return;
    setMarkers((current) => current.filter(({ id }) => id !== selectedId));
    setSelectedId(null);
  }

  function addSelectedUnit() {
    const preset = necronUnits.find(({ unit }) => unit === unitName)!;
    addBase(preset.widthMm, preset.heightMm, preset.unit);
  }

  function rotateSelected() {
    if (!selected || selected.widthMm === selected.heightMm) return;
    setMarkers((current) => current.map((marker) => marker.id === selected.id ? {
      ...marker,
      widthMm: marker.heightMm,
      heightMm: marker.widthMm,
    } : marker));
  }

  return (
    <main className="planner-shell">
      <header className="planner-header">
        <div>
          <Link href="/">← Missions</Link>
          <h1>Deployment planner — Layout {layout.layout}</h1>
          <p>{layout.attacker.forceDisposition} vs {layout.defender.forceDisposition}</p>
        </div>
        <a href={`${referenceRoot}/official/event-companion.pdf#page=${layout.pdfPage}`} target="_blank">
          Source PDF p.{layout.pdfPage} ↗
        </a>
      </header>

      <div className="planner-workspace">
        <aside className="planner-controls">
          <section>
            <h2>Add Necron base</h2>
            <div className="side-toggle" aria-label="Base side">
              <button className={side === 'blue' ? 'active blue' : ''} onClick={() => setSide('blue')}>Blue</button>
              <button className={side === 'red' ? 'active red' : ''} onClick={() => setSide('red')}>Red</button>
            </div>
            <label className="unit-preset">
              <span>Unit preset</span>
              <select value={unitName} onChange={(event) => setUnitName(event.target.value)}>
                {necronUnits.map((preset) => (
                  <option key={preset.unit} value={preset.unit}>
                    {preset.unit} — {dimensions(preset.widthMm, preset.heightMm)}
                  </option>
                ))}
              </select>
            </label>
            <button className="add-unit-button" onClick={addSelectedUnit}>Add {unitName}</button>
            <div className="base-sizes-label">Quick size</div>
            <div className="base-size-grid">
              {necronBaseData.presets.map((preset) => (
                <button
                  key={`${preset.widthMm}x${preset.heightMm}`}
                  onClick={() => addBase(preset.widthMm, preset.heightMm, dimensions(preset.widthMm, preset.heightMm))}
                >
                  {dimensions(preset.widthMm, preset.heightMm)}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h2>Selected base</h2>
            <div className="selection-readout">
              {selected ? <><strong>{selected.label}</strong><span>{dimensions(selected.widthMm, selected.heightMm)} · {selected.side} · drag to move</span></> : <span>Tap a base to select it.</span>}
            </div>
            <button disabled={!selected || selected.widthMm === selected.heightMm} onClick={rotateSelected}>Rotate oval 90°</button>
            <button className="danger-button" disabled={!selected} onClick={removeSelected}>Remove selected</button>
            <button disabled={markers.length === 0} onClick={() => { setMarkers([]); setSelectedId(null); }}>Clear all</button>
          </section>

          <section>
            <h2>Map overlays</h2>
            <div className="overlay-control-label">Terrain visibility</div>
            <button
              className={visibilityEnabled ? 'los-toggle active' : 'los-toggle'}
              disabled={!selected}
              onClick={() => setVisibilityEnabled((enabled) => !enabled)}
            >
              {visibilityEnabled ? 'Visibility on' : 'Show where visible'}
            </button>
            <p className="control-help">
              Red shading shows every position with an unobstructed sight line to the selected base. Rays pass directly beside every terrain-footprint corner to form the visibility cones; drag the base to recalculate them.
            </p>
            <div className="overlay-divider" />
            <div className="overlay-control-label">8″ deep-strike screen</div>
            <div className="side-toggle" aria-label="Deep-strike screening side">
              <button className={screenSide === 'blue' ? 'active blue' : ''} onClick={() => setScreenSide('blue')}>Blue</button>
              <button className={screenSide === 'red' ? 'active red' : ''} onClick={() => setScreenSide('red')}>Red</button>
            </div>
            <button className={screenEnabled ? 'screen-toggle active' : 'screen-toggle'} onClick={() => setScreenEnabled((enabled) => !enabled)}>
              {screenEnabled ? `${screenSide} screen on` : 'Show screened region'}
            </button>
            <p className="control-help">Shades the union of all positions within 8″ of a {screenSide} base edge.</p>
            <div className="overlay-divider" />
            <div className="overlay-control-label">Ruler</div>
            <button className={measureEnabled ? 'measure-toggle active' : 'measure-toggle'} onClick={() => setMeasureEnabled((enabled) => !enabled)}>
              {measureEnabled ? 'Measure mode on' : 'Measure distance'}
            </button>
            <p className="control-help">Turn on, then drag between any two points on the map.</p>
          </section>
        </aside>

        <section className="battlefield-panel">
          <div className="battlefield-title">
            <strong>44″ × 60″ battlefield</strong>
            <span>{markers.length} base{markers.length === 1 ? '' : 's'}</span>
          </div>
          <div
            ref={boardRef}
            className={`battlefield${visibilityEnabled ? ' visibility-active' : ''}${measureEnabled ? ' measure-active' : ''}`}
            onPointerDown={onBoardPointerDown}
            onPointerMove={onBoardPointerMove}
            onPointerUp={() => { dragId.current = null; measureDrag.current = false; }}
            onPointerCancel={() => { dragId.current = null; measureDrag.current = false; }}
          >
            <img src={`${referenceRoot}/maps/layout-${page}.jpg`} alt={`Map-only view of layout ${layout.layout}`} draggable={false} />
            {screenEnabled && (
              <svg className={`deep-strike-overlay ${screenSide}`} viewBox={`0 0 ${TABLE_WIDTH} ${TABLE_HEIGHT}`} aria-hidden="true">
                <defs>
                  <mask id="deep-strike-screen-mask" maskUnits="userSpaceOnUse" x="0" y="0" width={TABLE_WIDTH} height={TABLE_HEIGHT}>
                    <rect width={TABLE_WIDTH} height={TABLE_HEIGHT} fill="black" />
                    {markers.filter((marker) => marker.side === screenSide).map((marker) => (
                      <ellipse
                        key={marker.id}
                        cx={marker.x * TABLE_WIDTH}
                        cy={marker.y * TABLE_HEIGHT}
                        rx={8 + marker.widthMm / MM_PER_INCH / 2}
                        ry={8 + marker.heightMm / MM_PER_INCH / 2}
                        fill="white"
                      />
                    ))}
                  </mask>
                </defs>
                <rect width={TABLE_WIDTH} height={TABLE_HEIGHT} mask="url(#deep-strike-screen-mask)" />
              </svg>
            )}
            {selected && (
              <TerrainVisibility
                enabled={visibilityEnabled}
                maskUrl={`${referenceRoot}/terrain-masks/layout-${page}.png`}
                x={selected.x}
                y={selected.y}
              />
            )}
            {markers.map((marker) => (
              <button
                type="button"
                key={marker.id}
                className={`base-marker ${marker.side}${selectedId === marker.id ? ' selected' : ''}`}
                style={{
                  left: `${marker.x * 100}%`,
                  top: `${marker.y * 100}%`,
                  width: `${(marker.widthMm / MM_PER_INCH / TABLE_WIDTH) * 100}%`,
                  height: `${(marker.heightMm / MM_PER_INCH / TABLE_HEIGHT) * 100}%`,
                }}
                title={`${marker.label}, ${dimensions(marker.widthMm, marker.heightMm)}, ${marker.side}`}
                aria-label={`${marker.label}, ${dimensions(marker.widthMm, marker.heightMm)}, ${marker.side}`}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  dragId.current = marker.id;
                  setSelectedId(marker.id);
                }}
                onPointerMove={(event) => {
                  if (dragId.current === marker.id) moveMarker(marker.id, pointFromEvent(event));
                }}
                onPointerUp={() => { dragId.current = null; }}
              >
                <span>{marker.widthMm === marker.heightMm ? marker.widthMm : 'oval'}</span>
              </button>
            ))}
            {measurement && (
              <svg className="measurement-overlay" viewBox={`0 0 ${TABLE_WIDTH} ${TABLE_HEIGHT}`} aria-hidden="true">
                <line x1={measurement.start.x} y1={measurement.start.y} x2={measurement.end.x} y2={measurement.end.y} />
                <circle cx={measurement.start.x} cy={measurement.start.y} r=".35" />
                <circle cx={measurement.end.x} cy={measurement.end.y} r=".35" />
                <text
                  x={(measurement.start.x + measurement.end.x) / 2}
                  y={(measurement.start.y + measurement.end.y) / 2 - .65}
                >
                  {Math.hypot(measurement.end.x - measurement.start.x, measurement.end.y - measurement.start.y).toFixed(1)}″
                </text>
              </svg>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
