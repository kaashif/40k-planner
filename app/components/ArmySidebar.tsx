'use client';

import { useState, useRef } from 'react';

export default function ArmySidebar() {
  const [armyStatus, setArmyStatus] = useState<string | null>(null);
  const [showUrlPopup, setShowUrlPopup] = useState(false);
  const [url, setUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNewRecruitImport = () => {
    setShowUrlPopup(true);
  };

  const handleUrlSubmit = () => {
    if (url.trim()) {
      setArmyStatus('Army imported');
      setShowUrlPopup(false);
      setUrl('');
    }
  };

  const handleJsonImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setArmyStatus('Army imported');
    }
  };

  return (
    <>
      <aside className="w-80 bg-[#0f0f0f] border-r border-[#1a2a1a] p-6 min-h-screen">
        <h2 className="text-2xl font-bold text-[#39FF14] mb-6">Army List</h2>

        <div className="space-y-3 mb-6">
          <button
            onClick={handleNewRecruitImport}
            className="w-full px-4 py-3 bg-[#0f4d0f] hover:bg-[#39FF14] hover:text-black text-white font-semibold rounded-lg transition-colors"
          >
            Import from NewRecruit
          </button>
          <button
            onClick={handleJsonImport}
            className="w-full px-4 py-3 bg-[#0f4d0f] hover:bg-[#39FF14] hover:text-black text-white font-semibold rounded-lg transition-colors"
          >
            Import JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileSelected}
            className="hidden"
          />
        </div>

        {armyStatus && (
          <div className="p-4 bg-[#1a1a1a] border border-[#1a2a1a] rounded-lg text-gray-300">
            {armyStatus}
          </div>
        )}
      </aside>

      {/* URL Popup Modal */}
      {showUrlPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border-2 border-[#39FF14] rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-[#39FF14] mb-4">
              Import from NewRecruit
            </h3>
            <p className="text-gray-400 mb-4 text-sm">
              Enter the NewRecruit list URL:
            </p>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://newrecruit.eu/..."
              className="w-full p-3 bg-[#0a0a0a] border border-[#1a2a1a] rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#39FF14] mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={handleUrlSubmit}
                className="flex-1 px-4 py-2 bg-[#0f4d0f] hover:bg-[#39FF14] hover:text-black text-white font-semibold rounded-lg transition-colors"
              >
                Import
              </button>
              <button
                onClick={() => {
                  setShowUrlPopup(false);
                  setUrl('');
                }}
                className="flex-1 px-4 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-gray-300 font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
