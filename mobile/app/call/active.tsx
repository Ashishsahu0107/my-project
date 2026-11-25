import React, { useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  StatusBar,
  Image,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { RTCView } from 'react-native-webrtc';
import { useCall } from '../../src/context/CallContext';
import { useCallTimer } from '../../src/hooks/useCallTimer';

const { width, height } = Dimensions.get('window');

export default function ActiveCallScreen() {
  const router = useRouter();
  const {
    callState,
    toggleMute,
    toggleSpeaker,
    toggleCamera,
    switchCamera,
    endCall,
  } = useCall();

  const { formattedDuration } = useCallTimer(callState.startedAt);

  const isVideo = callState.type === 'video';
  const remoteName = callState.remoteName ?? 'Unknown';
  const initial = remoteName.charAt(0).toUpperCase();

  // Navigate away when call ends
  useEffect(() => {
    if (callState.status === 'idle') {
      router.replace('/chat');
    }
  }, [callState.status]);

  const handleEndCall = () => {
    endCall();
  };

  const ControlsRow = () => (
    <View style={styles.controlsRow}>
      {/* Mute */}
      <Pressable
        style={[styles.controlBtn, callState.isMuted && styles.controlBtnRedBorder]}
        onPress={toggleMute}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.controlEmoji}>{callState.isMuted ? '🔇' : '🎤'}</Text>
      </Pressable>

      {/* Camera toggle (video only) */}
      {isVideo && (
        <Pressable
          style={[styles.controlBtn, !callState.isCameraOn && styles.controlBtnRedBorder]}
          onPress={toggleCamera}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.controlEmoji}>
            {callState.isCameraOn ? '📹' : '🚫'}
          </Text>
        </Pressable>
      )}

      {/* Switch camera (video only) */}
      {isVideo && (
        <Pressable
          style={styles.controlBtn}
          onPress={switchCamera}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.controlEmoji}>🔄</Text>
        </Pressable>
      )}

      {/* Speaker */}
      <Pressable
        style={[styles.controlBtn, callState.isSpeakerOn && styles.controlBtnIndigo]}
        onPress={toggleSpeaker}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.controlEmoji}>🔊</Text>
      </Pressable>

      {/* End Call */}
      <Pressable
        style={[styles.controlBtn, styles.endCallBtn]}
        onPress={handleEndCall}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.endCallEmoji}>📵</Text>
      </Pressable>
    </View>
  );

  if (isVideo) {
    return (
      <View style={styles.container}>
        <StatusBar hidden />

        {/* Remote stream - full screen */}
        {callState.remoteStream ? (
          <RTCView
            streamURL={callState.remoteStream.toURL()}
            style={styles.remoteStream}
            objectFit="cover"
          />
        ) : (
          <View style={[styles.remoteStream, styles.streamPlaceholder]}>
            <Text style={styles.streamPlaceholderText}>Connecting video...</Text>
          </View>
        )}

        {/* Local stream PiP - top right */}
        {callState.localStream && (
          <RTCView
            streamURL={callState.localStream.toURL()}
            style={styles.localStreamPip}
            objectFit="cover"
            zOrder={1}
          />
        )}

        {/* Overlay controls at bottom */}
        <View style={styles.videoOverlay}>
          <SafeAreaView edges={['bottom']}>
            <View style={styles.videoControlsContainer}>
              <Text style={styles.videoDuration}>{formattedDuration}</Text>
              <ControlsRow />
            </View>
          </SafeAreaView>
        </View>
      </View>
    );
  }

  // Audio call UI
  return (
    <View style={styles.container}>
      <StatusBar hidden />

      <SafeAreaView style={styles.audioSafeArea} edges={['bottom']}>
        {/* Center - remote user info */}
        <View style={styles.audioCenter}>
          {callState.remoteAvatar ? (
            <Image source={{ uri: callState.remoteAvatar }} style={styles.audioAvatar} />
          ) : (
            <View style={styles.audioAvatarFallback}>
              <Text style={styles.audioAvatarInitial}>{initial}</Text>
            </View>
          )}

          <Text style={styles.audioOnCallLabel}>On call with</Text>
          <Text style={styles.audioRemoteName}>{remoteName}</Text>

          <Text style={styles.audioDuration}>{formattedDuration}</Text>
        </View>

        {/* Controls */}
        <View style={styles.audioControls}>
          <ControlsRow />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },

  // VIDEO styles
  remoteStream: {
    ...StyleSheet.absoluteFillObject,
  },
  streamPlaceholder: {
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  streamPlaceholderText: {
    color: '#64748B',
    fontSize: 16,
  },
  localStreamPip: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 120,
    height: 180,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1E293B',
    overflow: 'hidden',
    zIndex: 10,
  },
  videoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(2, 6, 23, 0.65)',
    paddingTop: 20,
  },
  videoControlsContainer: {
    alignItems: 'center',
    gap: 12,
    paddingBottom: 24,
    paddingTop: 8,
  },
  videoDuration: {
    color: '#6366F1',
    fontSize: 18,
    fontVariant: ['tabular-nums'],
    fontWeight: '600',
    letterSpacing: 2,
    fontFamily: 'monospace',
  },

  // AUDIO styles
  audioSafeArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  audioCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  audioAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 8,
  },
  audioAvatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  audioAvatarInitial: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '700',
  },
  audioOnCallLabel: {
    color: '#64748B',
    fontSize: 14,
  },
  audioRemoteName: {
    color: '#F8FAFC',
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  audioDuration: {
    color: '#6366F1',
    fontSize: 22,
    fontWeight: '600',
    letterSpacing: 3,
    fontFamily: 'monospace',
    marginTop: 8,
  },
  audioControls: {
    width: '100%',
    alignItems: 'center',
    paddingBottom: 48,
    paddingTop: 16,
  },

  // Shared control styles
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnRedBorder: {
    borderWidth: 2,
    borderColor: '#EF4444',
    backgroundColor: '#1E293B',
  },
  controlBtnIndigo: {
    backgroundColor: '#312E81',
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  endCallBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EF4444',
  },
  controlEmoji: {
    fontSize: 22,
  },
  endCallEmoji: {
    fontSize: 26,
  },
});
