import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/context/AuthContext';
import { useSocket } from '../src/context/SocketContext';
import { useCall } from '../src/context/CallContext';
import { api, getApiErrorMessage } from '../src/api/client';
import { useRouter } from 'expo-router';

type Room = { _id: string; name?: string; type: 'channel' | 'direct' | 'group'; description?: string; members?: any[]; avatar?: string };
type Message = { _id: string; content: string; sender?: any; createdAt: string; status?: string };

function ChatScreen() {
  const { user, logout } = useAuth();
  const { socket, isConnected, onlineIds } = useSocket();
  const { initiateCall } = useCall();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [room, setRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const listRef = useRef<FlatList<Message>>(null);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const [roomsResponse, usersResponse] = await Promise.all([api.get('/rooms'), api.get('/users')]);
        const data: Room[] = roomsResponse.data.data.rooms;
        setRooms(data);
        if (!room && data.length) setRoom(data.find((item) => item.name === 'general') || data[0]);
      } catch (error: any) {
        setError(getApiErrorMessage(error, 'Could not load conversations'));
      } finally { setLoading(false); }
    })();
  }, []);

  useEffect(() => {
    if (!room) return;
    setError('');
    (async () => {
      try {
        const response = await api.get(`/messages/room/${room._id}?limit=25`);
        setMessages(response.data.data.messages);
        socket?.emit('room:join', room._id);
      } catch (error: any) {
        setError(getApiErrorMessage(error, 'Could not load conversations'));
      }
    })();
    return () => { if (socket) socket.emit('room:leave', room._id); };
  }, [room?._id, socket]);

  useEffect(() => {
    if (!socket) return;
    const received = (message: Message & { clientTempId?: string }) => setMessages((current) => {
      const duplicate = current.some((item) => item._id === message._id || (!!message.clientTempId && (item as any).clientTempId === message.clientTempId));
      return duplicate ? current : [...current, message];
    });
    socket.on('message:received', received);
    return () => { socket.off('message:received', received); };
  }, [socket]);

  const send = () => {
    const content = text.trim();
    if (!content || !room) return;
    const clientTempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setText('');
    socket?.emit('message:send', { roomId: room._id, content, clientTempId }, (ack: any) => {
      if (ack?.status === 'ok') setMessages((current) => {
        const withoutTemp = current.filter((item) => (item as any).clientTempId !== clientTempId);
        return current.some((item) => item._id === ack.data._id) ? current : [...withoutTemp, ack.data];
      });
    });
  };

  // Derive other member for direct rooms
  const otherMember = room?.type === 'direct'
    ? room.members?.find((m) => (m._id || m.id) !== user?.id)
    : null;
  const otherMemberId: string = otherMember?._id || otherMember?.id || '';
  const otherMemberName: string = otherMember?.username || otherMember?.name || 'User';
  const otherMemberAvatar: string | undefined = otherMember?.avatar;

  if (loading) return <View style={styles.center}><ActivityIndicator color="#6366F1" /></View>;

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View>
            <Text style={styles.appName}>ChatApp</Text>
            <Text style={styles.roomName}># {room?.name || 'Chat'}</Text>
          </View>
          <View style={styles.headerControls}>
            {room?.type === 'direct' && otherMemberId ? (
              <>
                <Pressable onPress={() => initiateCall(otherMemberId, otherMemberName, otherMemberAvatar, 'audio')} style={styles.callBtn}>
                  <Text style={styles.callBtnText}>📞</Text>
                </Pressable>
                <Pressable onPress={() => initiateCall(otherMemberId, otherMemberName, otherMemberAvatar, 'video')} style={styles.callBtn}>
                  <Text style={styles.callBtnText}>📹</Text>
                </Pressable>
              </>
            ) : null}
            <Pressable onPress={() => router.push('/profile')} style={styles.profileButton}>
              <Text style={styles.profileText}>Profile</Text>
            </Pressable>
            <Pressable onPress={logout} style={styles.logout}>
              <Text style={styles.logoutText}>Logout</Text>
            </Pressable>
          </View>
        </View>

        <FlatList
          horizontal
          data={rooms}
          keyExtractor={(item) => item._id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.roomList}
          renderItem={({ item }) => (
            <Pressable onPress={() => setRoom(item)} style={[styles.roomChip, room?._id === item._id && styles.roomChipActive]}>
              <Text style={styles.roomChipText}>{item.type === 'direct' ? '@' : '#'} {item.name || 'Direct'}</Text>
            </Pressable>
          )}
        />

        {error ? <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View> : null}

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item, index) => item._id || String(index)}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const mine = item.sender?.id === user?.id || item.sender?.username === user?.username;
            return (
              <View style={[styles.messageRow, mine ? styles.mineRow : null]}>
                {!mine && <View style={styles.avatar}><Text style={styles.avatarText}>{item.sender?.username?.[0]?.toUpperCase() || '?'}</Text></View>}
                <View style={[styles.bubble, mine ? styles.mineBubble : styles.otherBubble]}>
                  {!mine && <Text style={styles.sender}>@{item.sender?.username}</Text>}
                  <Text style={styles.messageText}>{item.content}</Text>
                </View>
              </View>
            );
          }}
        />

        <View style={styles.composer}>
          <TextInput value={text} onChangeText={setText} placeholder={`Message ${room?.name || 'chat'}...`} placeholderTextColor="#64748B" style={styles.input} multiline />
          <Pressable onPress={send} disabled={!text.trim()} style={[styles.send, !text.trim() && styles.sendDisabled]}><Text style={styles.sendText}>Send</Text></Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function ChatRoute() {
  return <ChatScreen />;
}

const styles = StyleSheet.create({
  page:{flex:1,backgroundColor:'#020617'}, center:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#020617'},
  header:{height:64,paddingHorizontal:16,borderBottomWidth:1,borderBottomColor:'#1E293B',flexDirection:'row',alignItems:'center',justifyContent:'space-between'}, appName:{color:'#818CF8',fontSize:11,fontWeight:'800'}, roomName:{color:'#F8FAFC',fontSize:18,fontWeight:'800'}, logout:{paddingHorizontal:12,paddingVertical:8,borderRadius:10,backgroundColor:'#1E293B'}, logoutText:{color:'#F87171',fontWeight:'700',fontSize:12},
  profileButton:{paddingHorizontal:12,paddingVertical:8,borderRadius:10,backgroundColor:'#1E293B'}, profileText:{color:'#818CF8',fontWeight:'700',fontSize:12},
  headerControls:{flexDirection:'row',alignItems:'center',gap:8},
  callBtn:{width:36,height:36,borderRadius:18,backgroundColor:'#1E293B',alignItems:'center',justifyContent:'center'}, callBtnText:{fontSize:16},
  roomList:{paddingHorizontal:12,paddingVertical:8,gap:8}, roomChip:{height:36,paddingHorizontal:12,borderRadius:18,backgroundColor:'#0F172A',borderWidth:1,borderColor:'#334155',justifyContent:'center'}, roomChipActive:{backgroundColor:'#312E81',borderColor:'#6366F1'}, roomChipText:{color:'#CBD5E1',fontSize:12,fontWeight:'700'},
  messages:{paddingHorizontal:12,paddingVertical:10,gap:8}, messageRow:{flexDirection:'row',alignItems:'flex-end',gap:8,marginBottom:4}, mineRow:{justifyContent:'flex-end'}, avatar:{width:32,height:32,borderRadius:16,backgroundColor:'#334155',alignItems:'center',justifyContent:'center'}, avatarText:{color:'#CBD5E1',fontWeight:'800'}, bubble:{maxWidth:'78%',borderRadius:16,paddingHorizontal:12,paddingVertical:9}, mineBubble:{backgroundColor:'#4F46E5',borderBottomRightRadius:4}, otherBubble:{backgroundColor:'#0F172A',borderWidth:1,borderColor:'#1E293B',borderBottomLeftRadius:4}, sender:{color:'#818CF8',fontSize:10,fontWeight:'700',marginBottom:3}, messageText:{color:'#F8FAFC',fontSize:14},
  composer:{flexDirection:'row',alignItems:'flex-end',gap:8,padding:10,borderTopWidth:1,borderTopColor:'#1E293B',backgroundColor:'#0F172A'}, input:{flex:1,maxHeight:100,minHeight:44,backgroundColor:'#020617',borderRadius:12,borderWidth:1,borderColor:'#334155',color:'#F8FAFC',paddingHorizontal:12,paddingVertical:10}, send:{height:44,paddingHorizontal:16,borderRadius:12,backgroundColor:'#4F46E5',alignItems:'center',justifyContent:'center'}, sendDisabled:{opacity:.45}, sendText:{color:'#fff',fontWeight:'800'},
  errorBanner:{marginHorizontal:12,marginTop:8,paddingHorizontal:12,paddingVertical:8,borderRadius:10,backgroundColor:'#450A0A'}, errorText:{color:'#FCA5A5',fontSize:12}
});
