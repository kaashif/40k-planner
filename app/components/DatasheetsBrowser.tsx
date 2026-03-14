'use client';

import { useState, useEffect } from 'react';

interface Faction {
  slug: string;
  name: string;
}

interface UnitStats {
  name: string;
  M: string;
  T: string;
  SV: string;
  W: string;
  LD: string;
  OC: string;
}

interface RangedWeapon {
  name: string;
  range: string;
  A: string;
  BS: string;
  S: string;
  AP: string;
  D: string;
  keywords: string;
}

interface MeleeWeapon {
  name: string;
  range: string;
  A: string;
  WS: string;
  S: string;
  AP: string;
  D: string;
  keywords: string;
}

interface Ability {
  name: string;
  description: string;
}

interface Unit {
  name: string;
  points: number;
  keywords: string[];
  stats: UnitStats[];
  rangedWeapons: RangedWeapon[];
  meleeWeapons: MeleeWeapon[];
  abilities: Ability[];
}

interface CatalogueData {
  name: string;
  library: boolean;
  unitCount: number;
  units: Unit[];
}

export default function DatasheetsBrowser() {
  const [factions, setFactions] = useState<Faction[]>([]);
  const [selectedFaction, setSelectedFaction] = useState<string>('chaos-thousand-sons');
  const [catalogue, setCatalogue] = useState<CatalogueData | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedUnit, setExpandedUnit] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/datasheets')
      .then(r => r.json())
      .then(setFactions)
      .catch(console.error);
    handleFactionChange('chaos-thousand-sons');
  }, []);

  const handleFactionChange = async (slug: string) => {
    setSelectedFaction(slug);
    setExpandedUnit(null);
    setSearch('');
    if (!slug) {
      setCatalogue(null);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`/api/datasheets/${slug}`);
      const data = await r.json();
      setCatalogue(data);
    } catch (err) {
      console.error(err);
      setCatalogue(null);
    } finally {
      setLoading(false);
    }
  };

  const filteredUnits = catalogue?.units.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-[#C5A33E]">Datasheets Browser</h2>

      <div className="flex gap-4 items-center flex-wrap">
        <select
          value={selectedFaction}
          onChange={e => handleFactionChange(e.target.value)}
          className="px-3 py-2 bg-[#14142a] text-gray-200 border border-[#1a1a2e] rounded-lg focus:border-[#C5A33E] focus:outline-none"
        >
          <option value="">Select a faction...</option>
          {factions.map(f => (
            <option key={f.slug} value={f.slug}>{f.name}</option>
          ))}
        </select>

        {catalogue && (
          <input
            type="text"
            placeholder="Search units..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="px-3 py-2 bg-[#14142a] text-gray-200 border border-[#1a1a2e] rounded-lg focus:border-[#C5A33E] focus:outline-none"
          />
        )}

        {catalogue && (
          <span className="text-gray-400 text-sm">
            {filteredUnits.length} unit{filteredUnits.length !== 1 ? 's' : ''}
            {catalogue.library && ' (Library)'}
          </span>
        )}
      </div>

      {loading && (
        <div className="text-gray-400 py-8 text-center">Loading datasheets...</div>
      )}

      {!loading && catalogue && filteredUnits.length === 0 && (
        <div className="bg-[#14142a] border border-[#1a1a2e] rounded-lg p-8 text-center">
          <p className="text-gray-400">No units found{search ? ' matching your search' : ' in this catalogue'}.</p>
        </div>
      )}

      {!loading && catalogue && filteredUnits.length > 0 && (
        <div className="space-y-2">
          {filteredUnits.map(unit => (
            <UnitCard
              key={unit.name}
              unit={unit}
              expanded={expandedUnit === unit.name}
              onToggle={() => setExpandedUnit(expandedUnit === unit.name ? null : unit.name)}
            />
          ))}
        </div>
      )}

      {!selectedFaction && !loading && (
        <div className="bg-[#14142a] border border-[#1a1a2e] rounded-lg p-8 text-center">
          <p className="text-gray-400">Select a faction to browse datasheets.</p>
        </div>
      )}
    </div>
  );
}

function UnitCard({ unit, expanded, onToggle }: { unit: Unit; expanded: boolean; onToggle: () => void }) {
  return (
    <div className="border border-[#1a1a2e] rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#14142a] hover:bg-[#1e1e3a] transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-gray-200 font-semibold">{unit.name}</span>
          {unit.points > 0 && (
            <span className="text-[#C5A33E] text-sm">{unit.points}pts</span>
          )}
        </div>
        <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="p-4 bg-[#0a0a14] space-y-4">
          {/* Keywords */}
          {unit.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {unit.keywords.map(kw => (
                <span key={kw} className="px-2 py-0.5 text-xs bg-[#4a3a0f] text-[#C5A33E] rounded">
                  {kw}
                </span>
              ))}
            </div>
          )}

          {/* Unit Stats */}
          {unit.stats.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-[#C5A33E] mb-1">Unit Stats</h4>
              <table className="border-collapse w-auto">
                <thead>
                  <tr className="border-b border-[#C5A33E]">
                    <th className="text-left pr-4 py-1 text-gray-200 text-sm font-bold">Model</th>
                    <th className="text-center px-2 py-1 text-gray-200 text-sm font-bold">M</th>
                    <th className="text-center px-2 py-1 text-gray-200 text-sm font-bold">T</th>
                    <th className="text-center px-2 py-1 text-gray-200 text-sm font-bold">SV</th>
                    <th className="text-center px-2 py-1 text-gray-200 text-sm font-bold">W</th>
                    <th className="text-center px-2 py-1 text-gray-200 text-sm font-bold">LD</th>
                    <th className="text-center px-2 py-1 text-gray-200 text-sm font-bold">OC</th>
                  </tr>
                </thead>
                <tbody>
                  {unit.stats.map((s, i) => (
                    <tr key={i} className={`border-b border-[#1a1a2e] ${i % 2 === 0 ? 'bg-[#0a0a14]' : 'bg-[#14142a]'}`}>
                      <td className="pr-4 py-1 text-gray-200 text-sm">{s.name}</td>
                      <td className="text-center px-2 py-1 text-gray-300 text-sm">{s.M}</td>
                      <td className="text-center px-2 py-1 text-gray-300 text-sm">{s.T}</td>
                      <td className="text-center px-2 py-1 text-gray-300 text-sm">{s.SV}</td>
                      <td className="text-center px-2 py-1 text-gray-300 text-sm">{s.W}</td>
                      <td className="text-center px-2 py-1 text-gray-300 text-sm">{s.LD}</td>
                      <td className="text-center px-2 py-1 text-gray-300 text-sm">{s.OC}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Ranged Weapons */}
          {unit.rangedWeapons.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-[#C5A33E] mb-1">Ranged Weapons</h4>
              <table className="border-collapse w-auto">
                <thead>
                  <tr className="border-b border-[#C5A33E]">
                    <th className="text-left pr-4 py-1 text-gray-200 text-sm font-bold">Weapon</th>
                    <th className="text-center px-2 py-1 text-gray-200 text-sm font-bold">Range</th>
                    <th className="text-center px-2 py-1 text-gray-200 text-sm font-bold">A</th>
                    <th className="text-center px-2 py-1 text-gray-200 text-sm font-bold">BS</th>
                    <th className="text-center px-2 py-1 text-gray-200 text-sm font-bold">S</th>
                    <th className="text-center px-2 py-1 text-gray-200 text-sm font-bold">AP</th>
                    <th className="text-center px-2 py-1 text-gray-200 text-sm font-bold">D</th>
                    <th className="text-left pl-3 py-1 text-gray-200 text-sm font-bold">Keywords</th>
                  </tr>
                </thead>
                <tbody>
                  {unit.rangedWeapons.map((w, i) => (
                    <tr key={i} className={`border-b border-[#1a1a2e] ${i % 2 === 0 ? 'bg-[#0a0a14]' : 'bg-[#14142a]'}`}>
                      <td className="pr-4 py-1 text-gray-200 text-sm">{w.name}</td>
                      <td className="text-center px-2 py-1 text-gray-300 text-sm">{w.range}</td>
                      <td className="text-center px-2 py-1 text-gray-300 text-sm">{w.A}</td>
                      <td className="text-center px-2 py-1 text-gray-300 text-sm">{w.BS}</td>
                      <td className="text-center px-2 py-1 text-gray-300 text-sm">{w.S}</td>
                      <td className="text-center px-2 py-1 text-gray-300 text-sm">{w.AP}</td>
                      <td className="text-center px-2 py-1 text-gray-300 text-sm">{w.D}</td>
                      <td className="pl-3 py-1 text-gray-400 text-xs">{w.keywords}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Melee Weapons */}
          {unit.meleeWeapons.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-[#C5A33E] mb-1">Melee Weapons</h4>
              <table className="border-collapse w-auto">
                <thead>
                  <tr className="border-b border-[#C5A33E]">
                    <th className="text-left pr-4 py-1 text-gray-200 text-sm font-bold">Weapon</th>
                    <th className="text-center px-2 py-1 text-gray-200 text-sm font-bold">Range</th>
                    <th className="text-center px-2 py-1 text-gray-200 text-sm font-bold">A</th>
                    <th className="text-center px-2 py-1 text-gray-200 text-sm font-bold">WS</th>
                    <th className="text-center px-2 py-1 text-gray-200 text-sm font-bold">S</th>
                    <th className="text-center px-2 py-1 text-gray-200 text-sm font-bold">AP</th>
                    <th className="text-center px-2 py-1 text-gray-200 text-sm font-bold">D</th>
                    <th className="text-left pl-3 py-1 text-gray-200 text-sm font-bold">Keywords</th>
                  </tr>
                </thead>
                <tbody>
                  {unit.meleeWeapons.map((w, i) => (
                    <tr key={i} className={`border-b border-[#1a1a2e] ${i % 2 === 0 ? 'bg-[#0a0a14]' : 'bg-[#14142a]'}`}>
                      <td className="pr-4 py-1 text-gray-200 text-sm">{w.name}</td>
                      <td className="text-center px-2 py-1 text-gray-300 text-sm">{w.range}</td>
                      <td className="text-center px-2 py-1 text-gray-300 text-sm">{w.A}</td>
                      <td className="text-center px-2 py-1 text-gray-300 text-sm">{w.WS}</td>
                      <td className="text-center px-2 py-1 text-gray-300 text-sm">{w.S}</td>
                      <td className="text-center px-2 py-1 text-gray-300 text-sm">{w.AP}</td>
                      <td className="text-center px-2 py-1 text-gray-300 text-sm">{w.D}</td>
                      <td className="pl-3 py-1 text-gray-400 text-xs">{w.keywords}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Abilities */}
          {unit.abilities.length > 0 && (
            <div>
              <h4 className="text-sm font-bold text-[#C5A33E] mb-1">Abilities</h4>
              <div className="space-y-1">
                {unit.abilities.map((a, i) => (
                  <div key={i} className="text-sm">
                    <span className="text-gray-200 font-semibold">{a.name}: </span>
                    <span className="text-gray-400">{a.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
