import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';
import { getApiErrorMessage } from '../../src/api/client';

export default function ResetScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { resetPassword } = useAuth();
  const router = useRouter();
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (otp.length !== 6 || password.length < 6) return setError('Enter the 6-digit code and a password of at least 6 characters');
    setLoading(true); setError('');
    try { await resetPassword(email, otp, password); router.replace('/chat'); }
    catch (err: any) { setError(getApiErrorMessage(err, 'Could not reset password')); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>Enter the code sent to {email}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TextInput value={otp} onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="6-digit code" placeholderTextColor="#64748B" keyboardType="number-pad" style={styles.input} textAlign="center" maxLength={6} />
        <TextInput value={password} onChangeText={setPassword} placeholder="New password" placeholderTextColor="#64748B" secureTextEntry style={styles.input} />
        <Pressable onPress={submit} disabled={loading} style={styles.button}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Reset & Sign In</Text>}</Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({ page:{flex:1,backgroundColor:'#020617',alignItems:'center',justifyContent:'center',padding:20}, card:{width:'100%',maxWidth:420,backgroundColor:'#0F172A',borderRadius:24,borderWidth:1,borderColor:'#1E293B',padding:24}, title:{color:'#F8FAFC',fontSize:26,fontWeight:'800',textAlign:'center'}, subtitle:{color:'#94A3B8',textAlign:'center',marginTop:6,marginBottom:24}, error:{color:'#F87171',backgroundColor:'#450A0A',padding:10,borderRadius:10,marginBottom:12,fontSize:13}, input:{height:52,backgroundColor:'#020617',borderRadius:12,borderWidth:1,borderColor:'#334155',color:'#F8FAFC',paddingHorizontal:14,marginBottom:12}, button:{height:52,borderRadius:12,backgroundColor:'#4F46E5',alignItems:'center',justifyContent:'center'}, buttonText:{color:'#fff',fontWeight:'700'} });
