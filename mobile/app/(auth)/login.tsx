import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { getApiErrorMessage } from '../../src/api/client';

export default function LoginScreen() {
  const { login } = useAuth();
  const router = useRouter();
  const [emailOrUsername, setEmailOrUsername] = useState('');
  const [password, setPassword] = useState('');
  const [twoStepPin, setTwoStepPin] = useState('');
  const [needsTwoStep, setNeedsTwoStep] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!emailOrUsername.trim() || !password) return setError('Enter your username/email and password');
    if (needsTwoStep && !twoStepPin.trim()) return setError('Enter your two-step verification PIN');
    setLoading(true);
    setError('');
    try {
      const res = await login(
        emailOrUsername.trim(),
        password,
        needsTwoStep ? twoStepPin.trim() : undefined
      );
      if (res && res.requiresTwoStep) {
        setNeedsTwoStep(true);
        return;
      }
      router.replace('/chat');
    } catch (err: any) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.logo}>ChatApp</Text>
        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to continue</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TextInput value={emailOrUsername} onChangeText={setEmailOrUsername} placeholder="Username or email" placeholderTextColor="#64748B" autoCapitalize="none" style={styles.input} />
        <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor="#64748B" secureTextEntry style={styles.input} />
        {needsTwoStep ? (
          <TextInput
            value={twoStepPin}
            onChangeText={setTwoStepPin}
            placeholder="Two-step verification PIN (4-6 digits)"
            placeholderTextColor="#64748B"
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            style={styles.input}
          />
        ) : null}
        <Pressable onPress={submit} disabled={loading} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
        </Pressable>
        <Link href="/(auth)/register" asChild><Pressable style={styles.linkButton}><Text style={styles.linkText}>Create account</Text></Pressable></Link>
        <Link href="/(auth)/forgot" asChild><Pressable style={styles.linkButton}><Text style={styles.linkText}>Forgot password?</Text></Pressable></Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#020617', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { width: '100%', maxWidth: 420, backgroundColor: '#0F172A', borderRadius: 24, borderWidth: 1, borderColor: '#1E293B', padding: 24 },
  logo: { color: '#818CF8', fontSize: 14, fontWeight: '800', textAlign: 'center', marginBottom: 16 },
  title: { color: '#F8FAFC', fontSize: 26, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: '#94A3B8', textAlign: 'center', marginTop: 6, marginBottom: 24 },
  error: { color: '#F87171', backgroundColor: '#450A0A', padding: 10, borderRadius: 10, marginBottom: 12, fontSize: 13 },
  input: { height: 52, backgroundColor: '#020617', borderRadius: 12, borderWidth: 1, borderColor: '#334155', color: '#F8FAFC', paddingHorizontal: 14, marginBottom: 12 },
  button: { height: 52, borderRadius: 12, backgroundColor: '#4F46E5', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  pressed: { opacity: 0.85 },
  buttonText: { color: '#fff', fontWeight: '700' },
  linkButton: { height: 44, alignItems: 'center', justifyContent: 'center' },
  linkText: { color: '#818CF8', fontWeight: '600' }
});
