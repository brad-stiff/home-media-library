import { DockType } from './libraryView';

let pending: DockType | null = null;

export function queueLibraryTab(tab: DockType) {
  pending = tab;
}

export function takeLibraryTab(): DockType | null {
  const tab = pending;
  pending = null;
  return tab;
}
