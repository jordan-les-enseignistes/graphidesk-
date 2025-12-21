import { create } from "zustand";

export interface ImportProgress {
  isRunning: boolean;
  fileName: string;
  currentSheet: string;
  currentRow: number;
  totalRows: number;
  percentage: number;
  results: {
    dossiers: { added: number; updated: number; unchanged: number; errors: number };
    franchises: { success: number; errors: number };
    projets: { success: number; errors: number };
  };
  error: string | null;
  isComplete: boolean;
}

interface ImportStore {
  progress: ImportProgress;
  startImport: (fileName: string, totalRows: number) => void;
  updateProgress: (updates: Partial<ImportProgress>) => void;
  setCurrentSheet: (sheet: string, rowCount: number) => void;
  incrementRow: () => void;
  addResult: (type: "dossiers" | "franchises" | "projets", action: string) => void;
  completeImport: () => void;
  setError: (error: string) => void;
  resetImport: () => void;
  dismissComplete: () => void;
}

const initialProgress: ImportProgress = {
  isRunning: false,
  fileName: "",
  currentSheet: "",
  currentRow: 0,
  totalRows: 0,
  percentage: 0,
  results: {
    dossiers: { added: 0, updated: 0, unchanged: 0, errors: 0 },
    franchises: { success: 0, errors: 0 },
    projets: { success: 0, errors: 0 },
  },
  error: null,
  isComplete: false,
};

export const useImportStore = create<ImportStore>((set, get) => ({
  progress: { ...initialProgress },

  startImport: (fileName, totalRows) => {
    set({
      progress: {
        ...initialProgress,
        isRunning: true,
        fileName,
        totalRows,
      },
    });
  },

  updateProgress: (updates) => {
    set((state) => ({
      progress: { ...state.progress, ...updates },
    }));
  },

  setCurrentSheet: (sheet, rowCount) => {
    const { progress } = get();
    set({
      progress: {
        ...progress,
        currentSheet: sheet,
        // Ne pas réinitialiser currentRow, on continue le comptage global
      },
    });
  },

  incrementRow: () => {
    const { progress } = get();
    const newRow = progress.currentRow + 1;
    const percentage = progress.totalRows > 0
      ? Math.min(Math.round((newRow / progress.totalRows) * 100), 100)
      : 0;
    set({
      progress: {
        ...progress,
        currentRow: newRow,
        percentage,
      },
    });
  },

  addResult: (type, action) => {
    const { progress } = get();
    const newResults = { ...progress.results };

    if (type === "dossiers") {
      if (action === "added") newResults.dossiers.added++;
      else if (action === "updated") newResults.dossiers.updated++;
      else if (action === "unchanged") newResults.dossiers.unchanged++;
      else if (action === "error") newResults.dossiers.errors++;
    } else if (type === "franchises") {
      if (action === "success") newResults.franchises.success++;
      else if (action === "error") newResults.franchises.errors++;
    } else if (type === "projets") {
      if (action === "success") newResults.projets.success++;
      else if (action === "error") newResults.projets.errors++;
    }

    set({
      progress: { ...progress, results: newResults },
    });
  },

  completeImport: () => {
    const { progress } = get();
    set({
      progress: {
        ...progress,
        isRunning: false,
        isComplete: true,
        percentage: 100,
      },
    });
  },

  setError: (error) => {
    const { progress } = get();
    set({
      progress: {
        ...progress,
        isRunning: false,
        error,
      },
    });
  },

  resetImport: () => {
    set({ progress: { ...initialProgress } });
  },

  dismissComplete: () => {
    set({ progress: { ...initialProgress } });
  },
}));
