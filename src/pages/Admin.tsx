import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { UnauthorizedError, getSchema } from "@/lib/nocodb";
import { LoginForm } from "@/components/admin/LoginForm";
import { ReservationForm } from "@/components/admin/ReservationForm";
import { ReservationList } from "@/components/admin/ReservationList";

const SESSION_KEY = "nc_token";

type Tab = "form" | "list";

export default function Admin() {
  const [token, setToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("form");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) {
      setChecking(false);
      return;
    }
    getSchema(stored)
      .then(() => setToken(stored))
      .catch((err) => {
        if (err instanceof UnauthorizedError) {
          sessionStorage.removeItem(SESSION_KEY);
        }
      })
      .finally(() => setChecking(false));
  }, []);

  function handleLogin(newToken: string) {
    sessionStorage.setItem(SESSION_KEY, newToken);
    setToken(newToken);
  }

  const handleUnauthorized = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setToken(null);
  }, []);

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY);
    setToken(null);
  }

  function handleCreated() {
    setRefreshKey((k) => k + 1);
  }

  if (checking) {
    return (
      <div className="h-dvh bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!token) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-dvh bg-gray-950 text-gray-100">
      <header className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">Noozha Admin</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          Deconnexion
        </button>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <nav className="flex gap-1 mb-6 bg-gray-900 rounded-lg p-1 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab("form")}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === "form"
                ? "bg-cyan-600 text-white"
                : "text-gray-400 hover:text-white",
            )}
          >
            Nouvelle Reservation
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("list")}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors",
              activeTab === "list"
                ? "bg-cyan-600 text-white"
                : "text-gray-400 hover:text-white",
            )}
          >
            Reservations
          </button>
        </nav>

        {activeTab === "form" ? (
          <ReservationForm
            token={token}
            onUnauthorized={handleUnauthorized}
            onCreated={handleCreated}
          />
        ) : (
          <ReservationList
            token={token}
            onUnauthorized={handleUnauthorized}
            refreshKey={refreshKey}
          />
        )}
      </div>
    </div>
  );
}
