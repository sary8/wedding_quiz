import { createSession } from "../../services/authService.js";

/**
 * テスト用のadminトークンを取得する。
 * authServiceを直接呼び出してトークンを発行。
 */
export function getTestAdminToken(): string {
  return createSession();
}

/**
 * テスト用のAuthorizationヘッダ付きheadersを返す
 */
export function authHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  return {
    Authorization: `Bearer ${getTestAdminToken()}`,
    ...extraHeaders,
  };
}

/**
 * Content-Type: application/json + Authorizationヘッダ
 */
export function authJsonHeaders(): Record<string, string> {
  return authHeaders({ "Content-Type": "application/json" });
}
