"use client";

import { useLocalStorage, useTheme } from "@/lib/hooks";
import { TokenScreen, Dashboard } from "@/lib/components";

export default function Home() {
  const [token, setToken] = useLocalStorage<string | null>("gh-dashboard-token", null);
  const [theme, setTheme] = useTheme();

  if (!token) return <TokenScreen onConnect={setToken} theme={theme} setTheme={setTheme} />;
  return <Dashboard token={token} onDisconnect={() => setToken(null)} theme={theme} setTheme={setTheme} />;
}
