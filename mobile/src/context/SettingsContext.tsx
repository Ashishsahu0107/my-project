import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../api/client';
import { useAuth } from './AuthContext';
import { registerPushNotifications, unregisterPushNotifications } from '../services/notifications';

const SETTINGS_STORAGE_KEY = 'chatapp_app_settings';

export type ThemeMode = 'light' | 'dark' | 'system';
export type AppLanguage = 'en' | 'hi' | 'es' | 'fr';
export type FontSizeOption = 'small' | 'medium' | 'large';

export type AppSettings = {
  theme: ThemeMode;
  language: AppLanguage;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  chatWallpaper: string;
  fontSize: FontSizeOption;
  autoDownloadMedia: boolean;
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  theme: 'dark',
  language: 'en',
  notificationsEnabled: true,
  soundEnabled: true,
  vibrationEnabled: true,
  chatWallpaper: 'default',
  fontSize: 'medium',
  autoDownloadMedia: true,
};

export const WALLPAPER_OPTIONS = [
  { id: 'default', label: 'Default', darkColor: '#020617', lightColor: '#F8FAFC' },
  { id: 'midnight', label: 'Midnight', darkColor: '#0B1120', lightColor: '#EEF2FF' },
  { id: 'forest', label: 'Forest', darkColor: '#052E16', lightColor: '#ECFDF5' },
  { id: 'ocean', label: 'Ocean', darkColor: '#082F49', lightColor: '#F0F9FF' },
  { id: 'plum', label: 'Plum', darkColor: '#2E1065', lightColor: '#FAF5FF' },
];

const TRANSLATIONS: Record<AppLanguage, Record<string, string>> = {
  en: {
    settings: 'App Settings',
    appearance: 'Appearance',
    theme: 'Theme',
    language: 'Language',
    notifications: 'Notifications & Sound',
    pushNotifications: 'Push Notifications',
    sound: 'Message Sound',
    vibration: 'Vibration',
    wallpaper: 'Chat Wallpaper',
    fontSize: 'Font Size',
    storage: 'Data & Storage',
    autoDownload: 'Auto-Download Media',
    clearCache: 'Clear Cached Data',
    shortcuts: 'Shortcuts',
    privacySecurity: 'Privacy & Security',
    backupSync: 'Backup & Sync',
    profileAccount: 'Profile & Account',
    send: 'Send',
    save: 'Save',
    typeMessage: 'Message',
  },
  hi: {
    settings: 'ऐप सेटिंग्स',
    appearance: 'दिखावट',
    theme: 'थीम',
    language: 'भाषा',
    notifications: 'सूचनाएं और ध्वनि',
    pushNotifications: 'पुश नोटिफिकेशन',
    sound: 'संदेश ध्वनि',
    vibration: 'कंपन',
    wallpaper: 'चैट वॉलपेपर',
    fontSize: 'फ़ॉन्ट आकार',
    storage: 'डेटा और स्टोरेज',
    autoDownload: 'मीडिया ऑटो-डाउनलोड',
    clearCache: 'कैश डेटा साफ़ करें',
    shortcuts: 'शॉर्टकट',
    privacySecurity: 'गोपनीयता और सुरक्षा',
    backupSync: 'बैकअप और सिंक',
    profileAccount: 'प्रोफ़ाइल और खाता',
    send: 'भेजें',
    save: 'सहेजें',
    typeMessage: 'संदेश लिखें',
  },
  es: {
    settings: 'Ajustes de la App',
    appearance: 'Apariencia',
    theme: 'Tema',
    language: 'Idioma',
    notifications: 'Notificaciones y Sonido',
    pushNotifications: 'Notificaciones Push',
    sound: 'Sonido de mensajes',
    vibration: 'Vibración',
    wallpaper: 'Fondo de chat',
    fontSize: 'Tamaño de fuente',
    storage: 'Datos y Almacenamiento',
    autoDownload: 'Descarga automática',
    clearCache: 'Limpiar caché',
    shortcuts: 'Accesos directos',
    privacySecurity: 'Privacidad y Seguridad',
    backupSync: 'Copia y Sincronización',
    profileAccount: 'Perfil y Cuenta',
    send: 'Enviar',
    save: 'Guardar',
    typeMessage: 'Mensaje',
  },
  fr: {
    settings: 'Paramètres',
    appearance: 'Apparence',
    theme: 'Thème',
    language: 'Langue',
    notifications: 'Notifications et Son',
    pushNotifications: 'Notifications Push',
    sound: 'Son des messages',
    vibration: 'Vibration',
    wallpaper: 'Fond de discussion',
    fontSize: 'Taille de police',
    storage: 'Données et Stockage',
    autoDownload: 'Téléchargement auto',
    clearCache: 'Vider le cache',
    shortcuts: 'Raccourcis',
    privacySecurity: 'Confidentialité et Sécurité',
    backupSync: 'Sauvegarde et Synchro',
    profileAccount: 'Profil et Compte',
    send: 'Envoyer',
    save: 'Enregistrer',
    typeMessage: 'Message',
  },
};

type SettingsContextValue = {
  settings: AppSettings;
  resolvedTheme: 'light' | 'dark';
  wallpaperColor: string;
  messageFontSize: number;
  colors: {
    bg: string;
    card: string;
    border: string;
    text: string;
    muted: string;
    otherBubble: string;
  };
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  applySyncedSettings: (remote: Partial<AppSettings>) => Promise<void>;
  clearLocalCache: () => Promise<number>;
  t: (key: string) => string;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user, accessToken } = useAuth();
  const systemScheme = useColorScheme();
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (raw) {
          setSettings((prev) => ({ ...prev, ...JSON.parse(raw) }));
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!user || !accessToken) return;
    (async () => {
      try {
        const response = await api.get('/settings');
        const remote = response.data?.data?.settings;
        if (remote) {
          const merged = { ...DEFAULT_APP_SETTINGS, ...remote };
          setSettings(merged);
          await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
        }
      } catch {
        // Offline fallback uses AsyncStorage
      }
    })();
  }, [user?.id, accessToken]);

  const applySyncedSettings = async (remote: Partial<AppSettings>) => {
    const merged = { ...settings, ...remote };
    setSettings(merged);
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged)).catch(() => {});
  };

  const updateSettings = async (partial: Partial<AppSettings>) => {
    const next = { ...settings, ...partial };
    setSettings(next);
    await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next)).catch(() => {});

    if (partial.notificationsEnabled !== undefined) {
      if (partial.notificationsEnabled) {
        registerPushNotifications().catch(() => {});
      } else {
        unregisterPushNotifications().catch(() => {});
      }
    }

    if (user && accessToken) {
      await api.put('/settings', partial).catch(() => {});
    }
  };

  const clearLocalCache = async (): Promise<number> => {
    const keys = await AsyncStorage.getAllKeys();
    const removable = keys.filter((k) => k !== SETTINGS_STORAGE_KEY);
    if (removable.length > 0) {
      await Promise.all(removable.map((k) => AsyncStorage.removeItem(k)));
    }
    return removable.length;
  };

  const resolvedTheme: 'light' | 'dark' =
    settings.theme === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : settings.theme;

  const wallpaperColor = useMemo(() => {
    const found =
      WALLPAPER_OPTIONS.find((w) => w.id === settings.chatWallpaper) || WALLPAPER_OPTIONS[0];
    return resolvedTheme === 'light' ? found.lightColor : found.darkColor;
  }, [settings.chatWallpaper, resolvedTheme]);

  const messageFontSize =
    settings.fontSize === 'small' ? 12 : settings.fontSize === 'large' ? 17 : 14;

  const colors = useMemo(
    () =>
      resolvedTheme === 'light'
        ? {
            bg: '#F8FAFC',
            card: '#FFFFFF',
            border: '#E2E8F0',
            text: '#0F172A',
            muted: '#64748B',
            otherBubble: '#FFFFFF',
          }
        : {
            bg: '#020617',
            card: '#0F172A',
            border: '#1E293B',
            text: '#F8FAFC',
            muted: '#94A3B8',
            otherBubble: '#0F172A',
          },
    [resolvedTheme]
  );

  const t = (key: string) => TRANSLATIONS[settings.language]?.[key] || TRANSLATIONS.en[key] || key;

  return (
    <SettingsContext.Provider
      value={{
        settings,
        resolvedTheme,
        wallpaperColor,
        messageFontSize,
        colors,
        updateSettings,
        applySyncedSettings,
        clearLocalCache,
        t,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
