'use client';

import { useState } from 'react';
import { generateTournamentPDF } from '../utils/pdfExport';
import type { SpawnedGroup } from '../types';

export default function ExportPDFButton({
  spawnedGroupsByRound
}: {
  spawnedGroupsByRound: { [roundId: string]: SpawnedGroup[] }
}) {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 5 });

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await generateTournamentPDF(spawnedGroupsByRound, (current, total) => {
        setProgress({ current, total });
      });
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsExporting(false);
      setProgress({ current: 0, total: 5 });
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="px-4 py-2 bg-[#0f4d0f] hover:bg-[#39FF14] hover:text-black text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isExporting ? (
        <span className="flex items-center gap-2">
          <span>Generating PDF...</span>
          <span className="text-sm">({progress.current}/{progress.total})</span>
        </span>
      ) : (
        'Export to PDF'
      )}
    </button>
  );
}
