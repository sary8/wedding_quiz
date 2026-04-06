import { useState } from "react";
import { createAdminSession } from "../../services/api";

type Props = {
  isPinRequired: boolean;
  onAuthenticated: () => void;
};

export function AdminLoginForm({ isPinRequired, onAuthenticated }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await createAdminSession(isPinRequired ? pin : undefined);
      onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "認証に失敗しました");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl shadow-sm p-8 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Wedding Quiz</h1>
        <p className="text-gray-500 text-sm text-center mb-6">管理画面にアクセスするには認証が必要です</p>

        {error && (
          <div role="alert" className="p-3 mb-4 rounded-lg bg-red-50 text-red-800 text-sm border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {isPinRequired && (
            <div className="mb-4">
              <label htmlFor="admin-pin" className="block text-sm font-medium text-gray-700 mb-1">
                管理者PIN
              </label>
              <input
                id="admin-pin"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="PINを入力"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 text-center text-lg font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                disabled={isLoading}
              />
            </div>
          )}
          <button
            type="submit"
            disabled={isLoading || (isPinRequired && !pin)}
            className="w-full bg-gradient-to-r from-primary to-primary-dark text-white font-bold py-3 px-6 rounded-xl hover:opacity-90 transition-opacity duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isLoading ? "認証中..." : isPinRequired ? "ログイン" : "管理画面を開く"}
          </button>
        </form>
      </div>
    </div>
  );
}
