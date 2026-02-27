"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";

interface AuthContextValue {
  hydrated: boolean;
  isLoggedIn: boolean;
  userEmail: string | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  hydrated: false,
  isLoggedIn: false,
  userEmail: null,
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem("orqestra_token"));
    setUserEmail(localStorage.getItem("orqestra_user"));
    setHydrated(true);
  }, []);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "orqestra_token") {
        setToken(e.newValue);
      }
      if (e.key === "orqestra_user") {
        setUserEmail(e.newValue);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("orqestra_token");
    localStorage.removeItem("orqestra_user");
    setToken(null);
    setUserEmail(null);
    router.push("/login");
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      hydrated,
      isLoggedIn: hydrated && !!token,
      userEmail,
      logout,
    }),
    [hydrated, token, userEmail, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
