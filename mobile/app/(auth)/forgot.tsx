import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { getApiErrorMessage } from '../../src/api/client';

export default function ForgotScreen() {
  const { forgotPassword } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim()) return setError('Enter your email');
    setLoading(true); setError('');
    try {
      await forgotPassword(email.trim());
      router.push({ pathname: '/(auth)/reset', params: { email: email.trim() } });
    } catch (err: any) { setError(getApiErrorMessage(err, 'Could not request reset code')); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.title}>Forgot password</Text>
        <Text style={styles.subtitle}>We will send a reset code to your email</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#64748B" autoCapitalize="none" keyboardType="email-address" style={styles.input} />
        <Pressable onPress={submit} disabled={loading} style={styles.button}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send reset code</Text>}</Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({ page:{flex:1,backgroundColor:'#020617',alignItems:'center',justifyContent:'center',padding:20}, card:{width:'100%',maxWidth:420,backgroundColor:'#0F172A',borderRadius:24,borderWidth:1,borderColor:'#1E293B',padding:24}, title:{color:'#F8FAFC',fontSize:26,fontWeight:'800',textAlign:'center'}, subtitle:{color:'#94A3B8',textAlign:'center',marginTop:6,marginBottom:24}, error:{color:'#F87171',backgroundColor:'#450A0A',padding:10,borderRadius:10,marginBottom:12,fontSize:13}, input:{height:52,backgroundColor:'#020617',borderRadius:12,borderWidth:1,borderColor:'#334155',color:'#F8FAFC',paddingHorizontal:14,marginBottom:12}, button:{height:52,borderRadius:12,backgroundColor:'#4F46E5',alignItems:'center',justifyContent:'center'}, buttonText:{color:'#fff',fontWeight:'700'} });
