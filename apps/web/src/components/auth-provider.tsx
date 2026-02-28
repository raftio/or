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
  token: string | null;
  userEmail: string | null;
  userName: string | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  hydrated: false,
  isLoggedIn: false,
  token: null,
  userEmail: null,
  userName: null,
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("orca_token");
    const e = localStorage.getItem("orca_user");
    const n = localStorage.getItem("orca_user_name");
    setToken(t);
    setUserEmail(e);
    setUserName(n);
    setHydrated(true);

    if (t && (!e || !n)) {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      fetch(`${apiUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${t}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (!data?.user) return;
          if (data.user.email) {
            localStorage.setItem("orca_user", data.user.email);
            setUserEmail(data.user.email);
          }
          if (data.user.name) {
            localStorage.setItem("orca_user_name", data.user.name);
            setUserName(data.user.name);
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "orca_token") {
        setToken(e.newValue);
      }
      if (e.key === "orca_user") {
        setUserEmail(e.newValue);
      }
      if (e.key === "orca_user_name") {
        setUserName(e.newValue);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("orca_token");
    localStorage.removeItem("orca_user");
    localStorage.removeItem("orca_user_name");
    setToken(null);
    setUserEmail(null);
    setUserName(null);
    router.push("/login");
  }, [router]);

  const value = useMemo<AuthContextValue>(
    () => ({
      hydrated,
      isLoggedIn: hydrated && !!token,
      token,
      userEmail,
      userName,
      logout,
    }),
    [hydrated, token, userEmail, userName, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
