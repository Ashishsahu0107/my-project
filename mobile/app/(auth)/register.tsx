import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useAuth } from '../../src/context/AuthContext';

export default function RegisterScreen() {
  const { register } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true); setError('');
    try {
      await register({ username: username.trim(), email: email.trim(), password });
      router.push({ pathname: '/(auth)/verify', params: { email: email.trim() } });
    } catch (err: any) { setError(err.response?.data?.message || err.message || 'Registration failed'); }
    finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>Join the real-time chat</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TextInput value={username} onChangeText={setUsername} placeholder="Username" placeholderTextColor="#64748B" autoCapitalize="none" style={styles.input} />
        <TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor="#64748B" autoCapitalize="none" keyboardType="email-address" style={styles.input} />
        <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor="#64748B" secureTextEntry style={styles.input} />
        <Pressable onPress={submit} disabled={loading} style={styles.button}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Continue</Text>}</Pressable>
        <Link href="/(auth)/login" asChild><Pressable style={styles.linkButton}><Text style={styles.linkText}>Already have an account?</Text></Pressable></Link>
      </View>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({ page:{flex:1,backgroundColor:'#020617',alignItems:'center',justifyContent:'center',padding:20}, card:{width:'100%',maxWidth:420,backgroundColor:'#0F172A',borderRadius:24,borderWidth:1,borderColor:'#1E293B',padding:24}, title:{color:'#F8FAFC',fontSize:26,fontWeight:'800',textAlign:'center'}, subtitle:{color:'#94A3B8',textAlign:'center',marginTop:6,marginBottom:24}, error:{color:'#F87171',backgroundColor:'#450A0A',padding:10,borderRadius:10,marginBottom:12,fontSize:13}, input:{height:52,backgroundColor:'#020617',borderRadius:12,borderWidth:1,borderColor:'#334155',color:'#F8FAFC',paddingHorizontal:14,marginBottom:12}, button:{height:52,borderRadius:12,backgroundColor:'#4F46E5',alignItems:'center',justifyContent:'center'}, buttonText:{color:'#fff',fontWeight:'700'}, linkButton:{height:44,alignItems:'center',justifyContent:'center'}, linkText:{color:'#818CF8',fontWeight:'600'} });
