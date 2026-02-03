// Authentication Types and State Management

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatar?: string;
  publicKey: string;
  fingerprint: string;
  createdAt: number;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignupCredentials {
  email: string;
  password: string;
  username: string;
  displayName: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

// Token storage keys
const ACCESS_TOKEN_KEY = 'chit_chat_access_token';
const REFRESH_TOKEN_KEY = 'chit_chat_refresh_token';
const USER_KEY = 'chit_chat_user';

/**
 * Store auth tokens securely
 */
export function storeTokens(tokens: AuthTokens): void {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

/**
 * Get stored tokens
 */
export function getStoredTokens(): AuthTokens | null {
  const accessToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);

  if (!accessToken || !refreshToken) {
    return null;
  }

  // Parse JWT to get expiration
  try {
    const payload = JSON.parse(atob(accessToken.split('.')[1]));
    return {
      accessToken,
      refreshToken,
      expiresAt: payload.exp * 1000,
    };
  } catch {
    return null;
  }
}

/**
 * Store user data
 */
export function storeUser(user: User): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Get stored user
 */
export function getStoredUser(): User | null {
  const data = localStorage.getItem(USER_KEY);
  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Clear all auth data
 */
export function clearAuthData(): void {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Check if token is expired
 */
export function isTokenExpired(tokens: AuthTokens): boolean {
  // Add 30 second buffer
  return Date.now() >= tokens.expiresAt - 30000;
}

/**
 * Check if tokens need refresh
 */
export function shouldRefreshToken(tokens: AuthTokens): boolean {
  // Refresh if less than 5 minutes until expiration
  return Date.now() >= tokens.expiresAt - 5 * 60 * 1000;
}
