import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { api } from '../api/client';

const APP_LOCK_KEY = 'chatapp_biometric_lock_enabled';

export type VisibilityLevel = 'everyone' | 'contacts' | 'nobody';

export type PrivacySettings = {
  lastSeenVisibility: VisibilityLevel;
  onlineStatusVisibility: VisibilityLevel;
  profilePhotoVisibility: VisibilityLevel;
  statusVisibility: VisibilityLevel;
};

export type ActiveSession = {
  sessionId: string;
  deviceName: string;
  platform: string;
  ipAddress?: string;
  lastActiveAt: string;
  createdAt: string;
};

export type SecurityOverview = {
  twoStepEnabled: boolean;
  privacySettings: PrivacySettings;
  blockedUsers: Array<{ _id: string; username: string; avatar?: string }>;
  activeSessions: ActiveSession[];
  currentSessionId: string | null;
};

export async function getSecurityOverview(): Promise<SecurityOverview> {
  const response = await api.get('/security/overview');
  return response.data.data;
}

export async function enableTwoStepPin(pin: string): Promise<void> {
  await api.post('/security/two-step/enable', { pin });
}

export async function disableTwoStepPin(pin: string): Promise<void> {
  await api.post('/security/two-step/disable', { pin });
}

export async function updatePrivacySettings(
  updates: Partial<PrivacySettings>
): Promise<PrivacySettings> {
  const response = await api.put('/security/privacy', updates);
  return response.data.data.privacySettings;
}

export async function blockUser(userId: string) {
  const response = await api.post(`/security/block/${userId}`);
  return response.data.data.blockedUsers;
}

export async function unblockUser(userId: string) {
  const response = await api.delete(`/security/block/${userId}`);
  return response.data.data.blockedUsers;
}

export async function revokeSession(sessionId: string): Promise<ActiveSession[]> {
  const response = await api.delete(`/security/sessions/${sessionId}`);
  return response.data.data.sessions;
}

export async function logoutAllDevices(): Promise<void> {
  await api.post('/security/logout-all');
}

// ─── Biometric App Lock ───────────────────────────────────────────────────────

export async function isBiometricSupported(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  } catch {
    return false;
  }
}

export async function getAppLockEnabled(): Promise<boolean> {
  try {
    const val = await SecureStore.getItemAsync(APP_LOCK_KEY);
    return val === 'true';
  } catch {
    return false;
  }
}

export async function setAppLockEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(APP_LOCK_KEY, enabled ? 'true' : 'false');
}

export async function promptBiometricUnlock(): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock ChatApp',
      fallbackLabel: 'Use Device Passcode',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}
