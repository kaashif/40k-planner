'use client';

import Link from 'next/link';
import { ChangeEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import layoutsData from '../../public/reference/11th-edition/data/event-layouts.json';
import armyData from '../../armies/necrons-2000.json';
import deploymentPlans from '../../public/reference/11th-edition/plans/index.json';
import TerrainVisibility from './TerrainVisibility';
import MapAuditOverlay from './MapAuditOverlay';
import { coherencyIssues, coherencyMeasurements, constrainMove, MM_PER_INCH, placeUnitLabels, TABLE_HEIGHT, TABLE_WIDTH, type PlannerMarker } from './planner-utils';

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
  intent?: string;
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
  planIntent?: string;
  sightLines: SightLine[];
  markupPaths: MarkupPath[];
  side?: Side;
  visibilityEnabled?: boolean;
  screenEnabled?: boolean;
  screenSide?: Side;
  measureEnabled?: boolean;
  movementEnabled?: boolean;
  boundedMoveEnabled?: boolean;
  markupEnabled?: boolean;
  markupColor?: string;
  auditEnabled?: boolean;
  measurement?: null | { start: { x: number; y: number }; end: { x: number; y: number } };
  selectedIds?: number[];
  savedAt?: string;
};

function dimensions(widthMm: number, heightMm: number) {
  return widthMm === heightMm ? `${widthMm}mm` : `${widthMm}×${heightMm}mm`;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

export default function DeploymentPlanner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedId = searchParams.get('layout');
  const layout = layoutsData.layouts.find(({ id }) => id === requestedId) ?? layoutsData.layouts[0];
  const bundledPlan = deploymentPlans.plans.find(({ layoutId }) => layoutId === layout.id);
  const page = String(layout.pdfPage).padStart(2, '0');
  const boardRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);
  const nextMarkupId = useRef(1);
  const dragId = useRef<number | null>(null);
  const dragOrigin = useRef<{
    id: number;
    x: number;
    y: number;
    markers: Array<{ id: number; x: number; y: number; widthMm: number; heightMm: number; moveInches?: number }>;
  } | null>(null);
  const measureDrag = useRef(false);
  const markupDrag = useRef<number | null>(null);
  const boxDrag = useRef<null | { start: { x: number; y: number }; additive: boolean }>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const [markers, setMarkers] = useState<BaseMarker[]>([]);
  const [planName, setPlanName] = useState('');
  const [planIntent, setPlanIntent] = useState('');
  const [sightLines, setSightLines] = useState<SightLine[]>([]);
  const [importError, setImportError] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [side, setSide] = useState<Side>('blue');
  const [visibilityEnabled, setVisibilityEnabled] = useState(false);
  const [screenEnabled, setScreenEnabled] = useState(false);
  const [screenSide, setScreenSide] = useState<Side>('blue');
  const [measureEnabled, setMeasureEnabled] = useState(false);
  const [movementEnabled, setMovementEnabled] = useState(false);
  const [boundedMoveEnabled, setBoundedMoveEnabled] = useState(false);
  const [markupEnabled, setMarkupEnabled] = useState(false);
  const [markupColor, setMarkupColor] = useState('#ffe071');
  const [markupPaths, setMarkupPaths] = useState<MarkupPath[]>([]);
  const [auditEnabled, setAuditEnabled] = useState(false);
  const [restoredLayout, setRestoredLayout] = useState('');
  const [lastSavedAt, setLastSavedAt] = useState('');
  const [measurement, setMeasurement] = useState<null | {
    start: { x: number; y: number };
    end: { x: number; y: number };
  }>(null);
  const [liveMove, setLiveMove] = useState<null | {
    start: { x: number; y: number };
    end: { x: number; y: number };
    distance: number;
    maximum: number;
  }>(null);
  const [selectionBox, setSelectionBox] = useState<null | {
    start: { x: number; y: number };
    end: { x: number; y: number };
  }>(null);

  const selectedId = selectedIds.at(-1) ?? null;
  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selected = markers.find(({ id }) => id === selectedId) ?? null;
  const markerCoherencyIssues = useMemo(() => coherencyIssues(markers), [markers]);
  const coherencyLines = useMemo(() => coherencyMeasurements(markers), [markers]);
  const unitLabels = useMemo(() => placeUnitLabels(markers), [markers]);

  useEffect(() => {
    setRestoredLayout('');
    const storageKey = `deployment-planner:v2:${layout.id}`;
    try {
      const primary = localStorage.getItem(storageKey);
      const backup = localStorage.getItem(`${storageKey}:backup`);
      let data: SavedPlanner | null = null;
      let restoredBackup = false;
      for (const [raw, isBackup] of [[primary, false], [backup, true]] as const) {
        if (!raw) continue;
        try {
          data = JSON.parse(raw) as SavedPlanner;
          restoredBackup = isBackup;
          break;
        } catch {
          // Try the rolling backup before giving up on this layout.
        }
      }
      if (data) {
        setMarkers(Array.isArray(data.markers) ? data.markers : []);
        setPlanName(data.planName || 'Saved deployment');
        setPlanIntent(data.planIntent || '');
        setSightLines(Array.isArray(data.sightLines) ? data.sightLines : []);
        setMarkupPaths(Array.isArray(data.markupPaths) ? data.markupPaths : []);
        nextId.current = Math.max(0, ...(data.markers || []).map(({ id }) => id)) + 1;
        nextMarkupId.current = Math.max(0, ...(data.markupPaths || []).map(({ id }) => id)) + 1;
        if (data.side) setSide(data.side);
        if (typeof data.visibilityEnabled === 'boolean') setVisibilityEnabled(data.visibilityEnabled);
        if (typeof data.screenEnabled === 'boolean') setScreenEnabled(data.screenEnabled);
        if (data.screenSide) setScreenSide(data.screenSide);
        if (typeof data.measureEnabled === 'boolean') setMeasureEnabled(data.measureEnabled);
        if (typeof data.movementEnabled === 'boolean') setMovementEnabled(data.movementEnabled);
        if (typeof data.boundedMoveEnabled === 'boolean') setBoundedMoveEnabled(data.boundedMoveEnabled);
        if (typeof data.markupEnabled === 'boolean') setMarkupEnabled(data.markupEnabled);
        if (data.markupColor) setMarkupColor(data.markupColor);
        if (typeof data.auditEnabled === 'boolean') setAuditEnabled(data.auditEnabled);
        if (data.measurement) setMeasurement(data.measurement);
        setSelectedIds(Array.isArray(data.selectedIds) ? data.selectedIds.filter((id) => data.markers.some((marker) => marker.id === id)) : []);
        setLastSavedAt(restoredBackup ? 'restored' : data.savedAt || 'restored');
      } else {
        setMarkers([]);
        setPlanName('');
        setPlanIntent('');
        setSightLines([]);
        setMarkupPaths([]);
        setSelectedIds([]);
        nextId.current = 1;
        nextMarkupId.current = 1;
      }
    } catch {
      localStorage.removeItem(storageKey);
    }
    setRestoredLayout(layout.id);
  }, [layout.id]);

  useEffect(() => {
    if (restoredLayout !== layout.id) return;
    const storageKey = `deployment-planner:v2:${layout.id}`;
    const savedAt = new Date().toISOString();
    const saved: SavedPlanner = {
      markers, planName, planIntent, sightLines, markupPaths, side, visibilityEnabled, screenEnabled,
      screenSide, measureEnabled, movementEnabled, boundedMoveEnabled, markupEnabled, markupColor, auditEnabled,
      measurement, selectedIds, savedAt,
    };
    const serialized = JSON.stringify(saved);
    const previous = localStorage.getItem(storageKey);
    if (previous && previous !== serialized) localStorage.setItem(`${storageKey}:backup`, previous);
    localStorage.setItem(storageKey, serialized);
    setLastSavedAt(savedAt);
  }, [auditEnabled, boundedMoveEnabled, layout.id, markers, markupColor, markupEnabled, markupPaths, measureEnabled, measurement, movementEnabled, planIntent, planName, restoredLayout, screenEnabled, screenSide, selectedIds, side, sightLines, visibilityEnabled]);

  function pointFromEvent(event: PointerEvent) {
    const bounds = boardRef.current!.getBoundingClientRect();
    return {
      x: clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
      y: clamp((event.clientY - bounds.top) / bounds.height, 0, 1),
    };
  }

  function moveMarker(id: number, point: { x: number; y: number }) {
    const marker = markers.find((candidate) => candidate.id === id);
    const origin = dragOrigin.current;
    if (!marker || !origin || origin.id !== id) return;
    let destination = point;
    const movementValues = origin.markers.map(({ moveInches }) => moveInches).filter((value): value is number => Boolean(value));
    const maximum = movementValues.length === origin.markers.length ? Math.min(...movementValues) : marker.moveInches;
    if (boundedMoveEnabled && maximum) {
      destination = constrainMove(origin, point, maximum);
    }
    let dx = destination.x - origin.x;
    let dy = destination.y - origin.y;
    for (const member of origin.markers) {
      const radiusX = member.widthMm / MM_PER_INCH / TABLE_WIDTH / 2;
      const radiusY = member.heightMm / MM_PER_INCH / TABLE_HEIGHT / 2;
      dx = clamp(dx, radiusX - member.x, 1 - radiusX - member.x);
      dy = clamp(dy, radiusY - member.y, 1 - radiusY - member.y);
    }
    const origins = new Map(origin.markers.map((member) => [member.id, member]));
    setMarkers((current) => current.map((candidate) => {
      const member = origins.get(candidate.id);
      return member ? { ...candidate, x: member.x + dx, y: member.y + dy } : candidate;
    }));
    if (boundedMoveEnabled && maximum) {
      const start = { x: origin.x * TABLE_WIDTH, y: origin.y * TABLE_HEIGHT };
      const end = { x: (origin.x + dx) * TABLE_WIDTH, y: (origin.y + dy) * TABLE_HEIGHT };
      setLiveMove({ start, end, distance: Math.hypot(end.x - start.x, end.y - start.y), maximum });
    }
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
    } else if (boxDrag.current) {
      setSelectionBox({ start: boxDrag.current.start, end: pointFromEvent(event) });
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
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = pointFromEvent(event);
    if (measureEnabled) {
      measureDrag.current = true;
      const tablePoint = { x: point.x * TABLE_WIDTH, y: point.y * TABLE_HEIGHT };
      setMeasurement({ start: tablePoint, end: tablePoint });
      return;
    }
    boxDrag.current = { start: point, additive: event.metaKey || event.ctrlKey };
    setSelectionBox({ start: point, end: point });
  }

  function finishBoardPointer() {
    if (selectionBox && boxDrag.current) {
      const left = Math.min(selectionBox.start.x, selectionBox.end.x);
      const right = Math.max(selectionBox.start.x, selectionBox.end.x);
      const top = Math.min(selectionBox.start.y, selectionBox.end.y);
      const bottom = Math.max(selectionBox.start.y, selectionBox.end.y);
      const boxed = markers.filter(({ x, y }) => x >= left && x <= right && y >= top && y <= bottom).map(({ id }) => id);
      const additive = boxDrag.current.additive;
      setSelectedIds((current) => additive ? [...new Set([...current, ...boxed])] : boxed);
    }
    dragId.current = null;
    dragOrigin.current = null;
    measureDrag.current = false;
    markupDrag.current = null;
    boxDrag.current = null;
    setSelectionBox(null);
    setLiveMove(null);
  }

  function removeSelected() {
    if (selectedIds.length === 0) return;
    const removed = new Set(selectedIds);
    setMarkers((current) => current.filter(({ id }) => !removed.has(id)));
    setSelectedIds([]);
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
    setSelectedIds(added.map(({ id }) => id));
  }

  function rotateSelected() {
    const selectedSet = new Set(selectedIds);
    if (!selected || selectedIds.length === 0) return;
    setMarkers((current) => current.map((marker) => selectedSet.has(marker.id) && marker.widthMm !== marker.heightMm ? {
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
    setPlanIntent(data.intent || '');
    setSelectedIds([]);
    setImportError('');
  }, [layout.id]);

  const loadExample = useCallback(async () => {
    try {
      if (!bundledPlan) throw new Error('No bundled Necron plan exists for this layout.');
      const response = await fetch(`${referenceRoot}/plans/${bundledPlan.file}`);
      if (!response.ok) throw new Error('Could not load the bundled deployment.');
      loadPlan(await response.json());
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Could not load example plan.');
    }
  }, [bundledPlan, loadPlan]);

  useEffect(() => {
    const hasSavedDeployment = localStorage.getItem(`deployment-planner:v2:${layout.id}`) !== null;
    if (!hasSavedDeployment && bundledPlan) {
      void loadExample();
    }
  }, [bundledPlan, layout.id, loadExample]);

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
      <div className="planner-workspace">
        <nav className="planner-controls" aria-label="Deployment planner controls">
          <Link className="planner-back-link" href="/">← Missions</Link>
          <label className="matchup-selector">
            <span>Matchup</span>
            <select value={layout.id} onChange={(event) => router.push(`/planner/?layout=${event.target.value}`)}>
              {layoutsData.layouts.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.attacker.forceDisposition} vs {option.defender.forceDisposition} · {option.layout}
                </option>
              ))}
            </select>
          </label>

          <details className="tool-menu" name="planner-tools">
            <summary>Deployment</summary>
            <section className="tool-menu-body">
            {bundledPlan && (
              <button className="add-unit-button" onClick={loadExample}>Load default 1,995-point deployment</button>
            )}
            <Link className="plan-library-link" href="/plans/">View all deployment plans</Link>
            <button onClick={() => importRef.current?.click()}>Import planner JSON</button>
            <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={importPlan} />
            {planName && <p className="control-help"><strong>{planName}</strong><br />Placements and markup save automatically in this browser.</p>}
            {planIntent && <p className="plan-intent">{planIntent}</p>}
            {lastSavedAt && <p className="local-save-status">Saved locally · {lastSavedAt === 'restored' ? 'restored backup' : new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>}
            {sightLines.length > 0 && <div className="sight-line-readout">
              {sightLines.map((line) => <div key={line.label} className={line.clear ? 'clear' : 'blocked'}>
                <strong>{line.clear ? 'VISIBLE' : 'BLOCKED'}</strong><span>{line.label}</span>
              </div>)}
            </div>}
            {importError && <p className="planner-import-error">{importError}</p>}
            </section>
          </details>

          <details className="tool-menu" name="planner-tools">
            <summary>Army · {armyData.pointsLimit} pts</summary>
            <section className="tool-menu-body">
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
          </details>

          <details className="tool-menu" name="planner-tools">
            <summary>{selectedIds.length > 1 ? `${selectedIds.length} selected` : selected ? selected.label : 'Selection'}</summary>
            <section className="tool-menu-body">
            <div className="selection-readout">
              {selected ? <><strong>{selectedIds.length > 1 ? `${selectedIds.length} models selected` : selected.label}</strong><span>{selected.moveInches ? `M ${selected.moveInches}″ · ` : ''}drag any selected model to move the group</span></> : <span>Click a model, unit label, or drag a selection box. Ctrl/Cmd-click adds or removes models.</span>}
            </div>
            {selected && markerCoherencyIssues.has(selected.id) && (
              <p className="coherency-error"><strong>OUT OF COHERENCY</strong><br />{markerCoherencyIssues.get(selected.id)?.join('; ')}</p>
            )}
            <button disabled={!markers.some((marker) => selectedIdSet.has(marker.id) && marker.widthMm !== marker.heightMm)} onClick={rotateSelected}>Rotate selected ovals 90°</button>
            <button className="danger-button" disabled={selectedIds.length === 0} onClick={removeSelected}>Remove selected</button>
            <button disabled={markers.length === 0} onClick={() => { setMarkers([]); setSelectedIds([]); setSightLines([]); setPlanName(''); setPlanIntent(''); }}>Clear all</button>
            </section>
          </details>

          <details className="tool-menu tool-menu-map" name="planner-tools">
            <summary>Tools &amp; modes</summary>
            <section className="tool-menu-body">
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
            <button
              className={boundedMoveEnabled ? 'bounded-move-toggle active' : 'bounded-move-toggle'}
              onClick={() => setBoundedMoveEnabled((enabled) => !enabled)}
            >
              {boundedMoveEnabled ? 'Movement-locked drag on' : 'Lock drag to Movement'}
            </button>
            <p className="control-help">Caps each drag at that model’s Movement characteristic and measures the move live.</p>
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
          </details>

          <span className={`planner-status${markerCoherencyIssues.size ? ' warning' : ''}`}>
            {markers.length} models · {markerCoherencyIssues.size ? `${markerCoherencyIssues.size} incoherent` : 'coherent'}
          </span>
          <a className="planner-source-link" href={`${referenceRoot}/official/event-companion.pdf#page=${layout.pdfPage}`} target="_blank">
            PDF p.{layout.pdfPage} ↗
          </a>
        </nav>

        <section className="battlefield-panel">
          <div
            ref={boardRef}
            className={`battlefield${visibilityEnabled ? ' visibility-active' : ''}${measureEnabled ? ' measure-active' : ''}${markupEnabled ? ' markup-active' : ''}`}
            onPointerDown={onBoardPointerDown}
            onPointerMove={onBoardPointerMove}
            onPointerUp={finishBoardPointer}
            onPointerCancel={finishBoardPointer}
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
            {coherencyLines.length > 0 && (
              <svg className="coherency-overlay" viewBox={`0 0 ${TABLE_WIDTH} ${TABLE_HEIGHT}`} aria-label="Failed coherency measurements">
                {coherencyLines.map((line) => {
                  const x1 = line.from.x * TABLE_WIDTH;
                  const y1 = line.from.y * TABLE_HEIGHT;
                  const x2 = line.to.x * TABLE_WIDTH;
                  const y2 = line.to.y * TABLE_HEIGHT;
                  return <g key={line.key} className={`limit-${line.limit}`}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} />
                    <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - .4}>{line.distance.toFixed(1)}″ &gt; {line.limit}″</text>
                  </g>;
                })}
              </svg>
            )}
            {selectionBox && (
              <div
                className="selection-box"
                style={{
                  left: `${Math.min(selectionBox.start.x, selectionBox.end.x) * 100}%`,
                  top: `${Math.min(selectionBox.start.y, selectionBox.end.y) * 100}%`,
                  width: `${Math.abs(selectionBox.end.x - selectionBox.start.x) * 100}%`,
                  height: `${Math.abs(selectionBox.end.y - selectionBox.start.y) * 100}%`,
                }}
              />
            )}
            {markers.map((marker) => (
              <button
                type="button"
                key={marker.id}
                className={`base-marker ${marker.side}${selectedIdSet.has(marker.id) ? ' selected' : ''}${markerCoherencyIssues.has(marker.id) ? ' incoherent' : ''}`}
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
                  const additive = event.metaKey || event.ctrlKey;
                  let nextSelection: number[];
                  if (additive && selectedIdSet.has(marker.id)) {
                    nextSelection = selectedIds.filter((id) => id !== marker.id);
                  } else if (additive) {
                    nextSelection = [...selectedIds, marker.id];
                  } else if (selectedIdSet.has(marker.id)) {
                    nextSelection = [...selectedIds.filter((id) => id !== marker.id), marker.id];
                  } else {
                    nextSelection = [marker.id];
                  }
                  setSelectedIds(nextSelection);
                  if (!nextSelection.includes(marker.id)) return;
                  const group = markers.filter(({ id }) => nextSelection.includes(id));
                  dragId.current = marker.id;
                  dragOrigin.current = {
                    id: marker.id,
                    x: marker.x,
                    y: marker.y,
                    markers: group.map(({ id, x, y, widthMm, heightMm, moveInches }) => ({ id, x, y, widthMm, heightMm, moveInches })),
                  };
                  setLiveMove(null);
                }}
                onPointerMove={(event) => {
                  if (dragId.current === marker.id) moveMarker(marker.id, pointFromEvent(event));
                }}
                onPointerUp={() => { dragId.current = null; dragOrigin.current = null; setLiveMove(null); }}
              />
            ))}
            {unitLabels.map((label) => (
              <button
                type="button"
                key={label.key}
                className={`unit-name-label ${label.side}${label.markerIds.every((id) => selectedIdSet.has(id)) ? ' selected' : ''}`}
                style={{ left: `${label.x * 100}%`, top: `${label.y * 100}%` }}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  const allSelected = label.markerIds.every((id) => selectedIdSet.has(id));
                  if (event.metaKey || event.ctrlKey) {
                    setSelectedIds((current) => allSelected
                      ? current.filter((id) => !label.markerIds.includes(id))
                      : [...new Set([...current, ...label.markerIds])]);
                  } else {
                    setSelectedIds(label.markerIds);
                  }
                }}
              >
                {label.label}
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
            {liveMove && (
              <svg className="bounded-move-overlay" viewBox={`0 0 ${TABLE_WIDTH} ${TABLE_HEIGHT}`} aria-label="Live movement measurement">
                <line x1={liveMove.start.x} y1={liveMove.start.y} x2={liveMove.end.x} y2={liveMove.end.y} />
                <circle cx={liveMove.start.x} cy={liveMove.start.y} r=".32" />
                <text x={(liveMove.start.x + liveMove.end.x) / 2} y={(liveMove.start.y + liveMove.end.y) / 2 - .6}>
                  {liveMove.distance.toFixed(1)}″ / {liveMove.maximum}″
                </text>
              </svg>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
