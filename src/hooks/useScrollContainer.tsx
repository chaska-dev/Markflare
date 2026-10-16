import { createContext, useContext, RefObject } from 'react';

// Layout owns the real scroller (`.main-content`, not window). Sharing its ref
// through context avoids repeated document.querySelector calls in children.
export const ScrollContainerContext = createContext<RefObject<HTMLElement> | null>(null);

const EMPTY_REF: RefObject<HTMLElement> = { current: null };

// Returns a ref to the main scroll container; `.current` is null outside Layout.
export function useScrollContainer(): RefObject<HTMLElement> {
  return useContext(ScrollContainerContext) ?? EMPTY_REF;
}
