import React, { useState } from 'react';
import { Lock, CheckCircle, AlertCircle } from 'lucide-react';

const LEVELS = [
  {
    id: 1,
    title: "Unknown Object on the Hill",
    images: ["/src/components/intel/images/ig1.png"],
    question: "What clues from this tourist Instagram photo help you narrow down the region of the world? Identify at least one geographic hint visible in the image.",
    acceptedAnswers: ["middle east", "persian gulf", "coastal desert region", "gulf region", "arabian gulf"]
  },
  {
    id: 2,
    title: "Construction Near the Harbor",
    images: ["/src/components/intel/images/ig2.png"],
    question: "What type of activity is shown in this construction image, and how might it relate to increased port operations?",
    acceptedAnswers: ["harbor expansion", "new facilities", "infrastructure growth", "port expansion", "facility construction"]
  },
  {
    id: 3,
    title: "Local News Report",
    images: ["/src/components/intel/images/report.png"],
    question: "What anomaly or notable trend does this news article report, and how could it connect to the earlier images?",
    acceptedAnswers: ["increased maritime traffic", "cargo deliveries increasing", "more ships", "shipping increase", "maritime increase"]
  },
  {
    id: 4,
    title: "Suspicious Weather Stations",
    images: ["/src/components/intel/images/facebook.png"],
    question: "These structures are labeled as 'weather stations' by a civilian. What about them suggests a different purpose?",
    acceptedAnswers: ["radomes", "satellite tracking", "sigint structures", "radar", "communications", "tracking station"]
  },
  {
    id: 5,
    title: "Tourist Map Leak",
    images: ["/src/components/intel/images/reddit.png"],
    question: "Compare the coastline and restricted zones on this map with the earlier photos. What island does this map most likely represent?",
    acceptedAnswers: ["kish island", "kish", "island in persian gulf", "iranian island"]
  },
  {
    id: 6,
    title: "Sector 4 Job Posting",
    images: ["/src/components/intel/images/jobOpening.png"],
    question: "What technical skills or frequency ranges mentioned here provide clues about the facility's purpose?",
    acceptedAnswers: ["vhf bands", "rf systems", "110-130 mhz", "vhf", "radio frequency", "110 mhz", "130 mhz"]
  },
  {
    id: 7,
    title: "Shipping Manifest",
    images: ["/src/components/intel/images/manifest.png"],
    question: "Based on the crate contents, what type of capability might Sector 4 be building or upgrading?",
    acceptedAnswers: ["rf shielding", "fiber optics", "cryogenic systems", "high-power radar", "communications", "radar systems"]
  },
  {
    id: 8,
    title: "Satellite Imagery Confirmation",
    images: ["/src/components/intel/images/exif.png", "/src/components/intel/images/redacted.png"],
    question: "Use the EXIF GPS coordinates and the coastline in the satellite overlay to confirm the island's identity. What island is shown?",
    acceptedAnswers: ["kish island", "kish"]
  }
];

export default function OSINTChallenge() {
  const [unlockedLevels, setUnlockedLevels] = useState([1]);
  const [answers, setAnswers] = useState({});
  const [feedback, setFeedback] = useState({});

  const handleSubmit = (levelId, answer) => {
    const level = LEVELS.find(l => l.id === levelId);
    const normalizedAnswer = answer.toLowerCase().trim();
    
    // Check if answer matches any accepted answer
    const isCorrect = level.acceptedAnswers.some(acceptedAnswer => 
      normalizedAnswer.includes(acceptedAnswer) || acceptedAnswer.includes(normalizedAnswer)
    );

    if (isCorrect) {
      setFeedback({ ...feedback, [levelId]: { type: 'success', message: 'Correct! Next level unlocked.' } });
      setAnswers({ ...answers, [levelId]: answer });
      
      // Unlock next level after a short delay
      setTimeout(() => {
        if (levelId < LEVELS.length && !unlockedLevels.includes(levelId + 1)) {
          setUnlockedLevels([...unlockedLevels, levelId + 1]);
        }
      }, 800);
    } else {
      setFeedback({ ...feedback, [levelId]: { type: 'error', message: 'Incorrect. Try again.' } });
    }
  };

  const isLevelUnlocked = (levelId) => unlockedLevels.includes(levelId);
  const isLevelCompleted = (levelId) => answers[levelId] && feedback[levelId]?.type === 'success';

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-xl p-6">
        <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
          <span className="text-3xl">🔎</span>
          OSINT Challenge: Oracle Island Investigation
        </h2>
        <p className="text-slate-300 text-sm">
          Use open-source intelligence techniques to identify a mysterious facility. Complete each level to unlock the next.
        </p>
        <div className="mt-4 flex items-center gap-2 text-sm">
          <span className="text-slate-400">Progress:</span>
          <span className="font-bold text-purple-400">{unlockedLevels.length - 1} / {LEVELS.length}</span>
          <div className="flex-1 bg-slate-800 rounded-full h-2 ml-3">
            <div 
              className="bg-purple-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${((unlockedLevels.length - 1) / LEVELS.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {LEVELS.map((level) => {
        const unlocked = isLevelUnlocked(level.id);
        const completed = isLevelCompleted(level.id);
        const currentFeedback = feedback[level.id];

        return (
          <div
            key={level.id}
            className={`relative rounded-xl border transition-all ${
              unlocked
                ? completed
                  ? 'bg-green-950/20 border-green-500/50'
                  : 'bg-slate-900/50 border-slate-700'
                : 'bg-slate-950/50 border-slate-800/50 opacity-60'
            }`}
          >
            {!unlocked && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm rounded-xl flex items-center justify-center z-10">
                <div className="text-center">
                  <Lock className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-500 font-semibold">Level Locked</p>
                  <p className="text-slate-600 text-sm">Complete previous level to unlock</p>
                </div>
              </div>
            )}

            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                    completed
                      ? 'bg-green-500 text-white'
                      : unlocked
                      ? 'bg-purple-500 text-white'
                      : 'bg-slate-800 text-slate-600'
                  }`}>
                    {completed ? <CheckCircle className="w-6 h-6" /> : level.id}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{level.title}</h3>
                    <p className="text-sm text-slate-400">Level {level.id} of {LEVELS.length}</p>
                  </div>
                </div>
              </div>

              {/* Images */}
              <div className={`grid ${level.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} gap-4 mb-4`}>
                {level.images.map((img, idx) => (
                  <div key={idx} className="border border-slate-700 rounded-lg overflow-hidden bg-slate-950">
                    <img 
                      src={img} 
                      alt={`Level ${level.id} evidence ${idx + 1}`}
                      className="w-full h-auto object-contain"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                    <div className="hidden h-64 items-center justify-center bg-slate-900">
                      <p className="text-slate-600 text-sm">Image not found: {img}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Question */}
              <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-4 mb-4">
                <p className="text-sm font-semibold text-purple-400 mb-2">QUESTION:</p>
                <p className="text-white leading-relaxed">{level.question}</p>
              </div>

              {/* Answer Input */}
              {unlocked && !completed && (
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Enter your answer..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSubmit(level.id, e.target.value);
                      }
                    }}
                    id={`answer-${level.id}`}
                  />
                  <button
                    onClick={() => {
                      const input = document.getElementById(`answer-${level.id}`);
                      handleSubmit(level.id, input.value);
                    }}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-semibold transition-colors"
                  >
                    Submit Answer
                  </button>
                </div>
              )}

              {/* Completed State */}
              {completed && (
                <div className="bg-green-900/20 border border-green-500/50 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400" />
                    <div>
                      <p className="text-green-400 font-semibold">Level Complete!</p>
                      <p className="text-green-300 text-sm">Your answer: <span className="font-mono">{answers[level.id]}</span></p>
                    </div>
                  </div>
                </div>
              )}

              {/* Feedback */}
              {currentFeedback && !completed && (
                <div className={`mt-3 p-4 rounded-lg border flex items-start gap-3 ${
                  currentFeedback.type === 'success'
                    ? 'bg-green-900/20 border-green-500/50'
                    : 'bg-red-900/20 border-red-500/50'
                }`}>
                  {currentFeedback.type === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  )}
                  <p className={currentFeedback.type === 'success' ? 'text-green-300' : 'text-red-300'}>
                    {currentFeedback.message}
                  </p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
