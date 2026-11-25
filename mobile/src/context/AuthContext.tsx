import React, { createContext, useContext, useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { api, TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY } from '../api/client';
import { registerPushNotifications, unregisterPushNotifications } from '../services/notifications';

type AuthContextValue = {
  user: any | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (emailOrUsername: string, password: string) => Promise<void>;
  register: (data: any) => Promise<any>;
  verifyOTP: (email: string, otp: string) => Promise<void>;
  resendOTP: (email: string) => Promise<any>;
  forgotPassword: (email: string) => Promise<any>;
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<void>;
  updateProfile: (updates: any) => Promise<any>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY);
        const savedUser = await SecureStore.getItemAsync(USER_KEY);
        if (token) {
          setAccessToken(token);
          if (savedUser) setUser(JSON.parse(savedUser));
          const response = await api.get('/auth/me');
          const currentUser = response.data.data.user;
          setUser(currentUser);
          await SecureStore.setItemAsync(USER_KEY, JSON.stringify(currentUser));
          registerPushNotifications().catch(() => {});
        }
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
        await SecureStore.deleteItemAsync(USER_KEY);
        setUser(null);
        setAccessToken(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const saveSession = async (data: any) => {
    const { user: nextUser, accessToken: nextAccess, refreshToken: nextRefresh } = data;
    await SecureStore.setItemAsync(TOKEN_KEY, nextAccess);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, nextRefresh);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(nextUser));
    setAccessToken(nextAccess);
    setUser(nextUser);
    registerPushNotifications().catch(() => {});
  };

  const login = async (emailOrUsername: string, password: string) => {
    const response = await api.post('/auth/login', { emailOrUsername, password });
    await saveSession(response.data.data);
  };

  const register = async (data: any) => {
    const response = await api.post('/auth/register', data);
    return response.data;
  };

  const verifyOTP = async (email: string, otp: string) => {
    const response = await api.post('/auth/verify-otp', { email, otp });
    await saveSession(response.data.data);
  };

  const resendOTP = async (email: string) => {
    const response = await api.post('/auth/resend-otp', { email });
    return response.data;
  };

  const forgotPassword = async (email: string) => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  };

  const resetPassword = async (email: string, otp: string, newPassword: string) => {
    const response = await api.post('/auth/reset-password', { email, otp, newPassword });
    await saveSession(response.data.data);
  };

  const updateProfile = async (updates: any) => {
    const response = await api.put('/auth/profile', updates);
    const nextUser = response.data.data.user;
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    return nextUser;
  };

  const logout = async () => {
    try { await unregisterPushNotifications(); } catch {}
    try { await api.post('/auth/logout'); } catch {}
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    setUser(null);
    setAccessToken(null);
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, register, verifyOTP, resendOTP, forgotPassword, resetPassword, updateProfile, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
