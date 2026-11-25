import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';

export default function VerifyScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const { verifyOTP, resendOTP } = useAuth();
  const router = useRouter();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const verify = async () => {
    setLoading(true); setError('');
    try { await verifyOTP(email, otp); router.replace('/chat'); }
    catch (err: any) { setError(err.response?.data?.message || err.message || 'Verification failed'); }
    finally { setLoading(false); }
  };

  return (
    <View style={styles.page}>
      <View style={styles.card}>
        <Text style={styles.title}>Verify email</Text>
        <Text style={styles.subtitle}>Enter the code sent to {email}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TextInput value={otp} onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="6-digit code" placeholderTextColor="#64748B" keyboardType="number-pad" style={styles.input} textAlign="center" maxLength={6} />
        <Pressable onPress={verify} disabled={loading || otp.length !== 6} style={styles.button}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify & Continue</Text>}</Pressable>
        <Pressable onPress={() => resendOTP(email).catch((err: any) => setError(err.response?.data?.message || err.message))} style={styles.linkButton}><Text style={styles.linkText}>Resend code</Text></Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({ page:{flex:1,backgroundColor:'#020617',alignItems:'center',justifyContent:'center',padding:20}, card:{width:'100%',maxWidth:420,backgroundColor:'#0F172A',borderRadius:24,borderWidth:1,borderColor:'#1E293B',padding:24}, title:{color:'#F8FAFC',fontSize:26,fontWeight:'800',textAlign:'center'}, subtitle:{color:'#94A3B8',textAlign:'center',marginTop:6,marginBottom:24}, error:{color:'#F87171',backgroundColor:'#450A0A',padding:10,borderRadius:10,marginBottom:12,fontSize:13}, input:{height:64,backgroundColor:'#020617',borderRadius:12,borderWidth:1,borderColor:'#334155',color:'#F8FAFC',paddingHorizontal:14,marginBottom:12,fontSize:24,letterSpacing:10}, button:{height:52,borderRadius:12,backgroundColor:'#4F46E5',alignItems:'center',justifyContent:'center'}, buttonText:{color:'#fff',fontWeight:'700'}, linkButton:{height:44,alignItems:'center',justifyContent:'center'}, linkText:{color:'#818CF8',fontWeight:'600'} });
