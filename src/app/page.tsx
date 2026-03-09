"use client";

import { useLocalStorage } from "@/lib/hooks";
import { TokenScreen, Dashboard } from "@/lib/components";

export default function Home() {
  const [token, setToken] = useLocalStorage<string | null>("gh-dashboard-token", null);

  if (!token) return <TokenScreen onConnect={setToken} />;
  return <Dashboard token={token} onDisconnect={() => setToken(null)} />;
}
