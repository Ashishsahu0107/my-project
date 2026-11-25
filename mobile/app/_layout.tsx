import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { SettingsProvider, useSettings } from '../src/context/SettingsContext';
import { SocketProvider } from '../src/context/SocketContext';
import { CallProvider } from '../src/context/CallContext';
import { AppLockGate } from '../src/components/AppLockGate';
import {
  consumePendingNotificationRoomId,
  subscribeToNotificationTaps,
} from '../src/services/notificationNavigation';

function RootNavigator() {
  const { user, isLoading } = useAuth();
  const { resolvedTheme, colors } = useSettings();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === '(auth)';
    if (!user && !inAuthGroup) router.replace('/(auth)/login');
    if (user && inAuthGroup) {
      const pendingRoomId = consumePendingNotificationRoomId();
      if (pendingRoomId) {
        router.replace({ pathname: '/chat', params: { roomId: pendingRoomId } });
      } else {
        router.replace('/chat');
      }
    }
  }, [user, isLoading, segments, router]);

  useEffect(() => {
    if (isLoading) return;
    const unsubscribe = subscribeToNotificationTaps(undefined, Boolean(user));
    return () => {
      unsubscribe();
    };
  }, [isLoading, user]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#020617' }}>
        <ActivityIndicator color="#6366F1" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={resolvedTheme === 'light' ? 'dark' : 'light'} />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="chat" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="backup" />
        <Stack.Screen name="security" />
        <Stack.Screen name="call" options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="call-history" />
      </Stack>
    </>
  );
}

export default function Layout() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <SocketProvider>
          <CallProvider>
            <AppLockGate>
              <RootNavigator />
            </AppLockGate>
          </CallProvider>
        </SocketProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}
