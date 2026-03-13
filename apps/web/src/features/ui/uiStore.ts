import { create } from "zustand";

export type UiModal = "characterSheet" | "inventory" | "skills";

interface UiStore {
	openModal: UiModal | null;
	open: (modal: UiModal) => void;
	close: () => void;
}

export const useUiStore = create<UiStore>((set) => ({
	openModal: null,
	open: (modal) => set({ openModal: modal }),
	close: () => set({ openModal: null }),
}));
