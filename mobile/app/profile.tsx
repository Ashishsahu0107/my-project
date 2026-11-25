import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { getApiErrorMessage } from '../src/api/client';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, updateProfile } = useAuth();
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [statusMessage, setStatusMessage] = useState(user?.statusMessage || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const save = async () => {
    setLoading(true); setError('');
    try {
      await updateProfile({ avatar: avatar.trim(), bio: bio.trim(), statusMessage: statusMessage.trim() });
      router.back();
    } catch (err: any) { setError(getApiErrorMessage(err, 'Could not update profile')); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.header}><Pressable onPress={() => router.back()}><Text style={styles.back}>Back</Text></Pressable><Text style={styles.title}>Profile</Text><View style={{ width: 45 }} /></View>
      <View style={styles.card}>
        <Text style={styles.username}>@{user?.username}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Text style={styles.label}>Avatar URL</Text>
        <TextInput value={avatar} onChangeText={setAvatar} placeholder="https://..." placeholderTextColor="#64748B" autoCapitalize="none" style={styles.input} />
        <Text style={styles.label}>Status message</Text>
        <TextInput value={statusMessage} onChangeText={setStatusMessage} placeholder="What are you up to?" placeholderTextColor="#64748B" style={styles.input} />
        <Text style={styles.label}>Bio</Text>
        <TextInput value={bio} onChangeText={setBio} placeholder="About you" placeholderTextColor="#64748B" multiline style={[styles.input, styles.bio]} />
        <Pressable onPress={save} disabled={loading} style={styles.button}>{loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save Profile</Text>}</Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ page:{flex:1,backgroundColor:'#020617'}, header:{height:64,paddingHorizontal:16,borderBottomWidth:1,borderBottomColor:'#1E293B',flexDirection:'row',alignItems:'center',justifyContent:'space-between'}, back:{color:'#818CF8',fontWeight:'700'}, title:{color:'#F8FAFC',fontSize:16,fontWeight:'800'}, card:{margin:16,padding:18,backgroundColor:'#0F172A',borderRadius:20,borderWidth:1,borderColor:'#1E293B'}, username:{color:'#F8FAFC',fontSize:20,fontWeight:'800',marginBottom:18}, label:{color:'#94A3B8',fontSize:12,fontWeight:'700',marginBottom:6}, input:{minHeight:48,backgroundColor:'#020617',borderWidth:1,borderColor:'#334155',borderRadius:12,color:'#F8FAFC',paddingHorizontal:12,marginBottom:14}, bio:{height:88,textAlignVertical:'top',paddingVertical:12}, error:{color:'#FCA5A5',backgroundColor:'#450A0A',borderRadius:10,padding:10,marginBottom:12,fontSize:12}, button:{height:52,backgroundColor:'#4F46E5',borderRadius:12,alignItems:'center',justifyContent:'center'}, buttonText:{color:'#fff',fontWeight:'800'} });
