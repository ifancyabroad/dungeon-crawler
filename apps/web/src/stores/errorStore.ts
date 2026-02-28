import { create } from "zustand";

interface ErrorStoreState {
	/** Current error message to show in the error modal; null when closed. */
	error: string | null;
}

interface ErrorStoreActions {
	showError: (message: string) => void;
	closeError: () => void;
}

export type ErrorStore = ErrorStoreState & ErrorStoreActions;

const initialState: ErrorStoreState = {
	error: null,
};

export const useErrorStore = create<ErrorStore>((set) => ({
	...initialState,

	showError: (message) => set({ error: message }),
	closeError: () => set({ error: null }),
}));
