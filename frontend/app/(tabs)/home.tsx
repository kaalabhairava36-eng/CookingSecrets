import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlashList } from '@shopify/flash-list';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

interface Recipe {
  id: string;
  author_id: string;
  author_username: string;
  author_profile_image?: string;
  author_role: string;
  title: string;
  description: string;
  image: string;
  cooking_time_minutes: number;
  difficulty: string;
  likes_count: number;
  comments_count: number;
  created_at: string;
  is_paid?: boolean;
  price?: number;
}

const getRoleBadge = (role: string) => {
  switch (role) {
    case 'admin':
      return { icon: 'shield-checkmark', color: '#FF4444' };
    case 'moderator':
      return { icon: 'ribbon', color: '#4CAF50' };
    case 'chef':
      return { icon: 'star', color: '#FFD700' };
    default:
      return null;
  }
};

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchFeed = async () => {
    try {
      const data = await api.getFeed();
      setRecipes(data);
    } catch (error) {
      console.error('Error fetching feed:', error);
      // If feed is empty (no follows), get explore instead
      try {
        const exploreData = await api.getExplore();
        setRecipes(exploreData);
      } catch (err) {
        console.error('Error fetching explore:', err);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const data = await api.getUnreadNotificationCount();
      setUnreadCount(data.count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  useEffect(() => {
    fetchFeed();
    fetchUnreadCount();
  }, []);
    fetchFeed();
  }, []);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchFeed();
  }, []);

  const renderRecipeCard = ({ item }: { item: Recipe }) => {
    const badge = getRoleBadge(item.author_role);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/recipe/${item.id}`)}
        activeOpacity={0.9}
      >
        {/* Header */}
        <TouchableOpacity
          style={styles.cardHeader}
          onPress={() => router.push(`/user/${item.author_id}`)}
        >
          <View style={styles.authorInfo}>
            {item.author_profile_image ? (
              <Image
                source={{ uri: item.author_profile_image }}
                style={styles.authorAvatar}
              />
            ) : (
              <View style={styles.authorAvatarPlaceholder}>
                <Ionicons name="person" size={16} color="#888" />
              </View>
            )}
            <View>
              <View style={styles.usernameRow}>
                <Text style={styles.authorName}>@{item.author_username}</Text>
                {badge && (
                  <Ionicons name={badge.icon as any} size={14} color={badge.color} style={styles.badge} />
                )}
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {/* Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: item.image }}
            style={styles.recipeImage}
            resizeMode="cover"
          />
          {item.is_paid && (
            <View style={styles.paidBadge}>
              <Ionicons name="lock-closed" size={12} color="#fff" />
              <Text style={styles.paidText}>${item.price?.toFixed(2)}</Text>
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <View style={styles.leftActions}>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="heart-outline" size={26} color="#fff" />
              <Text style={styles.actionCount}>{item.likes_count}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push(`/recipe/${item.id}`)}
            >
              <Ionicons name="chatbubble-outline" size={24} color="#fff" />
              <Text style={styles.actionCount}>{item.comments_count}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="bookmark-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.cardContent}>
          <Text style={styles.recipeTitle}>{item.title}</Text>
          <Text style={styles.recipeDescription} numberOfLines={2}>
            {item.description}
          </Text>
          <View style={styles.metaInfo}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={14} color="#888" />
              <Text style={styles.metaText}>{item.cooking_time_minutes} min</Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="speedometer-outline" size={14} color="#888" />
              <Text style={styles.metaText}>{item.difficulty}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Cooking Secret</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push('/notifications')} style={styles.headerButton}>
            <View>
              <Ionicons name="notifications-outline" size={24} color="#fff" />
              {unreadCount > 0 && (
                <View style={styles.notificationBadge}>
                  <Text style={styles.notificationBadgeText}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/chatbot')} style={styles.headerButton}>
            <Ionicons name="chatbubbles-outline" size={24} color="#FF6B35" />
          </TouchableOpacity>
          {user && (user.role === 'admin' || user.role === 'moderator') && (
            <TouchableOpacity onPress={() => router.push('/admin')} style={styles.headerButton}>
              <Ionicons name="shield-checkmark" size={24} color="#FF6B35" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {recipes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="restaurant-outline" size={60} color="#888" />
          <Text style={styles.emptyText}>No recipes yet</Text>
          <Text style={styles.emptySubtext}>
            Follow chefs or create your first recipe!
          </Text>
        </View>
      ) : (
        <FlashList
          data={recipes}
          renderItem={renderRecipeCard}
          estimatedItemSize={450}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor="#FF6B35"
            />
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Floating Chatbot Button */}
      <TouchableOpacity
        style={styles.floatingChatButton}
        onPress={() => router.push('/chatbot')}
      >
        <Ionicons name="chatbubbles" size={26} color="#fff" />
      </TouchableOpacity>
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
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B35',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerButton: {
    padding: 4,
  },
  listContent: {
    paddingBottom: 80,
  },
  card: {
    backgroundColor: '#0c0c0c',
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 10,
  },
  authorAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  authorName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  badge: {
    marginLeft: 6,
  },
  imageContainer: {
    position: 'relative',
  },
  recipeImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#1a1a1a',
  },
  paidBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#4CAF50',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  paidText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  leftActions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionCount: {
    color: '#fff',
    fontSize: 14,
  },
  cardContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  recipeTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  recipeDescription: {
    color: '#888',
    fontSize: 14,
    lineHeight: 20,
  },
  metaInfo: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: '#888',
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  floatingChatButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
});
