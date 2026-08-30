'use client';

import Link from 'next/link';
import { ChangeEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import layoutsData from '../../public/reference/11th-edition/data/event-layouts.json';
import armyData from '../../armies/necrons-2000.json';
import deploymentPlans from '../../public/reference/11th-edition/plans/index.json';
import TerrainVisibility from './TerrainVisibility';
import MapAuditOverlay from './MapAuditOverlay';
import InfiltrateOverlay from './InfiltrateOverlay';
import { coherencyIssues, coherencyMeasurements, constrainMove, MM_PER_INCH, moveSelectedUnitsToDeepStrike, placeUnitLabels, TABLE_HEIGHT, TABLE_WIDTH, type PlannerMarker } from './planner-utils';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
const referenceRoot = `${basePath}/reference/11th-edition`;
const dispositions = [...new Set(layoutsData.layouts.flatMap((layout) => [layout.attacker.forceDisposition, layout.defender.forceDisposition]))];

function dispositionId(value: string) {
  return value.toLowerCase().replaceAll(' ', '-');
}

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
  deepStrikeMarkers?: Array<Omit<BaseMarker, 'x' | 'y'> & { x: number; y: number }>;
  sightLines?: SightLine[];
};

type MarkupPath = {
  id: number;
  color: string;
  points: Array<{ x: number; y: number }>;
};

type SavedPlanner = {
  markers: BaseMarker[];
  deepStrikeMarkers?: BaseMarker[];
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
  infiltrateEnabled?: boolean;
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

function armyUnitIdForMarker(marker: BaseMarker) {
  return armyData.units.find((unit) => marker.unitId === unit.id || marker.unitId?.startsWith(`manual-${unit.id}-`))?.id;
}

export default function DeploymentPlanner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedId = searchParams.get('layout');
  const layout = layoutsData.layouts.find(({ id }) => id === requestedId) ?? layoutsData.layouts[0];
  const requestedFirst = dispositions.find((name) => dispositionId(name) === searchParams.get('first'));
  const requestedSecond = dispositions.find((name) => dispositionId(name) === searchParams.get('second'));
  const firstDisposition = requestedFirst ?? layout.attacker.forceDisposition;
  const secondDisposition = requestedSecond ?? layout.defender.forceDisposition;
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
  const [deepStrikeMarkers, setDeepStrikeMarkers] = useState<BaseMarker[]>([]);
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
  const [infiltrateEnabled, setInfiltrateEnabled] = useState(false);
  const [suggestionVisible, setSuggestionVisible] = useState(true);
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
  const unitLabels = useMemo(() => placeUnitLabels(suggestionVisible ? markers : []), [markers, suggestionVisible]);
  const accountedByArmyUnit = useMemo(() => {
    const counts = new Map<string, number>();
    for (const marker of [...markers, ...deepStrikeMarkers]) {
      const armyUnitId = armyUnitIdForMarker(marker);
      if (armyUnitId) counts.set(armyUnitId, (counts.get(armyUnitId) ?? 0) + 1);
    }
    return counts;
  }, [deepStrikeMarkers, markers]);
  const unplacedModels = useMemo(() => armyData.units.reduce((total, unit) => total + Math.max(0, unit.models - (accountedByArmyUnit.get(unit.id) ?? 0)), 0), [accountedByArmyUnit]);

  function navigateMatchup(first: string, second: string, letter: string) {
    const match = layoutsData.layouts.find((candidate) => candidate.layout === letter && (
      (candidate.attacker.forceDisposition === first && candidate.defender.forceDisposition === second)
      || (candidate.attacker.forceDisposition === second && candidate.defender.forceDisposition === first)
    ));
    if (match) router.push(`/planner/?layout=${match.id}&first=${dispositionId(first)}&second=${dispositionId(second)}`);
  }

  useEffect(() => {
    setRestoredLayout('');
    setSuggestionVisible(true);
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
        setDeepStrikeMarkers(Array.isArray(data.deepStrikeMarkers) ? data.deepStrikeMarkers : []);
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
        if (typeof data.infiltrateEnabled === 'boolean') setInfiltrateEnabled(data.infiltrateEnabled);
        if (data.measurement) setMeasurement(data.measurement);
        setSelectedIds(Array.isArray(data.selectedIds) ? data.selectedIds.filter((id) => data.markers.some((marker) => marker.id === id)) : []);
        setLastSavedAt(restoredBackup ? 'restored' : data.savedAt || 'restored');
      } else {
        setMarkers([]);
        setDeepStrikeMarkers([]);
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
      markers, deepStrikeMarkers, planName, planIntent, sightLines, markupPaths, side, visibilityEnabled, screenEnabled,
      screenSide, measureEnabled, movementEnabled, boundedMoveEnabled, markupEnabled, markupColor, auditEnabled, infiltrateEnabled,
      measurement, selectedIds, savedAt,
    };
    const serialized = JSON.stringify(saved);
    const previous = localStorage.getItem(storageKey);
    if (previous && previous !== serialized) localStorage.setItem(`${storageKey}:backup`, previous);
    localStorage.setItem(storageKey, serialized);
    setLastSavedAt(savedAt);
  }, [auditEnabled, boundedMoveEnabled, deepStrikeMarkers, infiltrateEnabled, layout.id, markers, markupColor, markupEnabled, markupPaths, measureEnabled, measurement, movementEnabled, planIntent, planName, restoredLayout, screenEnabled, screenSide, selectedIds, side, sightLines, visibilityEnabled]);

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

  function markSelectedDeepStrike() {
    const result = moveSelectedUnitsToDeepStrike(markers, deepStrikeMarkers, selectedIds);
    setMarkers(result.markers);
    setDeepStrikeMarkers(result.deepStrikeMarkers);
    setSelectedIds([]);
  }

  function returnDeepStrike() {
    if (deepStrikeMarkers.length === 0) return;
    setMarkers((current) => [...current, ...deepStrikeMarkers]);
    setSelectedIds(deepStrikeMarkers.map(({ id }) => id));
    setDeepStrikeMarkers([]);
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
    const importedDeepStrike = (data.deepStrikeMarkers || []).map((marker) => ({
      ...marker,
      x: marker.x / TABLE_WIDTH,
      y: marker.y / TABLE_HEIGHT,
    }));
    setMarkers(imported);
    setDeepStrikeMarkers(importedDeepStrike);
    nextId.current = Math.max(0, ...imported.map(({ id }) => id), ...importedDeepStrike.map(({ id }) => id)) + 1;
    setSightLines(data.sightLines || []);
    setPlanName(data.name || 'Imported plan');
    setPlanIntent(data.intent || '');
    setSelectedIds([]);
    setSuggestionVisible(true);
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
    if ((searchParams.get('suggestion') === '1' || !hasSavedDeployment) && bundledPlan) {
      void loadExample();
    }
  }, [bundledPlan, layout.id, loadExample, searchParams]);

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
          <div className="planner-context-row">
            <Link className="planner-back-link" href="/">← Missions</Link>
            <label className="matchup-selector">
              <span>First objective</span>
              <select value={firstDisposition} onChange={(event) => navigateMatchup(event.target.value, secondDisposition, layout.layout)}>
                {dispositions.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <span className="matchup-versus">vs</span>
            <label className="matchup-selector">
              <span>Second objective</span>
              <select value={secondDisposition} onChange={(event) => navigateMatchup(firstDisposition, event.target.value, layout.layout)}>
                {dispositions.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </label>
            <label className="layout-selector">
              <span>Layout</span>
              <select value={layout.layout} onChange={(event) => navigateMatchup(firstDisposition, secondDisposition, event.target.value)}>
                {['A', 'B', 'C'].map((letter) => <option key={letter} value={letter}>{letter}</option>)}
              </select>
            </label>
            {planName && <span className="toolbar-note" title={planIntent || 'Saved automatically in this browser.'}>{planName}</span>}
            {lastSavedAt && <span className="local-save-status">Saved {lastSavedAt === 'restored' ? 'backup' : new Date(lastSavedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
            {importError && <span className="planner-import-error">{importError}</span>}
            {unplacedModels > 0 && <span className="army-warning">⚠ {unplacedModels} army model{unplacedModels === 1 ? '' : 's'} not placed</span>}
            {deepStrikeMarkers.length > 0 && <span className="deep-strike-status">{deepStrikeMarkers.length} in deep strike</span>}
            <span className={`planner-status${markerCoherencyIssues.size ? ' warning' : ''}`}>
              {markers.length} models · {markerCoherencyIssues.size ? `${markerCoherencyIssues.size} incoherent` : 'coherent'}
            </span>
            <a className="planner-source-link" href={`${referenceRoot}/current-layout-reference.pdf#page=${layout.pdfPage - 7}`} target="_blank">Current PDF ↗</a>
          </div>

          <div className="planner-toolstrip" aria-label="Planner tools">
            {bundledPlan && <button onClick={loadExample} title="Replace the board with the bundled suggested deployment">Load suggestion</button>}
            {bundledPlan && planName && <button className={suggestionVisible ? 'suggestion-toggle active' : 'suggestion-toggle'} aria-pressed={suggestionVisible} onClick={() => { setSuggestionVisible((visible) => !visible); setSelectedIds([]); }} title="Show or hide the suggested deployment without deleting it">{suggestionVisible ? 'Hide suggestion' : 'Show suggestion'}</button>}
            <Link className="toolbar-link" href="/plans/" title="View every saved deployment plan">All plans</Link>
            <button onClick={() => importRef.current?.click()} title="Import a planner JSON file">Import</button>
            <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={importPlan} />
            <span className="toolstrip-divider" />
            <span className="selection-chip" title={selected ? `${selected.moveInches ? `M ${selected.moveInches}″ · ` : ''}drag any selected model to move the group` : 'Click a model, unit label, or drag a box; Ctrl/Cmd-click toggles models'}>
              {selectedIds.length > 1 ? `${selectedIds.length} selected` : selected ? selected.label : 'No selection'}
            </span>
            <button disabled={!markers.some((marker) => selectedIdSet.has(marker.id) && marker.widthMm !== marker.heightMm)} onClick={rotateSelected} title="Rotate selected oval bases 90°">Rotate</button>
            <button className="danger-button" disabled={selectedIds.length === 0} onClick={removeSelected} title="Remove selected models">Remove</button>
            <button className="deep-strike-toggle" disabled={selectedIds.length === 0} onClick={markSelectedDeepStrike} title="Move every model in the selected unit or units into deep strike">Deep strike</button>
            <button disabled={deepStrikeMarkers.length === 0} onClick={returnDeepStrike} title="Return all deep-strike units to their previous positions">Return DS</button>
            <button disabled={markers.length === 0} onClick={() => { setMarkers([]); setSelectedIds([]); setSightLines([]); setPlanName(''); setPlanIntent(''); }} title="Remove every model">Clear models</button>
            <span className="toolstrip-divider" />
            <button className={auditEnabled ? 'audit-toggle active' : 'audit-toggle'} onClick={() => setAuditEnabled((enabled) => !enabled)} title="Show the deployment zones and sight-blocking geometry the planner reads">Map check</button>
            <button className={infiltrateEnabled ? 'infiltrate-toggle active' : 'infiltrate-toggle'} onClick={() => setInfiltrateEnabled((enabled) => !enabled)} title={`Show every position within 8″ of the opponent's ${side === 'blue' ? 'red' : 'blue'} deployment zone`}>Infiltrate 8″</button>
            <button className={visibilityEnabled ? 'los-toggle active' : 'los-toggle'} disabled={!selected} onClick={() => setVisibilityEnabled((enabled) => !enabled)} title="Show positions visible from the selected base">Visibility</button>
            <button className={movementEnabled ? 'movement-toggle active' : 'movement-toggle'} disabled={!selected?.moveInches} onClick={() => setMovementEnabled((enabled) => !enabled)} title="Show the selected model's real Movement range">Move range{movementEnabled && selected?.moveInches ? ` ${selected.moveInches}″` : ''}</button>
            <button className={boundedMoveEnabled ? 'bounded-move-toggle active' : 'bounded-move-toggle'} onClick={() => setBoundedMoveEnabled((enabled) => !enabled)} title="Limit dragging to the model's Movement characteristic and measure it live">Move lock</button>
            <span className="screen-side-toggle" aria-label="Deep-strike screening side">
              <button className={screenSide === 'blue' ? 'active blue' : ''} onClick={() => setScreenSide('blue')} title="Use blue models for screening">B</button>
              <button className={screenSide === 'red' ? 'active red' : ''} onClick={() => setScreenSide('red')} title="Use red models for screening">R</button>
            </span>
            <button className={screenEnabled ? 'screen-toggle active' : 'screen-toggle'} onClick={() => setScreenEnabled((enabled) => !enabled)} title={`Show the area where enemy deep strike is denied by ${screenSide} models, measured 8″ from their base edges`}>Deep strike 8″</button>
            <button className={measureEnabled ? 'measure-toggle active' : 'measure-toggle'} onClick={() => setMeasureEnabled((enabled) => !enabled)} title="Drag between any two points to measure distance">Ruler</button>
            <input className="toolbar-colour" aria-label="Markup colour" title="Markup colour" type="color" value={markupColor} onChange={(event) => setMarkupColor(event.target.value)} />
            <button className={markupEnabled ? 'markup-toggle active' : 'markup-toggle'} onClick={() => setMarkupEnabled((enabled) => !enabled)} title="Draw routes, zones, and notes on the map">Draw</button>
            <button disabled={markupPaths.length === 0} onClick={() => setMarkupPaths((current) => current.slice(0, -1))} title="Undo the last markup stroke">Undo ink</button>
            <button className="danger-button" disabled={markupPaths.length === 0} onClick={() => setMarkupPaths([])} title="Clear all markup">Clear ink</button>
            {selected && markerCoherencyIssues.has(selected.id) && <span className="coherency-chip" title={markerCoherencyIssues.get(selected.id)?.join('; ')}>Out of coherency</span>}
            {sightLines.length > 0 && <span className="sight-line-chip" title={sightLines.map((line) => `${line.clear ? 'Visible' : 'Blocked'}: ${line.label}`).join('\n')}>
              {sightLines.filter((line) => line.clear).length} visible · {sightLines.filter((line) => !line.clear).length} blocked
            </span>}
          </div>
        </nav>

        <div className="planner-main-row">
          <aside className="army-sidebar">
            <div className="army-sidebar-title"><strong>Army list</strong><span>{armyData.pointsLimit} pts</span></div>
            <div className="side-toggle" aria-label="Base side">
              <button className={side === 'blue' ? 'active blue' : ''} onClick={() => setSide('blue')}>Blue</button>
              <button className={side === 'red' ? 'active red' : ''} onClick={() => setSide('red')}>Red</button>
            </div>
            <div className="army-roster">
              {armyData.units.map((unit) => (
                <div className="army-roster-unit" key={unit.id}>
                  <div><strong>{unit.name}</strong><span>{accountedByArmyUnit.get(unit.id) ?? 0}/{unit.models} placed/DS · {unit.points} pts · M {unit.movementInches}″</span></div>
                  <button disabled={(accountedByArmyUnit.get(unit.id) ?? 0) >= unit.models} onClick={() => addArmyUnit(unit)}>Add</button>
                </div>
              ))}
            </div>
            {deepStrikeMarkers.length > 0 && <div className="deep-strike-list">
              <strong>Deep strike</strong>
              {[...new Set(deepStrikeMarkers.map(({ label }) => label))].map((label) => <span key={label}>{label}</span>)}
            </div>}
          </aside>

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
            {infiltrateEnabled && <InfiltrateOverlay mapUrl={`${referenceRoot}/maps/layout-${page}.jpg`} playerSide={side} />}
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
            {suggestionVisible && sightLines.length > 0 && (
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
            {suggestionVisible && screenEnabled && (
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
            {suggestionVisible && coherencyLines.length > 0 && (
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
            {suggestionVisible && markers.map((marker) => (
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
      </div>
    </main>
  );
}
