import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api, getApiErrorMessage } from '../src/api/client';
import { useAuth } from '../src/context/AuthContext';
import {
  blockUser,
  disableTwoStepPin,
  enableTwoStepPin,
  getAppLockEnabled,
  getSecurityOverview,
  isBiometricSupported,
  logoutAllDevices,
  PrivacySettings,
  promptBiometricUnlock,
  revokeSession,
  SecurityOverview,
  setAppLockEnabled,
  unblockUser,
  updatePrivacySettings,
  VisibilityLevel,
} from '../src/services/securityService';

const VISIBILITY_CYCLE: VisibilityLevel[] = ['everyone', 'contacts', 'nobody'];

export default function SecurityScreen() {
  const router = useRouter();
  const { logout } = useAuth();

  const [overview, setOverview] = useState<SecurityOverview | null>(null);
  const [appLock, setAppLock] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Two-Step PIN Modal
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinMode, setPinMode] = useState<'enable' | 'disable'>('enable');
  const [pinInput, setPinInput] = useState('');
  const [pinSaving, setPinSaving] = useState(false);

  // Block User Modal
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [allUsers, setAllUsers] = useState<Array<{ _id: string; username: string }>>([]);

  const load = async () => {
    setError('');
    try {
      const [sec, lockEnabled, bioSupported] = await Promise.all([
        getSecurityOverview(),
        getAppLockEnabled(),
        isBiometricSupported(),
      ]);
      setOverview(sec);
      setAppLock(lockEnabled);
      setBiometricAvailable(bioSupported);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Could not load security settings'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleToggleAppLock = async (val: boolean) => {
    if (val && !biometricAvailable) {
      Alert.alert(
        'Biometrics Unavailable',
        'Enable fingerprint or Face ID in your device settings first.'
      );
      return;
    }
    const ok = await promptBiometricUnlock();
    if (!ok) return;
    await setAppLockEnabled(val);
    setAppLock(val);
    setInfo(val ? 'Biometric app lock enabled' : 'Biometric app lock disabled');
  };

  const handlePinSubmit = async () => {
    if (!/^\d{4,6}$/.test(pinInput.trim())) {
      setError('PIN must be 4 to 6 digits');
      return;
    }
    setPinSaving(true);
    setError('');
    try {
      if (pinMode === 'enable') {
        await enableTwoStepPin(pinInput.trim());
        setOverview((prev) => (prev ? { ...prev, twoStepEnabled: true } : prev));
        setInfo('Two-step verification enabled');
      } else {
        await disableTwoStepPin(pinInput.trim());
        setOverview((prev) => (prev ? { ...prev, twoStepEnabled: false } : prev));
        setInfo('Two-step verification disabled');
      }
      setPinModalVisible(false);
      setPinInput('');
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to update two-step verification'));
    } finally {
      setPinSaving(false);
    }
  };

  const cyclePrivacy = async (field: keyof PrivacySettings) => {
    if (!overview) return;
    const current = overview.privacySettings[field];
    const next = VISIBILITY_CYCLE[(VISIBILITY_CYCLE.indexOf(current) + 1) % VISIBILITY_CYCLE.length];
    try {
      const updated = await updatePrivacySettings({ [field]: next });
      setOverview((prev) => (prev ? { ...prev, privacySettings: updated } : prev));
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Could not update privacy setting'));
    }
  };

  const openBlockPicker = async () => {
    try {
      const res = await api.get('/users');
      setAllUsers(res.data.data.users || []);
      setBlockModalVisible(true);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Could not load users'));
    }
  };

  const handleBlock = async (userId: string) => {
    try {
      const updated = await blockUser(userId);
      setOverview((prev) => (prev ? { ...prev, blockedUsers: updated } : prev));
      setBlockModalVisible(false);
      setInfo('User blocked');
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Could not block user'));
    }
  };

  const handleUnblock = async (userId: string) => {
    try {
      const updated = await unblockUser(userId);
      setOverview((prev) => (prev ? { ...prev, blockedUsers: updated } : prev));
      setInfo('User unblocked');
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Could not unblock user'));
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const sessions = await revokeSession(sessionId);
      setOverview((prev) => (prev ? { ...prev, activeSessions: sessions } : prev));
      setInfo('Device session revoked');
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Could not revoke session'));
    }
  };

  const handleLogoutAll = () => {
    Alert.alert(
      'Log Out From All Devices?',
      'This will revoke all active sessions and require signing in again on every device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out All',
          style: 'destructive',
          onPress: async () => {
            try {
              await logoutAllDevices();
              await logout();
              router.replace('/(auth)/login');
            } catch (err: any) {
              setError(getApiErrorMessage(err, 'Failed to log out from all devices'));
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#6366F1" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Privacy & Security</Text>
        <View style={{ width: 52 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {error ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
        {info ? (
          <View style={styles.infoBanner}>
            <Text style={styles.infoText}>{info}</Text>
          </View>
        ) : null}

        {/* App Lock & 2FA */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account Protection</Text>

          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>Biometric App Lock</Text>
              <Text style={styles.itemSub}>
                Require fingerprint or Face ID when opening ChatApp
              </Text>
            </View>
            <Switch
              value={appLock}
              onValueChange={handleToggleAppLock}
              trackColor={{ false: '#334155', true: '#4F46E5' }}
              thumbColor="#F8FAFC"
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitle}>Two-Step Verification</Text>
              <Text style={styles.itemSub}>
                {overview?.twoStepEnabled
                  ? 'Enabled — 4–6 digit PIN required on login'
                  : 'Disabled — add an extra PIN layer'}
              </Text>
            </View>
            <Pressable
              onPress={() => {
                setPinMode(overview?.twoStepEnabled ? 'disable' : 'enable');
                setPinInput('');
                setPinModalVisible(true);
              }}
              style={styles.pillBtn}
            >
              <Text style={styles.pillBtnText}>
                {overview?.twoStepEnabled ? 'Disable' : 'Enable'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Privacy Visibility */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Privacy Visibility (Tap to Change)</Text>
          <PrivacyRow
            label="Last Seen"
            value={overview?.privacySettings.lastSeenVisibility || 'everyone'}
            onPress={() => cyclePrivacy('lastSeenVisibility')}
          />
          <PrivacyRow
            label="Online Status"
            value={overview?.privacySettings.onlineStatusVisibility || 'everyone'}
            onPress={() => cyclePrivacy('onlineStatusVisibility')}
          />
          <PrivacyRow
            label="Profile Photo"
            value={overview?.privacySettings.profilePhotoVisibility || 'everyone'}
            onPress={() => cyclePrivacy('profilePhotoVisibility')}
          />
          <PrivacyRow
            label="Status Message"
            value={overview?.privacySettings.statusVisibility || 'everyone'}
            onPress={() => cyclePrivacy('statusVisibility')}
          />
        </View>

        {/* Blocked Users */}
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>
              Blocked Users ({overview?.blockedUsers.length || 0})
            </Text>
            <Pressable onPress={openBlockPicker} style={styles.pillBtn}>
              <Text style={styles.pillBtnText}>+ Block</Text>
            </Pressable>
          </View>

          {overview?.blockedUsers.length === 0 ? (
            <Text style={styles.itemSub}>No blocked users</Text>
          ) : (
            overview?.blockedUsers.map((u) => (
              <View key={u._id} style={styles.sessionRow}>
                <Text style={styles.itemTitle}>@{u.username}</Text>
                <Pressable onPress={() => handleUnblock(u._id)} style={styles.unblockBtn}>
                  <Text style={styles.unblockText}>Unblock</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>

        {/* Active Sessions & Linked Devices */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Active Sessions ({overview?.activeSessions.length || 0})
          </Text>

          {overview?.activeSessions.length === 0 ? (
            <Text style={styles.itemSub}>No tracked sessions</Text>
          ) : (
            overview?.activeSessions.map((s) => {
              const isCurrent = s.sessionId === overview.currentSessionId;
              return (
                <View key={s.sessionId} style={styles.sessionRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>
                      {s.deviceName} {isCurrent ? '(Current)' : ''}
                    </Text>
                    <Text style={styles.itemSub}>
                      {s.platform} · {new Date(s.lastActiveAt).toLocaleDateString()}
                    </Text>
                  </View>
                  {!isCurrent && (
                    <Pressable
                      onPress={() => handleRevokeSession(s.sessionId)}
                      style={styles.revokeBtn}
                    >
                      <Text style={styles.revokeText}>Revoke</Text>
                    </Pressable>
                  )}
                </View>
              );
            })
          )}

          <Pressable onPress={handleLogoutAll} style={styles.logoutAllBtn}>
            <Text style={styles.logoutAllText}>Log Out From All Devices</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Two-Step PIN Modal */}
      <Modal
        visible={pinModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPinModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {pinMode === 'enable' ? 'Set Two-Step PIN' : 'Enter Current PIN to Disable'}
            </Text>
            <TextInput
              value={pinInput}
              onChangeText={setPinInput}
              placeholder="4–6 digit PIN"
              placeholderTextColor="#64748B"
              keyboardType="number-pad"
              maxLength={6}
              secureTextEntry
              style={styles.pinInput}
            />
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setPinModalVisible(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handlePinSubmit}
                disabled={pinSaving}
                style={styles.modalConfirmBtn}
              >
                {pinSaving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Block User Picker Modal */}
      <Modal
        visible={blockModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBlockModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Block User</Text>
            <ScrollView style={{ maxHeight: 280 }}>
              {allUsers.map((u) => (
                <Pressable
                  key={u._id}
                  onPress={() => handleBlock(u._id)}
                  style={styles.userPickRow}
                >
                  <Text style={styles.itemTitle}>@{u.username}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable
              onPress={() => setBlockModalVisible(false)}
              style={styles.modalCancelBtn}
            >
              <Text style={styles.modalCancelText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function PrivacyRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: VisibilityLevel;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.privacyRow}>
      <Text style={styles.itemTitle}>{label}</Text>
      <Text style={styles.privacyValue}>{value.toUpperCase()}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#020617' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#020617' },
  header: {
    height: 60,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backText: { color: '#818CF8', fontWeight: '700', fontSize: 14 },
  title: { color: '#F8FAFC', fontSize: 17, fontWeight: '800' },
  content: { padding: 16, gap: 14 },
  card: {
    backgroundColor: '#0F172A',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  itemTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '700' },
  itemSub: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  divider: { height: 1, backgroundColor: '#1E293B' },
  pillBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: '#312E81',
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  pillBtnText: { color: '#E0E7FF', fontSize: 12, fontWeight: '800' },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  privacyValue: { color: '#818CF8', fontSize: 12, fontWeight: '800' },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  unblockBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  unblockText: { color: '#CBD5E1', fontSize: 12, fontWeight: '700' },
  revokeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#450A0A',
  },
  revokeText: { color: '#FCA5A5', fontSize: 12, fontWeight: '700' },
  logoutAllBtn: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#7F1D1D',
    borderWidth: 1,
    borderColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  logoutAllText: { color: '#FEE2E2', fontWeight: '800', fontSize: 14 },
  errorBanner: {
    backgroundColor: '#450A0A',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DC2626',
  },
  errorText: { color: '#FCA5A5', fontSize: 13 },
  infoBanner: {
    backgroundColor: '#1E1B4B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  infoText: { color: '#E0E7FF', fontSize: 13 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 20,
    gap: 12,
  },
  modalTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '800' },
  pinInput: {
    height: 48,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    color: '#F8FAFC',
    paddingHorizontal: 14,
    fontSize: 16,
  },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: { color: '#CBD5E1', fontWeight: '700' },
  modalConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: { color: '#FFFFFF', fontWeight: '800' },
  userPickRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
});
