import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { api, TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY } from '../api/client';
import { registerPushNotifications, unregisterPushNotifications } from '../services/notifications';
import { runAutoBackupIfDue } from '../services/backupService';

type AuthContextValue = {
  user: any | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (
    emailOrUsername: string,
    password: string,
    twoStepPin?: string
  ) => Promise<{ requiresTwoStep?: boolean } | void>;
  register: (data: any) => Promise<any>;
  verifyOTP: (email: string, otp: string) => Promise<void>;
  resendOTP: (email: string) => Promise<any>;
  forgotPassword: (email: string) => Promise<any>;
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<void>;
  updateProfile: (updates: any) => Promise<any>;
  requestEmailChange: (newEmail: string) => Promise<any>;
  verifyEmailChange: (otp: string) => Promise<any>;
  syncUser: (nextUser: any) => Promise<void>;
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
          runAutoBackupIfDue().catch(() => {});
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

  const login = async (emailOrUsername: string, password: string, twoStepPin?: string) => {
    const response = await api.post('/auth/login', {
      emailOrUsername,
      password,
      ...(twoStepPin ? { twoStepPin } : {}),
      deviceName: Device.modelName || Device.deviceName || 'Mobile Device',
      platform: Platform.OS,
    });
    if (response.data?.requiresTwoStep) {
      return { requiresTwoStep: true };
    }
    await saveSession(response.data.data);
    return { requiresTwoStep: false };
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

  const syncUser = async (nextUser: any) => {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
  };

  const updateProfile = async (updates: any) => {
    const response = await api.put('/auth/profile', updates);
    const nextUser = response.data.data.user;
    await syncUser(nextUser);
    return nextUser;
  };

  const requestEmailChange = async (newEmail: string) => {
    const response = await api.post('/auth/email/request-change', { newEmail });
    return response.data;
  };

  const verifyEmailChange = async (otp: string) => {
    const response = await api.post('/auth/email/verify-change', { otp });
    const nextUser = response.data.data.user;
    await syncUser(nextUser);
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
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, register, verifyOTP, resendOTP, forgotPassword, resetPassword, updateProfile, requestEmailChange, verifyEmailChange, syncUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
