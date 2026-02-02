import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import type { AuthState, User, LoginCredentials, SignupCredentials, AuthTokens } from '@/lib/auth/types';
import { storeTokens, storeUser, getStoredTokens, getStoredUser, clearAuthData, isTokenExpired, shouldRefreshToken } from '@/lib/auth/types';
import { generateIdentityKeyPair, exportKeyPair, createKeyBackup, restoreKeyFromBackup, type KeyPair, type EncryptedKeyBackup } from '@/lib/crypto';
import { storeKeyPair, getKeyPair, deleteKeyPair } from '@/lib/storage/indexeddb';

// Actions
type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'AUTH_FAILURE'; payload: string }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'CLEAR_ERROR' };

// Initial state
const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

// Reducer
function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_START':
      return { ...state, isLoading: true, error: null };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };
    case 'AUTH_LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
}

// Context types
interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  signup: (credentials: SignupCredentials) => Promise<{ keyBackup: EncryptedKeyBackup }>;
  loginWithGoogle: () => Promise<void>;
  loginWithGithub: () => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  getKeyPair: () => Promise<KeyPair | null>;
  createKeyBackup: (password: string) => Promise<EncryptedKeyBackup>;
  restoreFromBackup: (backup: EncryptedKeyBackup, password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Mock API functions (replace with real API calls)
async function mockLogin(_credentials: LoginCredentials): Promise<{ user: User; tokens: AuthTokens }> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Generate demo user
  const keyPair = await generateIdentityKeyPair();
  const exported = await exportKeyPair(keyPair);
  
  return {
    user: {
      id: 'demo-user-' + Date.now(),
      email: _credentials.email,
      username: _credentials.email.split('@')[0],
      displayName: _credentials.email.split('@')[0],
      publicKey: exported.publicKey,
      fingerprint: keyPair.fingerprint,
      createdAt: Date.now(),
    },
    tokens: {
      accessToken: 'demo.access.token.' + Date.now(),
      refreshToken: 'demo.refresh.token.' + Date.now(),
      expiresAt: Date.now() + 3600000, // 1 hour
    },
  };
}

async function mockSignup(_credentials: SignupCredentials): Promise<{ user: User; tokens: AuthTokens; keyPair: KeyPair }> {
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  const keyPair = await generateIdentityKeyPair();
  const exported = await exportKeyPair(keyPair);
  
  return {
    user: {
      id: 'user-' + Date.now(),
      email: _credentials.email,
      username: _credentials.username,
      displayName: _credentials.displayName,
      publicKey: exported.publicKey,
      fingerprint: keyPair.fingerprint,
      createdAt: Date.now(),
    },
    tokens: {
      accessToken: 'demo.access.token.' + Date.now(),
      refreshToken: 'demo.refresh.token.' + Date.now(),
      expiresAt: Date.now() + 3600000,
    },
    keyPair,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check for existing session on mount
  useEffect(() => {
    const initAuth = async () => {
      const tokens = getStoredTokens();
      const user = getStoredUser();

      if (tokens && user && !isTokenExpired(tokens)) {
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: { user, token: tokens.accessToken },
        });
      } else {
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    initAuth();
  }, []);

  // Token refresh check
  useEffect(() => {
    if (!state.isAuthenticated) return;

    const tokens = getStoredTokens();
    if (!tokens) return;

    if (shouldRefreshToken(tokens)) {
      // In real app, call refresh endpoint
      console.log('Token should be refreshed');
    }

    const interval = setInterval(() => {
      const currentTokens = getStoredTokens();
      if (currentTokens && shouldRefreshToken(currentTokens)) {
        console.log('Token should be refreshed');
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [state.isAuthenticated]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    dispatch({ type: 'AUTH_START' });

    try {
      const { user, tokens } = await mockLogin(credentials);
      
      storeTokens(tokens);
      storeUser(user);

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user, token: tokens.accessToken },
      });
    } catch (error) {
      dispatch({
        type: 'AUTH_FAILURE',
        payload: error instanceof Error ? error.message : 'Login failed',
      });
      throw error;
    }
  }, []);

  const signup = useCallback(async (credentials: SignupCredentials) => {
    dispatch({ type: 'AUTH_START' });

    try {
      const { user, tokens, keyPair } = await mockSignup(credentials);
      
      storeTokens(tokens);
      storeUser(user);

      // Create key backup with user's password
      const backup = await createKeyBackup(keyPair, credentials.password);
      
      // Store encrypted key pair locally
      const exported = await exportKeyPair(keyPair);
      await storeKeyPair({
        id: 'identity',
        publicKey: exported.publicKey,
        encryptedPrivateKey: backup.encryptedPrivateKey,
        salt: backup.salt,
        iv: backup.iv,
        fingerprint: keyPair.fingerprint,
        createdAt: Date.now(),
      });

      dispatch({
        type: 'AUTH_SUCCESS',
        payload: { user, token: tokens.accessToken },
      });

      return { keyBackup: backup };
    } catch (error) {
      dispatch({
        type: 'AUTH_FAILURE',
        payload: error instanceof Error ? error.message : 'Signup failed',
      });
      throw error;
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    dispatch({ type: 'AUTH_START' });
    // In real app, redirect to OAuth flow
    await new Promise(resolve => setTimeout(resolve, 500));
    dispatch({
      type: 'AUTH_FAILURE',
      payload: 'Connect to backend to enable Google login',
    });
  }, []);

  const loginWithGithub = useCallback(async () => {
    dispatch({ type: 'AUTH_START' });
    await new Promise(resolve => setTimeout(resolve, 500));
    dispatch({
      type: 'AUTH_FAILURE',
      payload: 'Connect to backend to enable GitHub login',
    });
  }, []);

  const logout = useCallback(async () => {
    clearAuthData();
    await deleteKeyPair('identity');
    dispatch({ type: 'AUTH_LOGOUT' });
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: 'CLEAR_ERROR' });
  }, []);

  const getUserKeyPair = useCallback(async (): Promise<KeyPair | null> => {
    const stored = await getKeyPair('identity');
    if (!stored) return null;

    // In real app, decrypt and return key pair
    // For demo, generate new one
    return generateIdentityKeyPair();
  }, []);

  const createBackup = useCallback(async (password: string): Promise<EncryptedKeyBackup> => {
    const keyPair = await getUserKeyPair();
    if (!keyPair) {
      throw new Error('No key pair found');
    }
    return createKeyBackup(keyPair, password);
  }, [getUserKeyPair]);

  const restoreFromBackup = useCallback(async (backup: EncryptedKeyBackup, password: string) => {
    const keyPair = await restoreKeyFromBackup(backup, password);
    const exported = await exportKeyPair(keyPair);
    
    await storeKeyPair({
      id: 'identity',
      publicKey: exported.publicKey,
      encryptedPrivateKey: backup.encryptedPrivateKey,
      salt: backup.salt,
      iv: backup.iv,
      fingerprint: keyPair.fingerprint,
      createdAt: Date.now(),
    });
  }, []);

  const value: AuthContextType = {
    ...state,
    login,
    signup,
    loginWithGoogle,
    loginWithGithub,
    logout,
    clearError,
    getKeyPair: getUserKeyPair,
    createKeyBackup: createBackup,
    restoreFromBackup,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
