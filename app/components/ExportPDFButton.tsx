'use client';

import { useState, useEffect } from 'react';
import { generateTournamentPDF, DEFAULT_PDF_CONFIG, PDFConfig } from '../utils/pdfExport';
import PDFExportModal from './PDFExportModal';
import type { SpawnedGroup } from '../types';

export default function ExportPDFButton({
  spawnedGroupsByRoundAndTurn
}: {
  spawnedGroupsByRoundAndTurn: { [key: string]: SpawnedGroup[] }
}) {
  // Convert to old format for PDF export (use deployment state for each round)
  const spawnedGroupsByRound: { [roundId: string]: SpawnedGroup[] } = {};
  const rounds = ['terraform', 'purge', 'supplies', 'linchpin', 'take'];
  for (const round of rounds) {
    spawnedGroupsByRound[round] = spawnedGroupsByRoundAndTurn[`${round}-deployment`] || [];
  }
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 5 });

  // Load config from localStorage
  const [pdfConfig, setPdfConfig] = useState<PDFConfig>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('pdfExportConfig');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return DEFAULT_PDF_CONFIG;
        }
      }
    }
    return DEFAULT_PDF_CONFIG;
  });

  // Save to localStorage when config changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pdfExportConfig', JSON.stringify(pdfConfig));
    }
  }, [pdfConfig]);

  const handleExport = async (config: PDFConfig) => {
    setPdfConfig(config);
    setIsExporting(true);
    try {
      await generateTournamentPDF(spawnedGroupsByRound, (current, total) => {
        setProgress({ current, total });
      }, config);

      // Close modal after successful export
      setTimeout(() => setIsModalOpen(false), 500);
    } catch (error) {
      console.error('PDF export failed:', error);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsExporting(false);
      setProgress({ current: 0, total: 5 });
    }
  };

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="px-4 py-2 bg-[#0f4d0f] hover:bg-[#39FF14] hover:text-black text-white font-semibold rounded-lg transition-colors"
      >
        Export to PDF
      </button>

      <PDFExportModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onExport={handleExport}
        isExporting={isExporting}
        progress={progress}
        initialConfig={pdfConfig}
      />
    </>
  );
}
