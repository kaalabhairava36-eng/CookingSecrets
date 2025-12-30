import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { FlashList } from '@shopify/flash-list';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

interface Recipe {
  id: string;
  title: string;
  image: string;
  likes_count: number;
}

const getRoleBadge = (role: string) => {
  switch (role) {
    case 'admin':
      return { icon: 'shield-checkmark', color: '#FF4444', label: 'Admin' };
    case 'moderator':
      return { icon: 'ribbon', color: '#4CAF50', label: 'Moderator' };
    case 'chef':
      return { icon: 'star', color: '#FFD700', label: 'Chef' };
    default:
      return { icon: 'person', color: '#888', label: 'User' };
  }
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, updateUser, refreshUser } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editImage, setEditImage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchUserRecipes();
    }
  }, [user]);

  const fetchUserRecipes = async () => {
    if (!user) return;
    try {
      const data = await api.getRecipes({ author_id: user.id });
      setRecipes(data);
    } catch (error) {
      console.error('Error fetching recipes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const openEditModal = () => {
    setEditFullName(user?.full_name || '');
    setEditBio(user?.bio || '');
    setEditImage(user?.profile_image || null);
    setIsEditModalOpen(true);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setEditImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      const data: any = {};
      if (editFullName !== user?.full_name) data.full_name = editFullName;
      if (editBio !== user?.bio) data.bio = editBio;
      if (editImage !== user?.profile_image) data.profile_image = editImage;

      await api.updateProfile(data);
      await refreshUser();
      setIsEditModalOpen(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const badge = user ? getRoleBadge(user.role) : null;

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      </SafeAreaView>
    );
  }

  const renderRecipeGrid = ({ item }: { item: Recipe }) => (
    <TouchableOpacity
      style={styles.gridItem}
      onPress={() => router.push(`/recipe/${item.id}`)}
    >
      <Image source={{ uri: item.image }} style={styles.gridImage} />
      <View style={styles.gridOverlay}>
        <Ionicons name="heart" size={12} color="#fff" />
        <Text style={styles.gridLikes}>{item.likes_count}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#FF6B35" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Profile Info */}
        <View style={styles.profileSection}>
          <TouchableOpacity onPress={openEditModal}>
            {user.profile_image ? (
              <Image source={{ uri: user.profile_image }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="person" size={40} color="#888" />
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.fullName}>{user.full_name}</Text>
          <View style={styles.usernameRow}>
            <Text style={styles.username}>@{user.username}</Text>
            {badge && (
              <View style={[styles.roleBadge, { backgroundColor: badge.color + '20' }]}>
                <Ionicons name={badge.icon as any} size={12} color={badge.color} />
                <Text style={[styles.roleText, { color: badge.color }]}>{badge.label}</Text>
              </View>
            )}
          </View>

          {user.bio && <Text style={styles.bio}>{user.bio}</Text>}

          {/* Stats */}
          <View style={styles.stats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{user.recipes_count}</Text>
              <Text style={styles.statLabel}>Recipes</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{user.followers_count}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{user.following_count}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.editButton} onPress={openEditModal}>
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>

          {/* Admin/Moderator Link */}
          {(user.role === 'admin' || user.role === 'moderator') && (
            <TouchableOpacity
              style={styles.adminButton}
              onPress={() => router.push('/admin')}
            >
              <Ionicons name="shield-checkmark" size={18} color="#FF6B35" />
              <Text style={styles.adminButtonText}>Admin Dashboard</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Recipes Grid */}
        <View style={styles.recipesSection}>
          <Text style={styles.sectionTitle}>My Recipes</Text>
          {isLoading ? (
            <ActivityIndicator size="small" color="#FF6B35" />
          ) : recipes.length === 0 ? (
            <View style={styles.emptyRecipes}>
              <Ionicons name="restaurant-outline" size={40} color="#888" />
              <Text style={styles.emptyText}>No recipes yet</Text>
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => router.push('/(tabs)/create')}
              >
                <Text style={styles.createButtonText}>Create your first recipe</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.gridContainer}>
              <FlashList
                data={recipes}
                renderItem={renderRecipeGrid}
                estimatedItemSize={130}
                numColumns={3}
                scrollEnabled={false}
              />
            </View>
          )}
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={isEditModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setIsEditModalOpen(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={handleSaveProfile} disabled={isSaving}>
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FF6B35" />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <TouchableOpacity style={styles.imagePickerModal} onPress={pickImage}>
                {editImage ? (
                  <Image source={{ uri: editImage }} style={styles.editAvatar} />
                ) : (
                  <View style={styles.editAvatarPlaceholder}>
                    <Ionicons name="camera" size={30} color="#888" />
                  </View>
                )}
                <Text style={styles.changePhotoText}>Change Photo</Text>
              </TouchableOpacity>

              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.modalInput}
                value={editFullName}
                onChangeText={setEditFullName}
                placeholder="Your name"
                placeholderTextColor="#888"
              />

              <Text style={styles.inputLabel}>Bio</Text>
              <TextInput
                style={[styles.modalInput, styles.bioInput]}
                value={editBio}
                onChangeText={setEditBio}
                placeholder="Tell us about yourself"
                placeholderTextColor="#888"
                multiline
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  profileSection: {
    alignItems: 'center',
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#FF6B35',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FF6B35',
  },
  fullName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  username: {
    fontSize: 15,
    color: '#888',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bio: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
  },
  stats: {
    flexDirection: 'row',
    marginTop: 20,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#333',
  },
  editButton: {
    marginTop: 20,
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FF6B35',
  },
  editButtonText: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 107, 53, 0.15)',
    gap: 8,
  },
  adminButtonText: {
    color: '#FF6B35',
    fontWeight: '600',
  },
  recipesSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  gridContainer: {
    minHeight: 300,
  },
  gridItem: {
    flex: 1,
    aspectRatio: 1,
    margin: 1,
  },
  gridImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
  },
  gridOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 4,
    gap: 4,
  },
  gridLikes: {
    color: '#fff',
    fontSize: 11,
  },
  emptyRecipes: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    marginTop: 12,
  },
  createButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#FF6B35',
    borderRadius: 20,
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  saveText: {
    color: '#FF6B35',
    fontSize: 16,
    fontWeight: '600',
  },
  modalBody: {
    padding: 20,
  },
  imagePickerModal: {
    alignItems: 'center',
    marginBottom: 24,
  },
  editAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  editAvatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoText: {
    color: '#FF6B35',
    marginTop: 8,
    fontWeight: '500',
  },
  inputLabel: {
    color: '#888',
    fontSize: 13,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#0c0c0c',
    borderRadius: 8,
    padding: 14,
    color: '#fff',
    fontSize: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  bioInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
});
