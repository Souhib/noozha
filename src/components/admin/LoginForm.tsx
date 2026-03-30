import { type FormEvent, useState } from "react";
import { cn } from "@/lib/utils";
import { signin } from "@/lib/nocodb";

interface LoginFormProps {
  onLogin: (token: string) => void;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const token = await signin(email, password);
      onLogin(token);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erreur de connexion",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-gray-950 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-gray-900 rounded-xl p-8 shadow-lg"
      >
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          Noozha Admin
        </h1>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-900/50 border border-red-700 text-red-300 text-sm">
            {error}
          </div>
        )}

        <label className="block mb-4">
          <span className="text-gray-400 text-sm mb-1 block">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg px-4 py-2.5 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none"
            placeholder="admin@noozha.fr"
          />
        </label>

        <label className="block mb-6">
          <span className="text-gray-400 text-sm mb-1 block">Mot de passe</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-500 rounded-lg px-4 py-2.5 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 outline-none"
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className={cn(
            "w-full bg-cyan-600 hover:bg-cyan-500 text-white font-medium rounded-lg py-2.5 transition-colors",
            loading && "opacity-60 cursor-not-allowed",
          )}
        >
          {loading ? "Connexion..." : "Se connecter"}
        </button>
      </form>
    </div>
  );
}
