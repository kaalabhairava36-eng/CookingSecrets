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
  title: string;
  image: string;
  author_username: string;
  cooking_time_minutes: number;
}

export default function SavedScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchSavedRecipes = async () => {
    if (!user) return;
    try {
      const data = await api.getSavedRecipes(user.id);
      setRecipes(data);
    } catch (error) {
      console.error('Error fetching saved recipes:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSavedRecipes();
  }, [user]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchSavedRecipes();
  }, [user]);

  const renderSavedItem = ({ item }: { item: Recipe }) => (
    <TouchableOpacity
      style={styles.savedItem}
      onPress={() => router.push(`/recipe/${item.id}`)}
      activeOpacity={0.9}
    >
      <Image source={{ uri: item.image }} style={styles.savedImage} />
      <View style={styles.savedInfo}>
        <Text style={styles.savedTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.savedAuthor}>@{item.author_username}</Text>
        <View style={styles.savedMeta}>
          <Ionicons name="time-outline" size={14} color="#888" />
          <Text style={styles.savedMetaText}>{item.cooking_time_minutes} min</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#888" />
    </TouchableOpacity>
  );

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
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Saved Recipes</Text>
      </View>

      {recipes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="bookmark-outline" size={60} color="#888" />
          <Text style={styles.emptyText}>No saved recipes yet</Text>
          <Text style={styles.emptySubtext}>
            Tap the bookmark icon on recipes to save them here
          </Text>
        </View>
      ) : (
        <FlashList
          data={recipes}
          renderItem={renderSavedItem}
          estimatedItemSize={100}
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
  listContent: {
    padding: 16,
  },
  savedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  savedImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  savedInfo: {
    flex: 1,
    marginLeft: 12,
  },
  savedTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  savedAuthor: {
    color: '#FF6B35',
    fontSize: 13,
    marginBottom: 4,
  },
  savedMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savedMetaText: {
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
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});
