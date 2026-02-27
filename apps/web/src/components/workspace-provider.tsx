"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "./auth-provider";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  role: string;
  member_count: number;
  created_at: string;
}

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  loading: boolean;
  switchWorkspace: (id: string) => void;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  workspaces: [],
  activeWorkspace: null,
  loading: true,
  switchWorkspace: () => {},
  refreshWorkspaces: async () => {},
});

const STORAGE_KEY = "orqestra_active_workspace";
const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, token } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${apiUrl}/v1/workspaces`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const list: Workspace[] = data.workspaces ?? [];
      setWorkspaces(list);

      const savedId = localStorage.getItem(STORAGE_KEY);
      const saved = list.find((w) => w.id === savedId);
      if (saved) {
        setActiveId(saved.id);
      } else if (list.length > 0) {
        setActiveId(list[0].id);
        localStorage.setItem(STORAGE_KEY, list[0].id);
      }
    } catch {
      // network error – keep current state
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isLoggedIn) {
      fetchWorkspaces();
    } else {
      setWorkspaces([]);
      setActiveId(null);
      setLoading(false);
    }
  }, [isLoggedIn, fetchWorkspaces]);

  const switchWorkspace = useCallback(
    (id: string) => {
      const ws = workspaces.find((w) => w.id === id);
      if (ws) {
        setActiveId(id);
        localStorage.setItem(STORAGE_KEY, id);
      }
    },
    [workspaces],
  );

  const activeWorkspace = useMemo(
    () => workspaces.find((w) => w.id === activeId) ?? null,
    [workspaces, activeId],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspaces,
      activeWorkspace,
      loading,
      switchWorkspace,
      refreshWorkspaces: fetchWorkspaces,
    }),
    [workspaces, activeWorkspace, loading, switchWorkspace, fetchWorkspaces],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
