import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Alert } from 'react-native';
import {
  MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
} from 'react-native-webrtc';
import { useRouter } from 'expo-router';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

// ─── Types ───────────────────────────────────────────────────────────────────

type CallType = 'audio' | 'video';
type CallStatus =
  | 'idle'
  | 'initiating'
  | 'ringing'
  | 'incoming'
  | 'active'
  | 'ended';

type RemoteUser = {
  id: string;
  name: string;
  avatar?: string;
};

type CallState = {
  callId: string | null;
  type: CallType | null;
  status: CallStatus;
  isIncoming: boolean;
  remoteUser: RemoteUser | null;
  startedAt: Date | null;
  isMuted: boolean;
  isSpeakerOn: boolean;
  isCameraOn: boolean;
  isFrontCamera: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
};

type CallContextValue = {
  callState: CallState;
  initiateCall: (
    userId: string,
    userName: string,
    userAvatar: string | undefined,
    type: CallType
  ) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleSpeaker: () => void;
  toggleCamera: () => void;
  switchCamera: () => void;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

const INITIAL_STATE: CallState = {
  callId: null,
  type: null,
  status: 'idle',
  isIncoming: false,
  remoteUser: null,
  startedAt: null,
  isMuted: false,
  isSpeakerOn: false,
  isCameraOn: true,
  isFrontCamera: true,
  localStream: null,
  remoteStream: null,
};

const generateCallId = () =>
  `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

// ─── Context ──────────────────────────────────────────────────────────────────

const CallContext = createContext<CallContextValue | null>(null);

export function useCall(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within a CallProvider');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const router = useRouter();

  const [callState, setCallState] = useState<CallState>(INITIAL_STATE);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  // Keep a ref to current callId so event handlers don't stale-close over state
  const callIdRef = useRef<string | null>(null);
  const remoteUserRef = useRef<RemoteUser | null>(null);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const resetState = useCallback(() => {
    setCallState(INITIAL_STATE);
    callIdRef.current = null;
    remoteUserRef.current = null;
  }, []);

  const closePeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  }, []);

  const stopLocalTracks = useCallback((stream: MediaStream | null) => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  }, []);

  const createPeerConnection = useCallback(
    (targetUserId: string): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      pc.onicecandidate = (event: any) => {
        if (event.candidate && socket) {
          socket.emit('call:webrtc_ice', {
            callId: callIdRef.current,
            candidate: event.candidate,
            targetUserId,
          });
        }
      };

      pc.ontrack = (event: any) => {
        const remoteStream = new MediaStream(
          event.streams?.[0]?.getTracks() ?? [event.track]
        );
        setCallState((prev) => ({ ...prev, remoteStream }));
      };

      peerConnectionRef.current = pc;
      return pc;
    },
    [socket]
  );

  const getLocalStream = useCallback(async (type: CallType | null) => {
    const isVideo = type === 'video';
    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: isVideo
        ? { facingMode: 'user', frameRate: 30, width: 1280, height: 720 }
        : false,
    });
    return stream as unknown as MediaStream;
  }, []);

  // ── Public API ─────────────────────────────────────────────────────────────

  const initiateCall = useCallback(
    async (
      userId: string,
      userName: string,
      userAvatar: string | undefined,
      type: CallType
    ) => {
      if (!socket || !user) return;

      try {
        const localStream = await getLocalStream(type);
        const callId = generateCallId();
        callIdRef.current = callId;
        remoteUserRef.current = { id: userId, name: userName, avatar: userAvatar };

        setCallState((prev) => ({
          ...prev,
          callId,
          type,
          status: 'initiating',
          isIncoming: false,
          remoteUser: remoteUserRef.current,
          localStream,
        }));

        const pc = createPeerConnection(userId);
        (localStream.getTracks() as any[]).forEach((track) => {
          pc.addTrack(track, localStream as any);
        });

        socket.emit('call:initiate', { calleeId: userId, type, callId });
        router.push('/call/outgoing');
      } catch (err) {
        console.error('[CallContext] initiateCall error:', err);
        resetState();
        Alert.alert('Call Failed', 'Could not access camera or microphone.');
      }
    },
    [socket, user, createPeerConnection, getLocalStream, resetState, router]
  );

  const acceptCall = useCallback(async () => {
    if (!socket || !callIdRef.current) return;

    try {
      const localStream = await getLocalStream(callState.type);
      const targetUserId = remoteUserRef.current?.id ?? '';
      const pc = createPeerConnection(targetUserId);

      (localStream.getTracks() as any[]).forEach((track) => {
        pc.addTrack(track, localStream as any);
      });

      setCallState((prev) => ({ ...prev, localStream, status: 'active', startedAt: new Date() }));

      socket.emit('call:accept', { callId: callIdRef.current });
      router.push('/call/active');
    } catch (err) {
      console.error('[CallContext] acceptCall error:', err);
      Alert.alert('Call Failed', 'Could not access camera or microphone.');
    }
  }, [socket, callState.type, createPeerConnection, getLocalStream, router]);

  const rejectCall = useCallback(() => {
    if (!socket || !callIdRef.current) return;
    socket.emit('call:reject', { callId: callIdRef.current, reason: 'rejected' });
    resetState();
  }, [socket, resetState]);

  const endCall = useCallback(() => {
    if (!socket) return;
    const duration = callState.startedAt
      ? Math.floor((Date.now() - callState.startedAt.getTime()) / 1000)
      : 0;

    socket.emit('call:end', { callId: callIdRef.current, duration });
    closePeerConnection();
    stopLocalTracks(callState.localStream);
    resetState();
    router.replace('/chat');
  }, [
    socket,
    callState.startedAt,
    callState.localStream,
    closePeerConnection,
    stopLocalTracks,
    resetState,
    router,
  ]);

  const toggleMute = useCallback(() => {
    setCallState((prev) => {
      if (prev.localStream) {
        (prev.localStream.getAudioTracks() as any[]).forEach((track) => {
          track.enabled = prev.isMuted; // flip: if currently muted, re-enable
        });
      }
      return { ...prev, isMuted: !prev.isMuted };
    });
  }, []);

  const toggleSpeaker = useCallback(() => {
    setCallState((prev) => {
      const next = !prev.isSpeakerOn;
      try {
        // Try InCallManager if available (react-native-incall-manager)
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const InCallManager = require('react-native-incall-manager').default;
        InCallManager.setSpeakerphoneOn(next);
      } catch {
        // InCallManager not installed; just track the toggle
      }
      return { ...prev, isSpeakerOn: next };
    });
  }, []);

  const toggleCamera = useCallback(() => {
    setCallState((prev) => {
      if (prev.localStream) {
        (prev.localStream.getVideoTracks() as any[]).forEach((track) => {
          track.enabled = prev.isCameraOn ? false : true;
        });
      }
      return { ...prev, isCameraOn: !prev.isCameraOn };
    });
  }, []);

  const switchCamera = useCallback(() => {
    setCallState((prev) => {
      if (prev.localStream) {
        const videoTrack = (prev.localStream.getVideoTracks() as any[])[0];
        if (videoTrack?._switchCamera) {
          videoTrack._switchCamera();
        }
      }
      return { ...prev, isFrontCamera: !prev.isFrontCamera };
    });
  }, []);

  // ── Socket event listeners ─────────────────────────────────────────────────

  useEffect(() => {
    if (!socket) return;

    const onIncoming = ({
      callId,
      callerId,
      callerName,
      callerAvatar,
      type,
    }: {
      callId: string;
      callerId: string;
      callerName: string;
      callerAvatar?: string;
      type: CallType;
    }) => {
      callIdRef.current = callId;
      remoteUserRef.current = { id: callerId, name: callerName, avatar: callerAvatar };
      setCallState((prev) => ({
        ...prev,
        callId,
        type,
        status: 'incoming',
        isIncoming: true,
        remoteUser: remoteUserRef.current,
      }));
      router.push('/call/incoming');
    };

    const onAccepted = async ({ callId }: { callId: string }) => {
      // We are the caller — create offer now
      const pc = peerConnectionRef.current;
      if (!pc || !socket) return;
      try {
        const offer = await pc.createOffer({});
        await pc.setLocalDescription(new RTCSessionDescription(offer));
        const targetUserId = remoteUserRef.current?.id ?? '';
        socket.emit('call:webrtc_offer', { callId, offer, targetUserId });
        setCallState((prev) => ({ ...prev, status: 'active', startedAt: new Date() }));
      } catch (err) {
        console.error('[CallContext] onAccepted offer error:', err);
      }
    };

    const onRejected = ({ reason }: { callId: string; reason: string }) => {
      resetState();
      Alert.alert('Call Declined', `The other party ${reason === 'busy' ? 'is busy' : 'declined the call'}.`);
    };

    const onEnded = () => {
      closePeerConnection();
      stopLocalTracks(callState.localStream);
      resetState();
      router.replace('/chat');
    };

    const onCancelled = () => {
      resetState();
      router.back();
    };

    const onMissed = () => {
      resetState();
    };

    const onBusy = () => {
      resetState();
      Alert.alert('Unavailable', 'User is currently busy.');
    };

    const onFailed = ({ reason }: { reason: string }) => {
      resetState();
      Alert.alert('Call Failed', reason ?? 'Unable to complete the call.');
    };

    const onRinging = ({ callId }: { callId: string }) => {
      setCallState((prev) =>
        prev.callId === callId ? { ...prev, status: 'ringing' } : prev
      );
    };

    const onWebRTCOffer = async ({
      callId,
      offer,
    }: {
      callId: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      const pc = peerConnectionRef.current;
      if (!pc || !socket) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(new RTCSessionDescription(answer));
        const targetUserId = remoteUserRef.current?.id ?? '';
        socket.emit('call:webrtc_answer', { callId, answer, targetUserId });
      } catch (err) {
        console.error('[CallContext] onWebRTCOffer error:', err);
      }
    };

    const onWebRTCAnswer = async ({
      answer,
    }: {
      answer: RTCSessionDescriptionInit;
    }) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) {
        console.error('[CallContext] onWebRTCAnswer error:', err);
      }
    };

    const onWebRTCIce = async ({
      candidate,
    }: {
      candidate: RTCIceCandidateInit;
    }) => {
      const pc = peerConnectionRef.current;
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('[CallContext] onWebRTCIce error:', err);
      }
    };

    socket.on('call:incoming', onIncoming);
    socket.on('call:accepted', onAccepted);
    socket.on('call:rejected', onRejected);
    socket.on('call:ended', onEnded);
    socket.on('call:cancelled', onCancelled);
    socket.on('call:missed', onMissed);
    socket.on('call:busy', onBusy);
    socket.on('call:failed', onFailed);
    socket.on('call:ringing', onRinging);
    socket.on('call:webrtc_offer', onWebRTCOffer);
    socket.on('call:webrtc_answer', onWebRTCAnswer);
    socket.on('call:webrtc_ice', onWebRTCIce);

    return () => {
      socket.off('call:incoming', onIncoming);
      socket.off('call:accepted', onAccepted);
      socket.off('call:rejected', onRejected);
      socket.off('call:ended', onEnded);
      socket.off('call:cancelled', onCancelled);
      socket.off('call:missed', onMissed);
      socket.off('call:busy', onBusy);
      socket.off('call:failed', onFailed);
      socket.off('call:ringing', onRinging);
      socket.off('call:webrtc_offer', onWebRTCOffer);
      socket.off('call:webrtc_answer', onWebRTCAnswer);
      socket.off('call:webrtc_ice', onWebRTCIce);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // ── Context value ──────────────────────────────────────────────────────────

  const value: CallContextValue = {
    callState,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleSpeaker,
    toggleCamera,
    switchCamera,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
