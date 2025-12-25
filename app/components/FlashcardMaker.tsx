'use client';

import { useState } from 'react';

interface Flashcard {
  id: number;
  front: string;
  back: string;
}

export default function FlashcardMaker() {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [currentFront, setCurrentFront] = useState('');
  const [currentBack, setCurrentBack] = useState('');
  const [viewMode, setViewMode] = useState<'edit' | 'study'>('edit');
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const addFlashcard = () => {
    if (currentFront.trim() && currentBack.trim()) {
      setFlashcards([
        ...flashcards,
        { id: Date.now(), front: currentFront, back: currentBack }
      ]);
      setCurrentFront('');
      setCurrentBack('');
    }
  };

  const deleteFlashcard = (id: number) => {
    setFlashcards(flashcards.filter(card => card.id !== id));
  };

  const nextCard = () => {
    setShowAnswer(false);
    setCurrentCardIndex((prev) => (prev + 1) % flashcards.length);
  };

  const previousCard = () => {
    setShowAnswer(false);
    setCurrentCardIndex((prev) => (prev - 1 + flashcards.length) % flashcards.length);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4 text-[#39FF14]">Flashcard Maker</h2>
        <p className="text-gray-400 mb-4">
          Create flashcards to study stratagems, abilities, and rules.
        </p>
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={() => setViewMode('edit')}
          className={`px-6 py-2 font-semibold rounded-lg transition-colors ${
            viewMode === 'edit'
              ? 'bg-[#0f4d0f] text-[#39FF14]'
              : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#3a3a3a]'
          }`}
        >
          Edit Mode
        </button>
        <button
          onClick={() => {
            setViewMode('study');
            setCurrentCardIndex(0);
            setShowAnswer(false);
          }}
          disabled={flashcards.length === 0}
          className={`px-6 py-2 font-semibold rounded-lg transition-colors ${
            viewMode === 'study'
              ? 'bg-[#0f4d0f] text-[#39FF14]'
              : 'bg-[#2a2a2a] text-gray-400 hover:bg-[#3a3a3a] disabled:opacity-50 disabled:cursor-not-allowed'
          }`}
        >
          Study Mode
        </button>
      </div>

      {viewMode === 'edit' ? (
        <div className="space-y-4">
          <div className="bg-[#1a1a1a] border border-[#1a2a1a] rounded-lg p-4 space-y-4">
            <div>
              <label className="block mb-2 font-semibold text-gray-200">
                Front (Question/Prompt)
              </label>
              <input
                type="text"
                value={currentFront}
                onChange={(e) => setCurrentFront(e.target.value)}
                placeholder="e.g., What is Reanimation Protocols?"
                className="w-full p-3 bg-[#0a0a0a] border border-[#1a2a1a] rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#39FF14]"
              />
            </div>

            <div>
              <label className="block mb-2 font-semibold text-gray-200">
                Back (Answer)
              </label>
              <textarea
                value={currentBack}
                onChange={(e) => setCurrentBack(e.target.value)}
                placeholder="e.g., At the end of your Command phase, roll one D6 for each slain model in this unit. For each 5+, return one model to this unit."
                className="w-full h-24 p-3 bg-[#0a0a0a] border border-[#1a2a1a] rounded text-gray-200 placeholder-gray-600 focus:outline-none focus:border-[#39FF14] resize-none"
              />
            </div>

            <button
              onClick={addFlashcard}
              className="px-6 py-2 bg-[#0f4d0f] hover:bg-[#39FF14] hover:text-black text-white font-semibold rounded-lg transition-colors"
            >
              Add Flashcard
            </button>
          </div>

          {flashcards.length > 0 && (
            <div>
              <h3 className="text-xl font-bold mb-3 text-[#39FF14]">
                Your Flashcards ({flashcards.length})
              </h3>
              <div className="space-y-2">
                {flashcards.map((card) => (
                  <div
                    key={card.id}
                    className="bg-[#1a1a1a] border border-[#1a2a1a] rounded-lg p-4 hover:border-[#39FF14] transition-colors"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-200 mb-2">{card.front}</div>
                        <div className="text-sm text-gray-400">{card.back}</div>
                      </div>
                      <button
                        onClick={() => deleteFlashcard(card.id)}
                        className="ml-4 px-3 py-1 bg-[#0f4d0f] hover:bg-[#39FF14] hover:text-black text-white text-sm rounded transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {flashcards.length > 0 ? (
            <>
              <div className="text-center mb-4 text-gray-400">
                Card {currentCardIndex + 1} of {flashcards.length}
              </div>

              <div className="bg-[#1a1a1a] border-2 border-[#39FF14] rounded-lg p-8 min-h-[300px] flex flex-col items-center justify-center">
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-200 mb-6">
                    {flashcards[currentCardIndex].front}
                  </div>

                  {showAnswer && (
                    <div className="mt-6 pt-6 border-t border-[#1a2a1a] text-gray-300">
                      {flashcards[currentCardIndex].back}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-center gap-3">
                <button
                  onClick={previousCard}
                  className="px-6 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-gray-300 font-semibold rounded-lg transition-colors"
                >
                  Previous
                </button>
                <button
                  onClick={() => setShowAnswer(!showAnswer)}
                  className="px-6 py-2 bg-[#0f4d0f] hover:bg-[#39FF14] hover:text-black text-white font-semibold rounded-lg transition-colors"
                >
                  {showAnswer ? 'Hide Answer' : 'Show Answer'}
                </button>
                <button
                  onClick={nextCard}
                  className="px-6 py-2 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-gray-300 font-semibold rounded-lg transition-colors"
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            <div className="text-center text-gray-400 py-12">
              No flashcards yet. Switch to Edit Mode to create some!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
