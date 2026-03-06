"use client";

import { createContext, useContext, useSyncExternalStore, useRef, type ReactNode } from "react";

interface NavbarSlotStore {
  content: ReactNode;
  subscribe: (cb: () => void) => () => void;
  getSnapshot: () => ReactNode;
  set: (node: ReactNode) => void;
}

function createNavbarSlotStore(): NavbarSlotStore {
  let content: ReactNode = null;
  const listeners = new Set<() => void>();
  return {
    get content() { return content; },
    subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    getSnapshot() { return content; },
    set(node) { content = node; listeners.forEach((l) => l()); },
  };
}

const NavbarSlotContext = createContext<NavbarSlotStore | null>(null);

export function NavbarSlotProvider({ children }: { children: ReactNode }) {
  const storeRef = useRef<NavbarSlotStore>();
  if (!storeRef.current) storeRef.current = createNavbarSlotStore();
  return (
    <NavbarSlotContext.Provider value={storeRef.current}>
      {children}
    </NavbarSlotContext.Provider>
  );
}

export function useNavbarSlot() {
  const store = useContext(NavbarSlotContext);
  if (!store) throw new Error("useNavbarSlot must be used within NavbarSlotProvider");
  return store.set;
}

export function useNavbarSlotContent(): ReactNode {
  const store = useContext(NavbarSlotContext);
  if (!store) return null;
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => null);
}
