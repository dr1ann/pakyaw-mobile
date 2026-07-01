import { create } from 'zustand';

export type PipState = {
  readonly isInPip: boolean;
  readonly isSupported: boolean;
};

export type UiState = {
  readonly pip: PipState;
  setPipState: (pip: Partial<PipState>) => void;
  resetPip: () => void;
};

const initialPipState: PipState = {
  isInPip: false,
  isSupported: false,
};

export const useUiStore = create<UiState>((set) => ({
  pip: initialPipState,
  setPipState: (pip) =>
    set((state) => ({
      pip: {
        ...state.pip,
        ...pip,
      },
    })),
  resetPip: () => set({ pip: initialPipState }),
}));
