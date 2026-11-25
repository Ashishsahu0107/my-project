import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  StatusBar,
  Dimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useCall } from '../../src/context/CallContext';
import { useSocket } from '../../src/context/SocketContext';

const { width, height } = Dimensions.get('window');

export default function OutgoingCallScreen() {
  const router = useRouter();
  const { callState, toggleMute, toggleSpeaker, endCall } = useCall();
  const { socket } = useSocket();

  // Pulsing ring animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim2 = useRef(new Animated.Value(1)).current;
  const noAnswerTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Start pulsing animation
    const loop1 = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.3,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    const loop2 = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim2, {
          toValue: 1.5,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim2, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );
    loop1.start();
    setTimeout(() => loop2.start(), 400);

    // 45-second no-answer timeout
    noAnswerTimeout.current = setTimeout(() => {
      if (callState.status !== 'active') {
        socket?.emit('call:no_answer', { callId: callState.callId });
        endCall();
      }
    }, 45000);

    return () => {
      loop1.stop();
      loop2.stop();
      if (noAnswerTimeout.current) clearTimeout(noAnswerTimeout.current);
    };
  }, []);

  // Watch call status
  useEffect(() => {
    if (callState.status === 'active') {
      router.replace('/call/active');
    } else if (callState.status === 'idle') {
      router.back();
    }
  }, [callState.status]);

  const handleEndCall = () => {
    if (noAnswerTimeout.current) clearTimeout(noAnswerTimeout.current);
    if (callState.status !== 'active') {
      socket?.emit('call:cancel', { callId: callState.callId });
    }
    endCall();
  };

  const calleeName = callState.remoteUser?.name ?? 'Unknown';
  const callType = callState.type === 'video' ? 'Video Call' : 'Audio Call';
  const statusText = callState.status === 'ringing' ? 'Ringing...' : 'Calling...';
  const initial = calleeName.charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <StatusBar hidden />

      {/* Top section - callee info */}
      <View style={styles.topSection}>
        {/* Pulsing rings */}
        <View style={styles.avatarContainer}>
          <Animated.View
            style={[
              styles.pulseRing,
              styles.pulseRingOuter,
              { transform: [{ scale: pulseAnim2 }] },
            ]}
          />
          <Animated.View
            style={[
              styles.pulseRing,
              styles.pulseRingInner,
              { transform: [{ scale: pulseAnim }] },
            ]}
          />
          {/* Avatar */}
          {callState.remoteUser?.avatar ? (
            <Image source={{ uri: callState.remoteUser.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          )}
        </View>

        <Text style={styles.calleeName}>{calleeName}</Text>
        <Text style={styles.callTypeBadge}>{callType}</Text>
        <Text style={styles.statusText}>{statusText}</Text>
      </View>

      {/* Bottom section - controls */}
      <View style={styles.bottomSection}>
        <View style={styles.controlsRow}>
          {/* Mute Button */}
          <Pressable
            style={[styles.controlBtn, callState.isMuted && styles.controlBtnRed]}
            onPress={toggleMute}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.controlEmoji}>
              {callState.isMuted ? '🔇' : '🎤'}
            </Text>
          </Pressable>

          {/* End Call Button */}
          <Pressable
            style={[styles.controlBtn, styles.endCallBtn]}
            onPress={handleEndCall}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.endCallEmoji}>📵</Text>
          </Pressable>

          {/* Speaker Button */}
          <Pressable
            style={[styles.controlBtn, callState.isSpeakerOn && styles.controlBtnIndigo]}
            onPress={toggleSpeaker}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.controlEmoji}>🔊</Text>
          </Pressable>
        </View>

        {/* Cancel text button */}
        <Pressable
          onPress={handleEndCall}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
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
  topSection: {
    flex: 0.6,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  avatarContainer: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  pulseRing: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
  },
  pulseRingInner: {
    width: 110,
    height: 110,
    borderColor: 'rgba(99, 102, 241, 0.4)',
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
  pulseRingOuter: {
    width: 145,
    height: 145,
    borderColor: 'rgba(99, 102, 241, 0.2)',
    backgroundColor: 'rgba(99, 102, 241, 0.04)',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    zIndex: 1,
  },
  avatarFallback: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '700',
  },
  calleeName: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
  },
  callTypeBadge: {
    color: '#64748B',
    fontSize: 14,
    textAlign: 'center',
  },
  statusText: {
    color: '#94A3B8',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 4,
  },
  bottomSection: {
    flex: 0.4,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingBottom: 48,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
  },
  controlBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnRed: {
    backgroundColor: '#7F1D1D',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  controlBtnIndigo: {
    backgroundColor: '#312E81',
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  endCallBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EF4444',
  },
  controlEmoji: {
    fontSize: 24,
  },
  endCallEmoji: {
    fontSize: 28,
  },
  cancelText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
  },
});
