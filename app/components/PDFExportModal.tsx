'use client';

import { useState, useEffect } from 'react';
import { PDFConfig, DEFAULT_PDF_CONFIG } from '../utils/pdfExport';

interface PDFExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExport: (config: PDFConfig) => void;
  isExporting: boolean;
  progress: { current: number; total: number };
  initialConfig: PDFConfig;
}

function PreviewArea({ config }: { config: PDFConfig }) {
  const A4_WIDTH = 595.28;
  const A4_HEIGHT = 841.89;
  const PREVIEW_SCALE = 0.4; // 40% size for display

  // Calculate layout dimensions based on config
  const layoutWidth = (A4_WIDTH - 2 * config.pageMargin) * config.layoutScale;
  const layoutHeight = 407 * config.layoutScale;

  return (
    <div className="flex items-center justify-center">
      <div
        className="bg-white relative"
        style={{
          width: `${A4_WIDTH * PREVIEW_SCALE}px`,
          height: `${A4_HEIGHT * PREVIEW_SCALE}px`,
        }}
      >
        {/* Top layout */}
        <div
          className="absolute bg-gray-300 border border-gray-400"
          style={{
            left: `${config.pageMargin * PREVIEW_SCALE}px`,
            top: `${config.pageMargin * PREVIEW_SCALE}px`,
            width: `${layoutWidth * PREVIEW_SCALE}px`,
            height: `${layoutHeight * PREVIEW_SCALE}px`,
          }}
        >
          <div className="text-[6px] text-gray-600 p-1">Round 1</div>
        </div>

        {/* Bottom layout */}
        <div
          className="absolute bg-gray-300 border border-gray-400"
          style={{
            left: `${config.pageMargin * PREVIEW_SCALE}px`,
            top: `${(A4_HEIGHT / 2 + config.deploymentSpacing / 2) * PREVIEW_SCALE}px`,
            width: `${layoutWidth * PREVIEW_SCALE}px`,
            height: `${layoutHeight * PREVIEW_SCALE}px`,
          }}
        >
          <div className="text-[6px] text-gray-600 p-1">Round 2</div>
        </div>
      </div>
    </div>
  );
}

export default function PDFExportModal({
  isOpen,
  onClose,
  onExport,
  isExporting,
  progress,
  initialConfig,
}: PDFExportModalProps) {
  const [config, setConfig] = useState<PDFConfig>(initialConfig);

  // Update local config when initialConfig changes
  useEffect(() => {
    setConfig(initialConfig);
  }, [initialConfig]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isExporting) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, isExporting, onClose]);

  const handleReset = () => {
    setConfig(DEFAULT_PDF_CONFIG);
  };

  const handleExport = () => {
    onExport(config);
  };

  // Check if settings will cause overflow
  const isOverflowing = () => {
    const A4_WIDTH = 595.28;
    const A4_HEIGHT = 841.89;
    const layoutWidth = (A4_WIDTH - 2 * config.pageMargin) * config.layoutScale;
    const layoutHeight = 407 * config.layoutScale;

    return (
      layoutWidth + 2 * config.pageMargin > A4_WIDTH ||
      layoutHeight > A4_HEIGHT / 2 - config.deploymentSpacing / 2 - config.pageMargin
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={!isExporting ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative bg-[#1a1a1a] w-full max-w-4xl rounded-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-[#1a2a1a] flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[#39FF14]">PDF Export Configuration</h2>
          <button
            onClick={onClose}
            disabled={isExporting}
            className="text-gray-400 hover:text-white text-2xl leading-none disabled:opacity-50"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-6 grid grid-cols-2 gap-8">
          {/* Controls */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-300">
                  Deployment Spacing
                </label>
                <span className="text-sm text-[#39FF14] font-mono">
                  {config.deploymentSpacing}pt
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={config.deploymentSpacing}
                onChange={(e) =>
                  setConfig({ ...config, deploymentSpacing: Number(e.target.value) })
                }
                disabled={isExporting}
                className="slider-thumb w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0pt</span>
                <span>100pt</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Vertical gap between top and bottom deployments
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-300">Page Margin</label>
                <span className="text-sm text-[#39FF14] font-mono">
                  {config.pageMargin}pt
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="50"
                step="5"
                value={config.pageMargin}
                onChange={(e) =>
                  setConfig({ ...config, pageMargin: Number(e.target.value) })
                }
                disabled={isExporting}
                className="slider-thumb w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>10pt</span>
                <span>50pt</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Margin from layouts to edge of page
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-gray-300">Layout Scale</label>
                <span className="text-sm text-[#39FF14] font-mono">
                  {Math.round(config.layoutScale * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.05"
                value={config.layoutScale}
                onChange={(e) =>
                  setConfig({ ...config, layoutScale: Number(e.target.value) })
                }
                disabled={isExporting}
                className="slider-thumb w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>50%</span>
                <span>150%</span>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Zoom in or out on deployment layouts
              </p>
            </div>

            {/* Overflow Warning */}
            {isOverflowing() && (
              <div className="bg-red-900/30 border border-red-500 text-red-200 p-3 rounded text-sm">
                ⚠️ Warning: Current settings may cause layouts to overflow the page
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="bg-[#0a0a0a] rounded-lg p-4 flex items-center justify-center">
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-4 text-center">
                Preview (A4 Page)
              </h3>
              <PreviewArea config={config} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[#1a2a1a] flex items-center justify-between">
          <button
            onClick={handleReset}
            disabled={isExporting}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            Reset to Defaults
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="px-4 py-2 bg-[#0f4d0f] hover:bg-[#39FF14] hover:text-black text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
            >
              {isExporting ? (
                <span className="flex items-center gap-2">
                  <span>Exporting...</span>
                  <span className="text-sm">
                    ({progress.current}/{progress.total})
                  </span>
                </span>
              ) : (
                'Export PDF'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
