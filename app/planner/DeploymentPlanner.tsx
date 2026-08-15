'use client';

import Link from 'next/link';
import { ChangeEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import layoutsData from '../../public/reference/11th-edition/data/event-layouts.json';
import armyData from '../../armies/necrons-2000.json';
import TerrainVisibility from './TerrainVisibility';
import MapAuditOverlay from './MapAuditOverlay';
import { coherencyIssues, MM_PER_INCH, TABLE_HEIGHT, TABLE_WIDTH, type PlannerMarker } from './planner-utils';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const referenceRoot = `${basePath}/reference/11th-edition`;

type Side = 'blue' | 'red';
type BaseMarker = PlannerMarker;

type SightLine = {
  label: string;
  from: [number, number];
  to: [number, number];
  clear: boolean;
  blockedAt: [number, number] | null;
};

type PlannerImport = {
  schemaVersion: number;
  name: string;
  layoutId: string;
  markers: Array<Omit<BaseMarker, 'x' | 'y'> & { x: number; y: number }>;
  sightLines?: SightLine[];
};

type MarkupPath = {
  id: number;
  color: string;
  points: Array<{ x: number; y: number }>;
};

type SavedPlanner = {
  markers: BaseMarker[];
  planName: string;
  sightLines: SightLine[];
  markupPaths: MarkupPath[];
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
  const nextMarkupId = useRef(1);
  const dragId = useRef<number | null>(null);
  const measureDrag = useRef(false);
  const markupDrag = useRef<number | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [markers, setMarkers] = useState<BaseMarker[]>([]);
  const [planName, setPlanName] = useState('');
  const [sightLines, setSightLines] = useState<SightLine[]>([]);
  const [importError, setImportError] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [side, setSide] = useState<Side>('blue');
  const [visibilityEnabled, setVisibilityEnabled] = useState(false);
  const [screenEnabled, setScreenEnabled] = useState(false);
  const [screenSide, setScreenSide] = useState<Side>('blue');
  const [measureEnabled, setMeasureEnabled] = useState(false);
  const [movementEnabled, setMovementEnabled] = useState(false);
  const [markupEnabled, setMarkupEnabled] = useState(false);
  const [markupColor, setMarkupColor] = useState('#ffe071');
  const [markupPaths, setMarkupPaths] = useState<MarkupPath[]>([]);
  const [auditEnabled, setAuditEnabled] = useState(false);
  const [restoredLayout, setRestoredLayout] = useState('');
  const [measurement, setMeasurement] = useState<null | {
    start: { x: number; y: number };
    end: { x: number; y: number };
  }>(null);

  const selected = markers.find(({ id }) => id === selectedId) ?? null;
  const markerCoherencyIssues = useMemo(() => coherencyIssues(markers), [markers]);

  useEffect(() => {
    setRestoredLayout('');
    try {
      const saved = localStorage.getItem(`deployment-planner:v1:${layout.id}`);
      if (saved) {
        const data = JSON.parse(saved) as SavedPlanner;
        setMarkers(Array.isArray(data.markers) ? data.markers : []);
        setPlanName(data.planName || 'Saved deployment');
        setSightLines(Array.isArray(data.sightLines) ? data.sightLines : []);
        setMarkupPaths(Array.isArray(data.markupPaths) ? data.markupPaths : []);
        nextId.current = Math.max(0, ...(data.markers || []).map(({ id }) => id)) + 1;
        nextMarkupId.current = Math.max(0, ...(data.markupPaths || []).map(({ id }) => id)) + 1;
      } else {
        setMarkers([]);
        setPlanName('');
        setSightLines([]);
        setMarkupPaths([]);
        nextId.current = 1;
        nextMarkupId.current = 1;
      }
    } catch {
      localStorage.removeItem(`deployment-planner:v1:${layout.id}`);
    }
    setSelectedId(null);
    setRestoredLayout(layout.id);
  }, [layout.id]);

  useEffect(() => {
    if (restoredLayout !== layout.id) return;
    const saved: SavedPlanner = { markers, planName, sightLines, markupPaths };
    localStorage.setItem(`deployment-planner:v1:${layout.id}`, JSON.stringify(saved));
  }, [layout.id, markers, markupPaths, planName, restoredLayout, sightLines]);

  function pointFromEvent(event: PointerEvent) {
    const bounds = boardRef.current!.getBoundingClientRect();
    return {
      x: clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
      y: clamp((event.clientY - bounds.top) / bounds.height, 0, 1),
    };
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
    } else if (markupDrag.current !== null) {
      const point = pointFromEvent(event);
      setMarkupPaths((current) => current.map((path) => path.id === markupDrag.current ? {
        ...path,
        points: [...path.points, { x: point.x * TABLE_WIDTH, y: point.y * TABLE_HEIGHT }],
      } : path));
    } else if (measureDrag.current) {
      const point = pointFromEvent(event);
      setMeasurement((current) => current ? {
        ...current,
        end: { x: point.x * TABLE_WIDTH, y: point.y * TABLE_HEIGHT },
      } : current);
    }
  }

  function onBoardPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    if (markupEnabled) {
      event.currentTarget.setPointerCapture(event.pointerId);
      const point = pointFromEvent(event);
      const path: MarkupPath = {
        id: nextMarkupId.current++,
        color: markupColor,
        points: [{ x: point.x * TABLE_WIDTH, y: point.y * TABLE_HEIGHT }],
      };
      markupDrag.current = path.id;
      setMarkupPaths((current) => [...current, path]);
      return;
    }
    if (!measureEnabled) return;
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

  function addArmyUnit(unit: (typeof armyData.units)[number]) {
    const groupId = `manual-${unit.id}-${nextId.current}`;
    const columns = Math.min(3, unit.models);
    const spacing = Math.max(2.2, unit.baseMm / MM_PER_INCH + .65);
    const added = Array.from({ length: unit.models }, (_, index): BaseMarker => ({
      id: nextId.current++,
      x: clamp((18 + (index % columns) * spacing) / TABLE_WIDTH, .05, .95),
      y: clamp((38 + Math.floor(index / columns) * spacing) / TABLE_HEIGHT, .05, .95),
      widthMm: unit.baseMm,
      heightMm: unit.baseMm,
      label: unit.name,
      side,
      unitId: groupId,
      moveInches: unit.movementInches,
    }));
    setMarkers((current) => [...current, ...added]);
    setSelectedId(added[0].id);
  }

  function rotateSelected() {
    if (!selected || selected.widthMm === selected.heightMm) return;
    setMarkers((current) => current.map((marker) => marker.id === selected.id ? {
      ...marker,
      widthMm: marker.heightMm,
      heightMm: marker.widthMm,
    } : marker));
  }

  const loadPlan = useCallback((data: PlannerImport) => {
    if (data.schemaVersion !== 1 || !Array.isArray(data.markers)) throw new Error('Unsupported deployment-plan file.');
    if (data.layoutId !== layout.id) throw new Error(`This plan is for ${data.layoutId}, not ${layout.id}.`);
    const imported = data.markers.map((marker) => ({
      ...marker,
      x: marker.x / TABLE_WIDTH,
      y: marker.y / TABLE_HEIGHT,
    }));
    setMarkers(imported);
    nextId.current = Math.max(0, ...imported.map(({ id }) => id)) + 1;
    setSightLines(data.sightLines || []);
    setPlanName(data.name || 'Imported plan');
    setSelectedId(null);
    setImportError('');
  }, [layout.id]);

  const loadExample = useCallback(async () => {
    try {
      const response = await fetch(`${referenceRoot}/plans/necrons-take-take-${layout.layout.toLowerCase()}.json`);
      if (!response.ok) throw new Error('No bundled Necron plan exists for this layout.');
      loadPlan(await response.json());
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Could not load example plan.');
    }
  }, [layout.layout, loadPlan]);

  useEffect(() => {
    const hasSavedDeployment = localStorage.getItem(`deployment-planner:v1:${layout.id}`) !== null;
    const requestedDefault = searchParams.get('plan') === 'necrons';
    if ((requestedDefault || !hasSavedDeployment) && layout.id.startsWith('take-and-hold-vs-take-and-hold-')) {
      void loadExample();
    }
  }, [layout.id, loadExample, searchParams]);

  async function importPlan(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      loadPlan(JSON.parse(await file.text()));
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Could not import plan.');
    } finally {
      event.target.value = '';
    }
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
            <h2>Deployment plan</h2>
            {layout.id.startsWith('take-and-hold-vs-take-and-hold-') && (
              <button className="add-unit-button" onClick={loadExample}>Load default 1,995-point deployment</button>
            )}
            <button onClick={() => importRef.current?.click()}>Import planner JSON</button>
            <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={importPlan} />
            {planName && <p className="control-help"><strong>{planName}</strong><br />Placements and markup save automatically in this browser.</p>}
            {sightLines.length > 0 && <div className="sight-line-readout">
              {sightLines.map((line) => <div key={line.label} className={line.clear ? 'clear' : 'blocked'}>
                <strong>{line.clear ? 'VISIBLE' : 'BLOCKED'}</strong><span>{line.label}</span>
              </div>)}
            </div>}
            {importError && <p className="planner-import-error">{importError}</p>}
          </section>

          <section>
            <h2>Army list — {armyData.pointsLimit} pts</h2>
            <div className="side-toggle" aria-label="Base side">
              <button className={side === 'blue' ? 'active blue' : ''} onClick={() => setSide('blue')}>Blue</button>
              <button className={side === 'red' ? 'active red' : ''} onClick={() => setSide('red')}>Red</button>
            </div>
            <div className="army-roster">
              {armyData.units.map((unit) => (
                <div className="army-roster-unit" key={unit.id}>
                  <div><strong>{unit.name}</strong><span>{unit.models} model{unit.models === 1 ? '' : 's'} · {unit.points} pts · M {unit.movementInches}″</span></div>
                  <button onClick={() => addArmyUnit(unit)}>Add unit</button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2>Selected base</h2>
            <div className="selection-readout">
              {selected ? <><strong>{selected.label}</strong><span>{selected.moveInches ? `M ${selected.moveInches}″ · ` : ''}{selected.side} · drag to move</span></> : <span>Tap a base to select it.</span>}
            </div>
            {selected && markerCoherencyIssues.has(selected.id) && (
              <p className="coherency-error"><strong>OUT OF COHERENCY</strong><br />{markerCoherencyIssues.get(selected.id)?.join('; ')}</p>
            )}
            <button disabled={!selected || selected.widthMm === selected.heightMm} onClick={rotateSelected}>Rotate oval 90°</button>
            <button className="danger-button" disabled={!selected} onClick={removeSelected}>Remove selected</button>
            <button disabled={markers.length === 0} onClick={() => { setMarkers([]); setSelectedId(null); setSightLines([]); setPlanName(''); }}>Clear all</button>
          </section>

          <section>
            <h2>Map overlays</h2>
            <div className="overlay-control-label">Map interpretation</div>
            <button className={auditEnabled ? 'audit-toggle active' : 'audit-toggle'} onClick={() => setAuditEnabled((enabled) => !enabled)}>
              {auditEnabled ? 'Understanding shown' : 'Verify map understanding'}
            </button>
            <p className="control-help">Audits the exact deployment colours and sight-blocking terrain mask the planner reads from this official layout.</p>
            <div className="overlay-divider" />
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
            <div className="overlay-control-label">Movement range</div>
            <button
              className={movementEnabled ? 'movement-toggle active' : 'movement-toggle'}
              disabled={!selected?.moveInches}
              onClick={() => setMovementEnabled((enabled) => !enabled)}
            >
              {movementEnabled && selected?.moveInches ? `Show M ${selected.moveInches}″` : 'Show selected movement'}
            </button>
            <p className="control-help">Shows the selected model’s real Movement characteristic, measured from its current base position.</p>
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
            <div className="overlay-divider" />
            <div className="overlay-control-label">Deployment markup</div>
            <div className="markup-controls">
              <input aria-label="Markup colour" type="color" value={markupColor} onChange={(event) => setMarkupColor(event.target.value)} />
              <button className={markupEnabled ? 'markup-toggle active' : 'markup-toggle'} onClick={() => setMarkupEnabled((enabled) => !enabled)}>
                {markupEnabled ? 'Draw mode on' : 'Draw markup'}
              </button>
            </div>
            <button disabled={markupPaths.length === 0} onClick={() => setMarkupPaths((current) => current.slice(0, -1))}>Undo last stroke</button>
            <button className="danger-button" disabled={markupPaths.length === 0} onClick={() => setMarkupPaths([])}>Clear markup</button>
            <p className="control-help">Draw arrows, routes, zones, and notes directly on the deployment map. Strokes save automatically.</p>
          </section>
        </aside>

        <section className="battlefield-panel">
          <div className="battlefield-title">
            <strong>44″ × 60″ battlefield</strong>
            <span>{markers.length} base{markers.length === 1 ? '' : 's'} · {markerCoherencyIssues.size ? `${markerCoherencyIssues.size} out of coherency` : 'coherent'}</span>
          </div>
          <div
            ref={boardRef}
            className={`battlefield${visibilityEnabled ? ' visibility-active' : ''}${measureEnabled ? ' measure-active' : ''}${markupEnabled ? ' markup-active' : ''}`}
            onPointerDown={onBoardPointerDown}
            onPointerMove={onBoardPointerMove}
            onPointerUp={() => { dragId.current = null; measureDrag.current = false; markupDrag.current = null; }}
            onPointerCancel={() => { dragId.current = null; measureDrag.current = false; markupDrag.current = null; }}
          >
            <img src={`${referenceRoot}/maps/layout-${page}.jpg`} alt={`Map-only view of layout ${layout.layout}`} draggable={false} />
            {auditEnabled && (
              <MapAuditOverlay
                mapUrl={`${referenceRoot}/maps/layout-${page}.jpg`}
                terrainMaskUrl={`${referenceRoot}/terrain-masks/layout-${page}.png`}
              />
            )}
            {selected && movementEnabled && selected.moveInches && (
              <svg className="movement-overlay" viewBox={`0 0 ${TABLE_WIDTH} ${TABLE_HEIGHT}`} aria-label={`${selected.label} movement range`}>
                <ellipse
                  cx={selected.x * TABLE_WIDTH}
                  cy={selected.y * TABLE_HEIGHT}
                  rx={selected.moveInches + selected.widthMm / MM_PER_INCH / 2}
                  ry={selected.moveInches + selected.heightMm / MM_PER_INCH / 2}
                />
                <text x={selected.x * TABLE_WIDTH} y={selected.y * TABLE_HEIGHT - selected.moveInches - selected.heightMm / MM_PER_INCH / 2 - .5}>
                  M {selected.moveInches}″
                </text>
              </svg>
            )}
            {sightLines.length > 0 && (
              <svg className="sight-line-overlay" viewBox={`0 0 ${TABLE_WIDTH} ${TABLE_HEIGHT}`} aria-label="Checked sight lines">
                {sightLines.map((line, index) => (
                  <g key={`${line.label}-${index}`} className={line.clear ? 'clear' : 'blocked'}>
                    <line x1={line.from[0]} y1={line.from[1]} x2={line.to[0]} y2={line.to[1]} />
                    <circle cx={line.from[0]} cy={line.from[1]} r=".38" />
                    {line.blockedAt && <><line className="block-mark" x1={line.blockedAt[0] - .45} y1={line.blockedAt[1] - .45} x2={line.blockedAt[0] + .45} y2={line.blockedAt[1] + .45} /><line className="block-mark" x1={line.blockedAt[0] + .45} y1={line.blockedAt[1] - .45} x2={line.blockedAt[0] - .45} y2={line.blockedAt[1] + .45} /></>}
                    <title>{line.clear ? 'VISIBLE' : 'BLOCKED'} — {line.label}</title>
                  </g>
                ))}
              </svg>
            )}
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
            {markupPaths.length > 0 && (
              <svg className="markup-overlay" viewBox={`0 0 ${TABLE_WIDTH} ${TABLE_HEIGHT}`} aria-label="Deployment markup">
                {markupPaths.map((path) => (
                  <polyline
                    key={path.id}
                    points={path.points.map(({ x, y }) => `${x},${y}`).join(' ')}
                    stroke={path.color}
                  />
                ))}
              </svg>
            )}
            {markers.map((marker) => (
              <button
                type="button"
                key={marker.id}
                className={`base-marker ${marker.side}${selectedId === marker.id ? ' selected' : ''}${markerCoherencyIssues.has(marker.id) ? ' incoherent' : ''}`}
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
                <span>{marker.label}</span>
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
