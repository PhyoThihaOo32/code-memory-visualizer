import { create } from 'zustand';
import type { Snapshot, Language } from './types';

export type PlayState = 'idle' | 'running' | 'paused' | 'finished';

type Store = {
  snapshots: Snapshot[];
  stepIndex: number;
  playState: PlayState;
  speed: number;
  pyodideReady: boolean;
  pyodideError: string | null;
  code: string;
  stdout: string;
  error: string | null;
  selectedExample: string;
  language: Language;

  setSnapshots: (s: Snapshot[]) => void;
  setStepIndex: (i: number) => void;
  stepForward: () => void;
  stepBack: () => void;
  setPlayState: (s: PlayState) => void;
  setSpeed: (s: number) => void;
  setPyodideReady: (r: boolean) => void;
  setPyodideError: (e: string | null) => void;
  setCode: (c: string) => void;
  setStdout: (s: string) => void;
  setError: (e: string | null) => void;
  setSelectedExample: (id: string) => void;
  setLanguage: (l: Language) => void;
  reset: () => void;
};

export const useStore = create<Store>((set, get) => ({
  snapshots: [],
  stepIndex: 0,
  playState: 'idle',
  speed: 1,
  pyodideReady: false,
  pyodideError: null,
  code: '',
  stdout: '',
  error: null,
  selectedExample: 'py_factorial',
  language: 'python',

  setSnapshots: (snapshots) => set({ snapshots, stepIndex: 0 }),
  setStepIndex: (stepIndex) => set({ stepIndex }),
  stepForward: () => {
    const { stepIndex, snapshots } = get();
    if (stepIndex < snapshots.length - 1) set({ stepIndex: stepIndex + 1 });
    else set({ playState: 'finished' });
  },
  stepBack: () => {
    const { stepIndex } = get();
    if (stepIndex > 0) set({ stepIndex: stepIndex - 1 });
  },
  setPlayState: (playState) => set({ playState }),
  setSpeed: (speed) => set({ speed }),
  setPyodideReady: (pyodideReady) => set({ pyodideReady }),
  setPyodideError: (pyodideError) => set({ pyodideError }),
  setCode: (code) => set({ code }),
  setStdout: (stdout) => set({ stdout }),
  setError: (error) => set({ error }),
  setSelectedExample: (selectedExample) => set({ selectedExample }),
  setLanguage: (language) => set({ language }),
  reset: () => set({ snapshots: [], stepIndex: 0, playState: 'idle', stdout: '', error: null }),
}));
