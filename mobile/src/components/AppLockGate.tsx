import React, { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getAppLockEnabled, promptBiometricUnlock } from '../services/securityService';

export function AppLockGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [locked, setLocked] = useState(false);
  const appStateRef = useRef<AppStateStatus>((AppState.currentState as AppStateStatus) || 'active');
  const unlockingRef = useRef(false);

  const checkAndLock = async () => {
    if (!user) {
      setLocked(false);
      return;
    }
    const enabled = await getAppLockEnabled();
    if (enabled) {
      setLocked(true);
      await triggerUnlock();
    }
  };

  const triggerUnlock = async () => {
    if (unlockingRef.current) return;
    unlockingRef.current = true;
    try {
      const ok = await promptBiometricUnlock();
      if (ok) setLocked(false);
    } finally {
      unlockingRef.current = false;
    }
  };

  useEffect(() => {
    if (!user) {
      setLocked(false);
      return;
    }
    checkAndLock();

    const sub = AppState.addEventListener('change', (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;
      if ((prev === 'background' || prev === 'inactive') && nextState === 'active') {
        checkAndLock();
      }
    });

    return () => {
      sub.remove();
    };
  }, [user]);

  if (locked && user) {
    return (
      <View style={styles.lockScreen}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.lockTitle}>ChatApp Locked</Text>
        <Text style={styles.lockSubtitle}>Authenticate to access your private chats</Text>
        <Pressable onPress={triggerUnlock} style={styles.unlockBtn}>
          <Text style={styles.unlockText}>Unlock with Biometrics</Text>
        </Pressable>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  lockScreen: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  lockIcon: { fontSize: 48 },
  lockTitle: { color: '#F8FAFC', fontSize: 22, fontWeight: '800' },
  lockSubtitle: { color: '#94A3B8', fontSize: 14, textAlign: 'center' },
  unlockBtn: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#4F46E5',
  },
  unlockText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
