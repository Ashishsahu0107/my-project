import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { getApiErrorMessage } from '../src/api/client';

type PhotoVisibility = 'everyone' | 'contacts' | 'nobody';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, updateProfile, requestEmailChange, verifyEmailChange } = useAuth();

  const [username, setUsername] = useState(user?.username || '');
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [statusMessage, setStatusMessage] = useState(user?.statusMessage || '');
  const [photoVisibility, setPhotoVisibility] = useState<PhotoVisibility>(
    user?.privacySettings?.profilePhotoVisibility || 'everyone'
  );

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [pickingImage, setPickingImage] = useState(false);

  // Email change modal states
  const [emailModalVisible, setEmailModalVisible] = useState(false);
  const [emailStep, setEmailStep] = useState<'input' | 'otp'>('input');
  const [newEmail, setNewEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');

  useEffect(() => {
    if (!user) return;
    setUsername(user.username || '');
    setDisplayName(user.displayName || '');
    setPhoneNumber(user.phoneNumber || '');
    setAvatar(user.avatar || '');
    setBio(user.bio || '');
    setStatusMessage(user.statusMessage || '');
    setPhotoVisibility(user.privacySettings?.profilePhotoVisibility || 'everyone');
  }, [user]);

  const pickAndCropImage = async () => {
    setError('');
    setPickingImage(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') {
        setError('Media library permission is required to choose a profile photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          const mime = asset.mimeType || 'image/jpeg';
          setAvatar(`data:${mime};base64,${asset.base64}`);
        } else if (asset.uri) {
          setAvatar(asset.uri);
        }
      }
    } catch {
      setError('Could not open image picker.');
    } finally {
      setPickingImage(false);
    }
  };

  const validateProfile = (): string | null => {
    const cleanUser = username.trim().toLowerCase();
    if (cleanUser.length < 3 || cleanUser.length > 30) {
      return 'Username must be between 3 and 30 characters.';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(cleanUser)) {
      return 'Username can only contain letters, numbers, and underscores.';
    }
    const cleanPhone = phoneNumber.trim();
    if (cleanPhone && !/^[+\d\s()-]{6,25}$/.test(cleanPhone)) {
      return 'Please enter a valid phone number.';
    }
    return null;
  };

  const save = async () => {
    const validationError = validateProfile();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await updateProfile({
        username: username.trim().toLowerCase(),
        displayName: displayName.trim(),
        phoneNumber: phoneNumber.trim(),
        avatar: avatar.trim(),
        bio: bio.trim(),
        statusMessage: statusMessage.trim(),
        profilePhotoVisibility: photoVisibility,
      });
      setSuccess('Profile saved and synced');
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Could not update profile'));
    } finally {
      setLoading(false);
    }
  };

  const handleRequestEmailChange = async () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed || !/^\S+@\S+\.\S+$/.test(trimmed)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    setEmailLoading(true);
    setEmailError('');
    try {
      await requestEmailChange(trimmed);
      setEmailStep('otp');
    } catch (err: any) {
      setEmailError(getApiErrorMessage(err, 'Could not send verification code'));
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyEmailChange = async () => {
    if (!/^\d{6}$/.test(emailOtp.trim())) {
      setEmailError('Enter the 6-digit verification code');
      return;
    }
    setEmailLoading(true);
    setEmailError('');
    try {
      await verifyEmailChange(emailOtp.trim());
      setEmailModalVisible(false);
      setEmailStep('input');
      setNewEmail('');
      setEmailOtp('');
      setSuccess('Email address updated and verified');
    } catch (err: any) {
      setEmailError(getApiErrorMessage(err, 'Verification failed'));
    } finally {
      setEmailLoading(false);
    }
  };

  const initial = (displayName || user?.username || '?').charAt(0).toUpperCase();

  return (
    <SafeAreaView style={styles.page} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Profile & Account</Text>
        <View style={{ width: 52 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Avatar & Photo Picker */}
        <View style={styles.avatarCard}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarInitial}>{initial}</Text>
            </View>
          )}
          <View style={styles.avatarInfo}>
            <Text style={styles.usernameTitle}>
              {displayName || `@${user?.username}`}
            </Text>
            <Text style={styles.subHandle}>@{user?.username}</Text>
            <Pressable
              onPress={pickAndCropImage}
              disabled={pickingImage}
              style={styles.photoBtn}
            >
              {pickingImage ? (
                <ActivityIndicator color="#E0E7FF" size="small" />
              ) : (
                <Text style={styles.photoBtnText}>Upload & Crop Photo</Text>
              )}
            </Pressable>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {success ? <Text style={styles.success}>{success}</Text> : null}

        {/* Profile Form */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Profile Details</Text>

          <Text style={styles.label}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="username"
            placeholderTextColor="#64748B"
            autoCapitalize="none"
            style={styles.input}
          />

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Your full name"
            placeholderTextColor="#64748B"
            style={styles.input}
          />

          <Text style={styles.label}>Phone Number</Text>
          <TextInput
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="+1 555 012 3456"
            placeholderTextColor="#64748B"
            keyboardType="phone-pad"
            style={styles.input}
          />

          <Text style={styles.label}>Avatar URL (optional)</Text>
          <TextInput
            value={avatar.startsWith('data:') ? '' : avatar}
            onChangeText={setAvatar}
            placeholder="https://..."
            placeholderTextColor="#64748B"
            autoCapitalize="none"
            style={styles.input}
          />

          <Text style={styles.label}>Status Message</Text>
          <TextInput
            value={statusMessage}
            onChangeText={setStatusMessage}
            placeholder="What are you up to?"
            placeholderTextColor="#64748B"
            style={styles.input}
          />

          <Text style={styles.label}>Bio</Text>
          <TextInput
            value={bio}
            onChangeText={setBio}
            placeholder="About you"
            placeholderTextColor="#64748B"
            multiline
            style={[styles.input, styles.bio]}
          />

          <Text style={styles.label}>Profile Photo Privacy</Text>
          <View style={styles.visRow}>
            {(['everyone', 'contacts', 'nobody'] as PhotoVisibility[]).map((opt) => {
              const active = photoVisibility === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => setPhotoVisibility(opt)}
                  style={[styles.visChip, active && styles.visChipActive]}
                >
                  <Text style={[styles.visText, active && styles.visTextActive]}>
                    {opt.charAt(0).toUpperCase() + opt.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={save}
            disabled={loading}
            style={[styles.button, loading && styles.disabledBtn]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Save Profile</Text>
            )}
          </Pressable>
        </View>

        {/* Account Information & Email Verification */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          <View style={styles.accountRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.accountLabel}>Verified Email</Text>
              <Text style={styles.accountValue}>{user?.email}</Text>
            </View>
            <Pressable
              onPress={() => {
                setEmailStep('input');
                setEmailError('');
                setNewEmail('');
                setEmailOtp('');
                setEmailModalVisible(true);
              }}
              style={styles.changeEmailBtn}
            >
              <Text style={styles.changeEmailText}>Change</Text>
            </Pressable>
          </View>

          {user?.createdAt ? (
            <Text style={styles.memberSince}>
              Member since {new Date(user.createdAt).toLocaleDateString()}
            </Text>
          ) : null}
        </View>

        {/* Settings Shortcuts */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Settings & Tools</Text>
          <Pressable onPress={() => router.push('/settings')} style={styles.navBtn}>
            <Text style={styles.navBtnText}>App Settings</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/security')} style={styles.navBtn}>
            <Text style={styles.navBtnText}>Privacy & Security</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/backup')} style={styles.navBtn}>
            <Text style={styles.navBtnText}>Backup & Sync Settings</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/call-history')} style={styles.navBtn}>
            <Text style={styles.navBtnText}>Call History</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* Email Change Modal */}
      <Modal
        visible={emailModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEmailModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {emailStep === 'input' ? 'Change Email Address' : 'Verify New Email'}
            </Text>
            {emailError ? <Text style={styles.error}>{emailError}</Text> : null}

            {emailStep === 'input' ? (
              <TextInput
                value={newEmail}
                onChangeText={setNewEmail}
                placeholder="newemail@example.com"
                placeholderTextColor="#64748B"
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.input}
              />
            ) : (
              <TextInput
                value={emailOtp}
                onChangeText={setEmailOtp}
                placeholder="6-digit verification code"
                placeholderTextColor="#64748B"
                keyboardType="number-pad"
                maxLength={6}
                style={styles.input}
              />
            )}

            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setEmailModalVisible(false)}
                style={styles.modalCancelBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={
                  emailStep === 'input' ? handleRequestEmailChange : handleVerifyEmailChange
                }
                disabled={emailLoading}
                style={styles.modalConfirmBtn}
              >
                {emailLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalConfirmText}>
                    {emailStep === 'input' ? 'Send Code' : 'Verify'}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#020617' },
  header: {
    height: 60,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: { color: '#818CF8', fontWeight: '700', fontSize: 14 },
  title: { color: '#F8FAFC', fontSize: 17, fontWeight: '800' },
  scrollContent: { padding: 16, gap: 14 },
  avatarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 16,
  },
  avatarImg: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#1E293B' },
  avatarFallback: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#FFFFFF', fontSize: 30, fontWeight: '800' },
  avatarInfo: { flex: 1, gap: 4 },
  usernameTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '800' },
  subHandle: { color: '#818CF8', fontSize: 13, fontWeight: '600' },
  photoBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#312E81',
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  photoBtnText: { color: '#E0E7FF', fontSize: 12, fontWeight: '700' },
  card: {
    padding: 16,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 8,
  },
  sectionTitle: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  label: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
  input: {
    minHeight: 48,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    color: '#F8FAFC',
    paddingHorizontal: 12,
    marginBottom: 6,
  },
  bio: { height: 84, textAlignVertical: 'top', paddingVertical: 12 },
  visRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  visChip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#020617',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  visChipActive: { backgroundColor: '#1E1B4B', borderColor: '#6366F1' },
  visText: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
  visTextActive: { color: '#E0E7FF' },
  error: {
    color: '#FCA5A5',
    backgroundColor: '#450A0A',
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
  },
  success: {
    color: '#A7F3D0',
    backgroundColor: '#064E3B',
    borderRadius: 10,
    padding: 10,
    fontSize: 12,
  },
  button: {
    height: 50,
    backgroundColor: '#4F46E5',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  disabledBtn: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  accountLabel: { color: '#94A3B8', fontSize: 12 },
  accountValue: { color: '#F8FAFC', fontSize: 14, fontWeight: '700', marginTop: 2 },
  changeEmailBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  changeEmailText: { color: '#818CF8', fontSize: 12, fontWeight: '700' },
  memberSince: { color: '#64748B', fontSize: 12, marginTop: 4 },
  navBtn: {
    height: 46,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnText: { color: '#818CF8', fontWeight: '800', fontSize: 14 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#0F172A',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 20,
    gap: 12,
  },
  modalTitle: { color: '#F8FAFC', fontSize: 17, fontWeight: '800' },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalCancelBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: { color: '#CBD5E1', fontWeight: '700' },
  modalConfirmBtn: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalConfirmText: { color: '#FFFFFF', fontWeight: '800' },
});
