import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  role: string;
  bio?: string;
  profile_image?: string;
  followers_count: number;
  following_count: number;
  recipes_count: number;
}

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

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  useEffect(() => {
    if (id) {
      fetchUserProfile();
    }
  }, [id]);

  const fetchUserProfile = async () => {
    try {
      const [userData, userRecipes, followStatus] = await Promise.all([
        api.getUser(id!),
        api.getRecipes({ author_id: id }),
        user ? api.checkFollowing(id!).catch(() => ({ following: false })) : { following: false },
      ]);
      setProfile(userData);
      setRecipes(userRecipes);
      setIsFollowing(followStatus.following);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!user) return;
    setIsFollowLoading(true);
    try {
      const result = await api.followUser(id!);
      setIsFollowing(result.following);
      setProfile(prev => prev ? {
        ...prev,
        followers_count: result.following ? prev.followers_count + 1 : prev.followers_count - 1
      } : null);
    } catch (error) {
      console.error('Error following user:', error);
    } finally {
      setIsFollowLoading(false);
    }
  };

  if (isLoading || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      </SafeAreaView>
    );
  }

  const badge = getRoleBadge(profile.role);
  const isOwnProfile = user?.id === profile.id;

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
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>@{profile.username}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Profile Info */}
        <View style={styles.profileSection}>
          {profile.profile_image ? (
            <Image source={{ uri: profile.profile_image }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={40} color="#888" />
            </View>
          )}

          <Text style={styles.fullName}>{profile.full_name}</Text>
          <View style={styles.usernameRow}>
            <Text style={styles.username}>@{profile.username}</Text>
            <View style={[styles.roleBadge, { backgroundColor: badge.color + '20' }]}>
              <Ionicons name={badge.icon as any} size={12} color={badge.color} />
              <Text style={[styles.roleText, { color: badge.color }]}>{badge.label}</Text>
            </View>
          </View>

          {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}

          {/* Stats */}
          <View style={styles.stats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{profile.recipes_count}</Text>
              <Text style={styles.statLabel}>Recipes</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{profile.followers_count}</Text>
              <Text style={styles.statLabel}>Followers</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{profile.following_count}</Text>
              <Text style={styles.statLabel}>Following</Text>
            </View>
          </View>

          {/* Follow Button */}
          {!isOwnProfile && user && (
            <TouchableOpacity
              style={[styles.followButton, isFollowing && styles.followingButton]}
              onPress={handleFollow}
              disabled={isFollowLoading}
            >
              {isFollowLoading ? (
                <ActivityIndicator size="small" color={isFollowing ? '#FF6B35' : '#fff'} />
              ) : (
                <Text style={[styles.followButtonText, isFollowing && styles.followingButtonText]}>
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Recipes Grid */}
        <View style={styles.recipesSection}>
          <Text style={styles.sectionTitle}>Recipes</Text>
          {recipes.length === 0 ? (
            <View style={styles.emptyRecipes}>
              <Ionicons name="restaurant-outline" size={40} color="#888" />
              <Text style={styles.emptyText}>No recipes yet</Text>
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
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
  followButton: {
    marginTop: 20,
    paddingHorizontal: 40,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FF6B35',
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#FF6B35',
  },
  followButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  followingButtonText: {
    color: '#FF6B35',
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
});
