
import React, { useState, useEffect, useCallback } from 'react';
import { Music, Settings as SettingsIcon, Volume2, RotateCcw, Check, Play, Loader2, Moon, Sun } from 'lucide-react';
import Piano from './components/Piano';
import SheetMusic from './components/SheetMusic';
import { GameSettings, ExerciseItem, KeyRoot, KeyType } from './types';
import { generateExercise } from './services/logic';
import { audioService } from './services/audioService';

const App: React.FC = () => {
  // --- State ---
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<GameSettings>({
    clef: 'treble',
    useAccidentals: false, // Default false to prevent confusion
    mode: 'single',
    keyRoot: 'C',
    keyType: 'major'
  });
  
  const [exerciseItems, setExerciseItems] = useState<ExerciseItem[]>([]);
  const [cursorIndex, setCursorIndex] = useState(0);
  const [selectedChordNotes, setSelectedChordNotes] = useState<number[]>([]);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // --- Actions ---

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  const startGame = async () => {
    setIsLoading(true);
    try {
      await audioService.init();
      const newItems = generateExercise(settings);
      setExerciseItems(newItems);
      setCursorIndex(0);
      setSelectedChordNotes([]);
      setFeedbackMessage(null);
      setIsPlaying(true);
    } catch (error) {
      console.error("Failed to initialize audio:", error);
      setFeedbackMessage("Error loading sounds. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  const nextTurn = () => {
    // Generate new set without stopping
    const newItems = generateExercise(settings);
    setExerciseItems(newItems);
    setCursorIndex(0);
    setSelectedChordNotes([]);
    setFeedbackMessage(null);
  };

  const stopGame = () => {
    setIsPlaying(false);
    setExerciseItems([]);
  };

  // --- Core Game Logic ---

  const handlePianoInput = useCallback((midi: number) => {
    if (!isPlaying) return;
    if (cursorIndex >= exerciseItems.length) return;

    const currentItem = exerciseItems[cursorIndex];

    if (settings.mode === 'single' || settings.mode === 'beams') {
      // Immediate evaluation
      const targetMidi = currentItem.notes[0].midi;
      
      if (midi === targetMidi) {
        // Correct
        const updatedItems = [...exerciseItems];
        updatedItems[cursorIndex].status = 'correct';
        setExerciseItems(updatedItems);
        
        // Advance
        if (cursorIndex + 1 < exerciseItems.length) {
          setCursorIndex(prev => prev + 1);
        } else {
          // End of turn, slight delay then next
          setTimeout(() => nextTurn(), 500);
        }
      } else {
        // Incorrect
        // Visual feedback?
        setFeedbackMessage('Try again!');
        setTimeout(() => setFeedbackMessage(null), 1000);
      }
    } else if (settings.mode === 'chords') {
      // Toggle selection
      setSelectedChordNotes(prev => {
        if (prev.includes(midi)) return prev.filter(n => n !== midi);
        return [...prev, midi];
      });
    }
  }, [isPlaying, cursorIndex, exerciseItems, settings.mode]);

  const submitChord = () => {
    if (cursorIndex >= exerciseItems.length) return;
    const currentItem = exerciseItems[cursorIndex];
    const targetMidis = currentItem.notes.map(n => n.midi).sort();
    const selectedSorted = [...selectedChordNotes].sort();
    
    // Compare arrays
    const isCorrect = JSON.stringify(targetMidis) === JSON.stringify(selectedSorted);
    
    if (isCorrect) {
       // Play the full chord sound on success
       audioService.playChord(targetMidis, '2n');

       const updatedItems = [...exerciseItems];
       updatedItems[cursorIndex].status = 'correct';
       setExerciseItems(updatedItems);
       setSelectedChordNotes([]);
       
       if (cursorIndex + 1 < exerciseItems.length) {
         setCursorIndex(prev => prev + 1);
       } else {
         setTimeout(() => nextTurn(), 500);
       }
    } else {
      setFeedbackMessage('Incorrect chord notes.');
      setTimeout(() => setFeedbackMessage(null), 1000);
    }
  };

  // --- Render ---
  
  // Grouped keys for better UI
  const naturalKeys: KeyRoot[] = ['C', 'F', 'G', 'D', 'A', 'E', 'B'];
  const sharpKeys: KeyRoot[] = ['F#', 'C#']; // Common sharp keys
  const flatKeys: KeyRoot[] = ['Bb', 'Eb', 'Ab', 'Db', 'Gb'];

  return (
    <div className={isDarkMode ? 'dark h-full w-full' : 'h-full w-full'}>
      <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-300">
        
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shadow-sm z-50 transition-colors duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500 rounded-lg">
              <Music className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-wide">Virtuoso <span className="text-indigo-500 dark:text-indigo-400 font-light">Sight Reader</span></h1>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
              title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {isPlaying && (
              <button 
                onClick={stopGame}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-300 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-full transition-colors"
              >
                <RotateCcw className="w-4 h-4" /> Quit Exercise
              </button>
            )}
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col items-center justify-center relative p-4 overflow-y-auto">
          
          {!isPlaying ? (
            // Menu Screen
            <div className="w-full max-w-xl bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl dark:shadow-2xl border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-bottom-4 duration-500 transition-colors">
               <div className="mb-8 text-center">
                 <h2 className="text-2xl font-bold mb-2 text-slate-900 dark:text-white">Configuration</h2>
                 <p className="text-slate-500 dark:text-slate-400 text-sm">Customize your practice session</p>
               </div>

               <div className="space-y-6">
                  {/* Mode Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Mode</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['single', 'chords', 'beams'] as const).map(m => (
                        <button
                          key={m}
                          onClick={() => setSettings(prev => ({ ...prev, mode: m }))}
                          className={`py-2 px-4 rounded-lg text-sm font-medium transition-all capitalize border ${
                            settings.mode === m 
                              ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/30' 
                              : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Clef Selection */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Clef</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setSettings(prev => ({ ...prev, clef: 'treble' }))}
                          className={`py-2 px-2 rounded-lg text-sm font-medium transition-all border flex justify-center items-center ${
                            settings.clef === 'treble' 
                              ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' 
                              : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                          }`}
                        >
                          Treble 🎼
                        </button>
                        <button
                          onClick={() => setSettings(prev => ({ ...prev, clef: 'bass' }))}
                          className={`py-2 px-2 rounded-lg text-sm font-medium transition-all border flex justify-center items-center ${
                            settings.clef === 'bass' 
                              ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' 
                              : 'bg-slate-100 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                          }`}
                        >
                          Bass 𝄢
                        </button>
                      </div>
                    </div>

                    {/* Accidentals */}
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Options</label>
                       <div 
                         onClick={() => setSettings(prev => ({ ...prev, useAccidentals: !prev.useAccidentals }))}
                         className="cursor-pointer flex items-center justify-between p-2 bg-slate-100 dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-200 dark:hover:bg-slate-650 transition-colors h-[42px]"
                       >
                        <span className="text-xs font-medium pl-1 text-slate-700 dark:text-slate-200">Chromatics</span>
                        <div className={`w-8 h-4 rounded-full relative transition-colors ${settings.useAccidentals ? 'bg-indigo-500' : 'bg-slate-400 dark:bg-slate-500'}`}>
                           <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${settings.useAccidentals ? 'left-4.5' : 'left-0.5'}`} style={{ left: settings.useAccidentals ? '18px' : '2px' }}/>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500 leading-tight px-1">
                          {settings.useAccidentals ? "Allows notes outside the key signature." : "Strictly notes within key signature."}
                      </div>
                    </div>
                  </div>

                  {/* Key Signature Selection */}
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Key Signature</label>
                    <div className="p-3 bg-slate-50 dark:bg-slate-700/30 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                      
                      {/* Key Types */}
                      <div className="flex gap-2 mb-2">
                        {(['major', 'minor'] as const).map(type => (
                           <button
                             key={type}
                             onClick={() => setSettings(prev => ({ ...prev, keyType: type }))}
                             className={`flex-1 py-1.5 rounded-md text-xs font-bold uppercase tracking-wide transition-all border ${
                               settings.keyType === type
                                 ? 'bg-indigo-500/80 border-indigo-400 text-white'
                                 : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                             }`}
                           >
                             {type}
                           </button>
                        ))}
                      </div>

                      {/* Key Grid */}
                      <div className="flex flex-wrap gap-1.5 justify-center">
                          {naturalKeys.map(k => (
                             <KeyButton key={k} k={k} selected={settings.keyRoot === k} onClick={() => setSettings(prev => ({...prev, keyRoot: k}))} />
                          ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5 justify-center">
                          {flatKeys.map(k => (
                             <KeyButton key={k} k={k} selected={settings.keyRoot === k} onClick={() => setSettings(prev => ({...prev, keyRoot: k}))} />
                          ))}
                      </div>
                       <div className="flex flex-wrap gap-1.5 justify-center">
                          {sharpKeys.map(k => (
                             <KeyButton key={k} k={k} selected={settings.keyRoot === k} onClick={() => setSettings(prev => ({...prev, keyRoot: k}))} />
                          ))}
                      </div>

                    </div>
                  </div>

                  <button
                    onClick={startGame}
                    disabled={isLoading}
                    className={`w-full py-4 mt-4 bg-green-600 hover:bg-green-500 disabled:bg-slate-300 dark:disabled:bg-slate-600 disabled:text-slate-500 dark:disabled:text-slate-400 disabled:cursor-wait text-white font-bold rounded-xl shadow-lg shadow-green-900/20 transition-all transform active:scale-95 flex items-center justify-center gap-2`}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" /> Loading Sounds...
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5 fill-current" /> Start Practice
                      </>
                    )}
                  </button>
                  {feedbackMessage && <p className="text-red-500 dark:text-red-400 text-center text-sm">{feedbackMessage}</p>}
               </div>
            </div>
          ) : (
            // Game Screen
            <div className="w-full max-w-[95vw] flex flex-col gap-6 animate-in fade-in zoom-in duration-300">
              
              {/* Sheet Music Area */}
              <div className="relative">
                 <div className="absolute top-2 right-4 flex items-center gap-2 z-10">
                   <div className="bg-slate-100 dark:bg-slate-800/80 px-3 py-1 rounded-full text-xs font-mono text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 shadow-sm">
                      {settings.keyRoot} {settings.keyType} | {settings.mode}
                   </div>
                 </div>
                 
                 <SheetMusic 
                   items={exerciseItems} 
                   clef={settings.clef} 
                   activeIndex={cursorIndex}
                   keyRoot={settings.keyRoot}
                   keyType={settings.keyType}
                 />
                 
                 {feedbackMessage && (
                   <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-slate-900/90 dark:bg-slate-900/90 text-white px-6 py-3 rounded-full font-bold backdrop-blur-sm border border-slate-700 animate-bounce z-20">
                     {feedbackMessage}
                   </div>
                 )}
              </div>

              {/* Controls for Chord Mode */}
              {settings.mode === 'chords' && (
                <div className="flex justify-center">
                   <button 
                     onClick={submitChord}
                     className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3 rounded-lg font-bold shadow-lg transition-transform active:scale-95 flex items-center gap-2"
                   >
                     <Check className="w-5 h-5" /> Submit Chord
                   </button>
                </div>
              )}

              {/* Piano */}
              <div className="px-4">
                 <Piano 
                   onNotePlay={handlePianoInput}
                   selectedNotes={selectedChordNotes}
                   activeNotes={[]} 
                   isDarkMode={isDarkMode}
                 />
              </div>
              
              <div className="text-center text-slate-500 dark:text-slate-500 text-xs mt-2">
                {settings.mode === 'chords' 
                  ? "Select all notes in the chord and press Submit." 
                  : "Play the highlighted note on the keyboard."}
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const KeyButton: React.FC<{k: KeyRoot, selected: boolean, onClick: () => void}> = ({k, selected, onClick}) => (
    <button
        onClick={onClick}
        className={`w-9 h-9 rounded-lg text-xs font-bold transition-all border ${
        selected
            ? 'bg-indigo-500 border-indigo-400 text-white shadow-md'
            : 'bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-600'
        }`}
    >
        {k}
    </button>
);

export default App;
