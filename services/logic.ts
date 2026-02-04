
import { Note, ExerciseItem, GameSettings, KeyRoot, KeyType } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Keyboard constraint: F1 (29) to E6 (88)
const TREBLE_MIN = 53; // F3
const TREBLE_MAX = 88; // E6
const BASS_MIN = 29;   // F1
const BASS_MAX = 67;   // G4

const getRandomInt = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

// --- Key Signature Logic ---

// Standard MIDI numbers for roots (C=0, C#=1, etc.)
const ROOT_MIDI_VALUES: Record<string, number> = {
  'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 
  'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 
  'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11, 'Cb': 11
};

// Scale Intervals
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_INTERVALS = [0, 2, 3, 5, 7, 8, 10]; // Natural Minor

// Keys that traditionally use Flats
const FLAT_KEYS = ['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm', 'Abm'];

const getScalePitchClasses = (root: KeyRoot, type: KeyType): number[] => {
  const rootMidi = ROOT_MIDI_VALUES[root];
  const intervals = type === 'major' ? MAJOR_INTERVALS : MINOR_INTERVALS;
  return intervals.map(interval => (rootMidi + interval) % 12);
};

// Determining if we should spell with Sharps or Flats
const shouldUseFlats = (root: KeyRoot, type: KeyType): boolean => {
  // Logic: Check if the key signature itself has flats.
  // Or if it's a minor key, map to relative major or checking specific list.
  
  // Specific override for keys that MUST use flats
  if (['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'].includes(root)) return true;
  
  // Minor keys using flats
  if (type === 'minor' && ['D', 'G', 'C', 'F', 'Bb', 'Eb'].includes(root)) return true;

  return false;
};

// Note Dictionaries
const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_NAMES_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/**
 * Converts MIDI to a Note object properly spelled for the current Key.
 * 
 * Logic:
 * 1. Decide if Key uses Sharps or Flats.
 * 2. Get the note name.
 * 3. Crucial for VexFlow: Even if F# is in the key of D Major, we should pass "F#" to EasyScore.
 *    EasyScore combined with addKeySignature('D') handles the rendering logic (hiding the sharp).
 *    However, if we have a Natural (e.g. F Natural in D Major), we must explicitly mark it 'n'.
 */
const midiToNote = (midi: number, root: KeyRoot, type: KeyType): Note => {
  const octave = Math.floor(midi / 12) - 1;
  const pitchClass = midi % 12;
  const useFlats = shouldUseFlats(root, type);
  
  const rawName = useFlats ? NOTE_NAMES_FLAT[pitchClass] : NOTE_NAMES_SHARP[pitchClass];
  
  // Parse accidental from name (e.g., "C#" -> name: C, acc: #)
  let name = rawName;
  let accidental: '#' | 'b' | 'n' | null = null;

  if (rawName.includes('#')) {
    name = rawName[0];
    accidental = '#';
  } else if (rawName.includes('b') && rawName.length > 1) { // checking length to avoid 'b' note bug if that ever existed, though 'B' is uppercase
    name = rawName[0];
    accidental = 'b';
  }

  // Check against Key Signature for Naturals
  // If the note is diatonic to the key, we don't strictly *need* an accidental for VexFlow if it matches the key sig,
  // BUT EasyScore prefers explicit pitch (e.g. f#4).
  // However, if we have a note that is normally sharp in the key (e.g. F# in D Major),
  // but the MIDI is F Natural (65), we MUST return accidental: 'n'.
  
  const diatonicPitchClasses = getScalePitchClasses(root, type);
  const isDiatonic = diatonicPitchClasses.includes(pitchClass);
  
  // Special handling: Note is NOT diatonic, but has no accidental in name (e.g., F natural in D major)
  if (!isDiatonic && accidental === null) {
      accidental = 'n';
  }

  return {
    midi,
    name,
    octave,
    accidental
  };
};

export const generateExercise = (settings: GameSettings): ExerciseItem[] => {
  const items: ExerciseItem[] = [];
  const min = settings.clef === 'treble' ? TREBLE_MIN : BASS_MIN;
  const max = settings.clef === 'treble' ? TREBLE_MAX : BASS_MAX;
  
  // 1. Determine allowed pitch classes based on Key Signature
  const diatonicPitchClasses = getScalePitchClasses(settings.keyRoot, settings.keyType);

  // Helper to check validity
  const isValidNote = (midi: number): boolean => {
    // BUG FIX: If useAccidentals is FALSE, the note MUST be in the diatonic scale.
    // E.g., Key D Major (F#). Midi 66 (F#) -> VALID. Midi 65 (F) -> INVALID.
    if (!settings.useAccidentals) {
      return diatonicPitchClasses.includes(midi % 12);
    }
    // If useAccidentals is TRUE, any note is valid (chromatic)
    return true; 
  };

  const getValidRandomMidi = (min: number, max: number): number => {
    // Safety break
    let attempts = 0;
    while (attempts < 100) {
        let midi = getRandomInt(min, max);
        if (isValidNote(midi)) return midi;
        attempts++;
    }
    // Fallback: Find nearest valid note
    for (let i = min; i <= max; i++) {
        if (isValidNote(i)) return i;
    }
    return min; // Should effectively never happen
  };

  if (settings.mode === 'single') {
    const itemCount = 6;
    for (let i = 0; i < itemCount; i++) {
      const midi = getValidRandomMidi(min, max);
      items.push({
        id: uuidv4(),
        notes: [midiToNote(midi, settings.keyRoot, settings.keyType)],
        status: 'pending'
      });
    }
  } 
  else if (settings.mode === 'chords') {
    const itemCount = 6;
    for (let i = 0; i < itemCount; i++) {
      const safeMax = max - 11;
      let root = getValidRandomMidi(min, safeMax);
      
      const isSeventh = Math.random() > 0.7;
      const chordMidis = [root];
      
      if (!settings.useAccidentals) {
         // DIATONIC CHORDS ONLY
         // We construct the chord by stacking thirds within the scale
         // Find the index of the root in the scale (needs sorting to be safe?)
         // Simpler: Just check +3/+4 semitones and see if they are in scale
         
         // Major Third interval (4 semitones) or Minor Third (3)
         // Check +3
         if (diatonicPitchClasses.includes((root + 3) % 12)) {
             chordMidis.push(root + 3);
         } else if (diatonicPitchClasses.includes((root + 4) % 12)) {
             chordMidis.push(root + 4);
         } else {
             // Fallback/Retry if for some reason neither fits (rare in diatonic scales unless weird gap)
             i--; continue;
         }

         // Fifth (usually +7, sometimes +6 in diminished)
         if (diatonicPitchClasses.includes((root + 7) % 12)) {
             chordMidis.push(root + 7);
         } else if (diatonicPitchClasses.includes((root + 6) % 12)) {
             chordMidis.push(root + 6); // Diminished 5th
         }

         if (isSeventh) {
             // Major 7th (+11) or Minor 7th (+10) or Dim 7th (+9)
             if (diatonicPitchClasses.includes((root + 11) % 12)) chordMidis.push(root + 11);
             else if (diatonicPitchClasses.includes((root + 10) % 12)) chordMidis.push(root + 10);
             else if (diatonicPitchClasses.includes((root + 9) % 12)) chordMidis.push(root + 9);
         }

      } else {
        // Chromatic Chords (Random structure)
        const third = Math.random() > 0.5 ? 4 : 3; 
        chordMidis.push(root + third);
        chordMidis.push(root + 7); 
        if (isSeventh) {
            chordMidis.push(root + 10 + (Math.random() > 0.5 ? 1 : 0));
        }
      }

      // Ensure all notes are valid if strict mode (Diatonic logic above handles it, but double check)
      if (!settings.useAccidentals && chordMidis.some(m => !isValidNote(m))) {
          i--; continue;
      }

      const finalNotes = chordMidis.map(m => midiToNote(m, settings.keyRoot, settings.keyType)); 
      
      items.push({
        id: uuidv4(),
        notes: finalNotes,
        status: 'pending'
      });
    }
  }
  else if (settings.mode === 'beams') {
    // Generate 3-4 groups, each with 4-6 notes
    const numGroups = getRandomInt(3, 4);
    let currentBeamIndex = 0;
    
    for (let g = 0; g < numGroups; g++) {
        const groupSize = getRandomInt(4, 6);
        // Using 16th notes (semiquavers) for beam mode to create dense, fast-looking groups
        const duration = '16'; 
        
        for (let n = 0; n < groupSize; n++) {
            const midi = getValidRandomMidi(min, max);
            const note = midiToNote(midi, settings.keyRoot, settings.keyType);
            note.duration = duration;
            
            items.push({
                id: uuidv4(),
                notes: [note],
                status: 'pending',
                isBeamGroup: true,
                beamGroupIndex: currentBeamIndex
            });
        }
        currentBeamIndex++;
    }
  }

  return items;
};
