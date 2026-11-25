import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  AppLanguage,
  FontSizeOption,
  ThemeMode,
  useSettings,
  WALLPAPER_OPTIONS,
} from '../src/context/SettingsContext';

const LANGUAGES: Array<{ code: AppLanguage; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { settings, colors, resolvedTheme, updateSettings, clearLocalCache, t } = useSettings();
  const [cacheMessage, setCacheMessage] = useState('');

  const handleClearCache = () => {
    Alert.alert(
      t('clearCache'),
      'Clear temporary cached data on this device? Your messages and account remain safe.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            const removed = await clearLocalCache();
            setCacheMessage(`Cleared ${removed} cached item(s).`);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>{t('settings')}</Text>
        <View style={{ width: 52 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {cacheMessage ? (
          <View style={styles.infoBanner}>
            <Text style={styles.infoText}>{cacheMessage}</Text>
          </View>
        ) : null}

        {/* Appearance */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.sectionTitle}>{t('appearance')}</Text>

          <Text style={[styles.label, { color: colors.muted }]}>{t('theme')}</Text>
          <View style={styles.chipRow}>
            {(['light', 'dark', 'system'] as ThemeMode[]).map((mode) => {
              const active = settings.theme === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => updateSettings({ theme: mode })}
                  style={[
                    styles.chip,
                    { borderColor: colors.border },
                    active && styles.chipActive,
                  ]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: colors.muted }]}>{t('fontSize')}</Text>
          <View style={styles.chipRow}>
            {(['small', 'medium', 'large'] as FontSizeOption[]).map((sz) => {
              const active = settings.fontSize === sz;
              return (
                <Pressable
                  key={sz}
                  onPress={() => updateSettings({ fontSize: sz })}
                  style={[
                    styles.chip,
                    { borderColor: colors.border },
                    active && styles.chipActive,
                  ]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {sz.charAt(0).toUpperCase() + sz.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: colors.muted }]}>{t('wallpaper')}</Text>
          <View style={styles.wallpaperRow}>
            {WALLPAPER_OPTIONS.map((wp) => {
              const active = settings.chatWallpaper === wp.id;
              const swatch = resolvedTheme === 'light' ? wp.lightColor : wp.darkColor;
              return (
                <Pressable
                  key={wp.id}
                  onPress={() => updateSettings({ chatWallpaper: wp.id })}
                  style={[styles.wallpaperItem, active && styles.wallpaperActive]}
                >
                  <View style={[styles.swatch, { backgroundColor: swatch }]} />
                  <Text style={[styles.wallpaperLabel, { color: colors.text }]}>{wp.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Language */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.sectionTitle}>{t('language')}</Text>
          <View style={styles.chipRow}>
            {LANGUAGES.map((lang) => {
              const active = settings.language === lang.code;
              return (
                <Pressable
                  key={lang.code}
                  onPress={() => updateSettings({ language: lang.code })}
                  style={[
                    styles.chip,
                    { borderColor: colors.border },
                    active && styles.chipActive,
                  ]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {lang.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Notifications & Sound */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.sectionTitle}>{t('notifications')}</Text>

          <SettingSwitch
            label={t('pushNotifications')}
            value={settings.notificationsEnabled}
            textColor={colors.text}
            onChange={(val) => updateSettings({ notificationsEnabled: val })}
          />
          <SettingSwitch
            label={t('sound')}
            value={settings.soundEnabled}
            textColor={colors.text}
            onChange={(val) => updateSettings({ soundEnabled: val })}
          />
          <SettingSwitch
            label={t('vibration')}
            value={settings.vibrationEnabled}
            textColor={colors.text}
            onChange={(val) => updateSettings({ vibrationEnabled: val })}
          />
        </View>

        {/* Data & Storage */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.sectionTitle}>{t('storage')}</Text>
          <SettingSwitch
            label={t('autoDownload')}
            value={settings.autoDownloadMedia}
            textColor={colors.text}
            onChange={(val) => updateSettings({ autoDownloadMedia: val })}
          />
          <Pressable onPress={handleClearCache} style={styles.dangerBtn}>
            <Text style={styles.dangerBtnText}>{t('clearCache')}</Text>
          </Pressable>
        </View>

        {/* Privacy & Account Shortcuts */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={styles.sectionTitle}>{t('shortcuts')}</Text>
          <Pressable onPress={() => router.push('/security')} style={styles.shortcutBtn}>
            <Text style={styles.shortcutText}>{t('privacySecurity')}</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/backup')} style={styles.shortcutBtn}>
            <Text style={styles.shortcutText}>{t('backupSync')}</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/profile')} style={styles.shortcutBtn}>
            <Text style={styles.shortcutText}>{t('profileAccount')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function SettingSwitch({
  label,
  value,
  textColor,
  onChange,
}: {
  label: string;
  value: boolean;
  textColor: string;
  onChange: (val: boolean) => void;
}) {
  return (
    <View style={styles.switchRow}>
      <Text style={[styles.switchLabel, { color: textColor }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: '#334155', true: '#4F46E5' }}
        thumbColor="#F8FAFC"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  header: {
    height: 60,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backText: { color: '#818CF8', fontWeight: '700', fontSize: 14 },
  title: { fontSize: 17, fontWeight: '800' },
  content: { padding: 16, gap: 14 },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  sectionTitle: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  label: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  chipActive: { backgroundColor: '#4F46E5', borderColor: '#6366F1' },
  chipText: { color: '#94A3B8', fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#FFFFFF' },
  wallpaperRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  wallpaperItem: {
    alignItems: 'center',
    gap: 4,
    padding: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  wallpaperActive: { borderColor: '#6366F1', backgroundColor: 'rgba(99, 102, 241, 0.14)' },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#475569',
  },
  wallpaperLabel: { fontSize: 11, fontWeight: '600' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchLabel: { fontSize: 14, fontWeight: '600' },
  dangerBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: '#7F1D1D',
    borderWidth: 1,
    borderColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  dangerBtnText: { color: '#FEE2E2', fontWeight: '800', fontSize: 13 },
  shortcutBtn: {
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutText: { color: '#818CF8', fontWeight: '800', fontSize: 14 },
  infoBanner: {
    backgroundColor: '#1E1B4B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  infoText: { color: '#E0E7FF', fontSize: 13 },
});
