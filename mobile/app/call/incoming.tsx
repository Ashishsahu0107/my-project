import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCall } from '../../src/context/CallContext';

export default function IncomingCallScreen() {
  const router = useRouter();
  const { callState, acceptCall, rejectCall } = useCall();

  // Pulsing animation for status text
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.5,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Redirect if not incoming
  useEffect(() => {
    if (callState.status !== 'incoming' && callState.status !== 'idle') {
      router.back();
    }
  }, [callState.status]);

  const handleAccept = async () => {
    await acceptCall();
    router.replace('/call/active');
  };

  const handleReject = () => {
    rejectCall();
  };

  const callerName = callState.remoteUser?.name ?? 'Unknown';
  const callType = callState.type === 'video' ? 'Video Call' : 'Audio Call';
  const initial = callerName.charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Background overlay gradient feel */}
      <View style={styles.overlay} />

      {/* Center - Caller info */}
      <View style={styles.callerSection}>
        {/* Avatar */}
        {callState.remoteUser?.avatar ? (
          <Image source={{ uri: callState.remoteUser.avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
        )}

        <Text style={styles.callerName}>{callerName}</Text>

        <Animated.Text style={[styles.incomingLabel, { opacity: pulseAnim }]}>
          Incoming {callType}
        </Animated.Text>
      </View>

      {/* Bottom third - Accept/Reject buttons */}
      <View style={styles.actionsSection}>
        {/* Reject */}
        <View style={styles.actionWrapper}>
          <Pressable
            style={[styles.actionBtn, styles.rejectBtn]}
            onPress={handleReject}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.actionEmoji}>📵</Text>
          </Pressable>
          <Text style={styles.actionLabel}>Decline</Text>
        </View>

        {/* Accept */}
        <View style={styles.actionWrapper}>
          <Pressable
            style={[styles.actionBtn, styles.acceptBtn]}
            onPress={handleAccept}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.actionEmoji}>📞</Text>
          </Pressable>
          <Text style={styles.actionLabel}>Accept</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(2, 6, 23, 0.85)',
  },
  callerSection: {
    flex: 0.65,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: 4,
  },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '700',
  },
  callerName: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  incomingLabel: {
    color: '#64748B',
    fontSize: 15,
    textAlign: 'center',
  },
  actionsSection: {
    flex: 0.35,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: 72,
    paddingTop: 24,
    paddingBottom: 48,
  },
  actionWrapper: {
    alignItems: 'center',
    gap: 10,
  },
  actionBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    backgroundColor: '#EF4444',
  },
  acceptBtn: {
    backgroundColor: '#22C55E',
  },
  actionEmoji: {
    fontSize: 28,
  },
  actionLabel: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '500',
  },
});
