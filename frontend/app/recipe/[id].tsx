import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';

interface Ingredient {
  name: string;
  amount: string;
  unit: string;
}

interface Step {
  step_number: number;
  instruction: string;
  duration_minutes?: number;
}

interface Recipe {
  id: string;
  author_id: string;
  author_username: string;
  author_profile_image?: string;
  author_role: string;
  title: string;
  description: string;
  image: string;
  ingredients: Ingredient[];
  steps: Step[];
  cooking_time_minutes: number;
  servings: number;
  difficulty: string;
  category: string;
  tags: string[];
  likes_count: number;
  comments_count: number;
  saves_count: number;
  created_at: string;
}

interface Comment {
  id: string;
  user_id: string;
  username: string;
  user_profile_image?: string;
  text: string;
  created_at: string;
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

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (id) {
      fetchRecipeDetails();
    }
  }, [id]);

  const fetchRecipeDetails = async () => {
    try {
      const [recipeData, commentsData, likedData, savedData] = await Promise.all([
        api.getRecipe(id!),
        api.getComments(id!),
        api.checkLiked(id!).catch(() => ({ liked: false })),
        api.checkSaved(id!).catch(() => ({ saved: false })),
      ]);
      setRecipe(recipeData);
      setComments(commentsData);
      setIsLiked(likedData.liked);
      setIsSaved(savedData.saved);
    } catch (error) {
      console.error('Error fetching recipe:', error);
      Alert.alert('Error', 'Failed to load recipe');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to like recipes');
      return;
    }
    try {
      const result = await api.likeRecipe(id!);
      setIsLiked(result.liked);
      setRecipe(prev => prev ? {
        ...prev,
        likes_count: result.liked ? prev.likes_count + 1 : prev.likes_count - 1
      } : null);
    } catch (error) {
      console.error('Error liking recipe:', error);
    }
  };

  const handleSave = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to save recipes');
      return;
    }
    try {
      const result = await api.saveRecipe(id!);
      setIsSaved(result.saved);
    } catch (error) {
      console.error('Error saving recipe:', error);
    }
  };

  const handleComment = async () => {
    if (!user) {
      Alert.alert('Login Required', 'Please login to comment');
      return;
    }
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const comment = await api.createComment(id!, newComment.trim());
      setComments([comment, ...comments]);
      setNewComment('');
      setRecipe(prev => prev ? { ...prev, comments_count: prev.comments_count + 1 } : null);
    } catch (error) {
      Alert.alert('Error', 'Failed to post comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRecipe = async () => {
    Alert.alert('Delete Recipe', 'Are you sure you want to delete this recipe?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteRecipe(id!);
            router.back();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete recipe');
          }
        },
      },
    ]);
  };

  if (isLoading || !recipe) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B35" />
        </View>
      </SafeAreaView>
    );
  }

  const badge = getRoleBadge(recipe.author_role);
  const canDelete = user && (user.id === recipe.author_id || user.role === 'admin' || user.role === 'moderator');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{recipe.title}</Text>
          {canDelete && (
            <TouchableOpacity onPress={handleDeleteRecipe}>
              <Ionicons name="trash-outline" size={22} color="#ff4444" />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Recipe Image */}
          <Image source={{ uri: recipe.image }} style={styles.recipeImage} />

          {/* Actions */}
          <View style={styles.actions}>
            <View style={styles.leftActions}>
              <TouchableOpacity style={styles.actionButton} onPress={handleLike}>
                <Ionicons
                  name={isLiked ? 'heart' : 'heart-outline'}
                  size={28}
                  color={isLiked ? '#ff4444' : '#fff'}
                />
                <Text style={styles.actionCount}>{recipe.likes_count}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="chatbubble-outline" size={26} color="#fff" />
                <Text style={styles.actionCount}>{recipe.comments_count}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity onPress={handleSave}>
              <Ionicons
                name={isSaved ? 'bookmark' : 'bookmark-outline'}
                size={26}
                color={isSaved ? '#FF6B35' : '#fff'}
              />
            </TouchableOpacity>
          </View>

          {/* Author */}
          <TouchableOpacity
            style={styles.authorSection}
            onPress={() => router.push(`/user/${recipe.author_id}`)}
          >
            {recipe.author_profile_image ? (
              <Image source={{ uri: recipe.author_profile_image }} style={styles.authorAvatar} />
            ) : (
              <View style={styles.authorAvatarPlaceholder}>
                <Ionicons name="person" size={20} color="#888" />
              </View>
            )}
            <View>
              <View style={styles.usernameRow}>
                <Text style={styles.authorName}>@{recipe.author_username}</Text>
                {badge && <Ionicons name={badge.icon as any} size={14} color={badge.color} />}
              </View>
              <Text style={styles.createdAt}>
                {new Date(recipe.created_at).toLocaleDateString()}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Title & Description */}
          <View style={styles.content}>
            <Text style={styles.title}>{recipe.title}</Text>
            <Text style={styles.description}>{recipe.description}</Text>

            {/* Meta Info */}
            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={18} color="#FF6B35" />
                <Text style={styles.metaText}>{recipe.cooking_time_minutes} min</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="people-outline" size={18} color="#FF6B35" />
                <Text style={styles.metaText}>{recipe.servings} servings</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="speedometer-outline" size={18} color="#FF6B35" />
                <Text style={styles.metaText}>{recipe.difficulty}</Text>
              </View>
            </View>

            {/* Tags */}
            {recipe.tags.length > 0 && (
              <View style={styles.tagsContainer}>
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{recipe.category}</Text>
                </View>
                {recipe.tags.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>#{tag}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Ingredients */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Ingredients</Text>
              {recipe.ingredients.map((ing, index) => (
                <View key={index} style={styles.ingredientItem}>
                  <View style={styles.bulletPoint} />
                  <Text style={styles.ingredientText}>
                    {ing.amount} {ing.unit} {ing.name}
                  </Text>
                </View>
              ))}
            </View>

            {/* Steps */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Instructions</Text>
              {recipe.steps.map((step, index) => (
                <View key={index} style={styles.stepItem}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>{step.step_number}</Text>
                  </View>
                  <Text style={styles.stepText}>{step.instruction}</Text>
                </View>
              ))}
            </View>

            {/* Comments Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Comments ({recipe.comments_count})</Text>
              
              {/* Comment Input */}
              <View style={styles.commentInput}>
                <TextInput
                  style={styles.input}
                  placeholder="Add a comment..."
                  placeholderTextColor="#888"
                  value={newComment}
                  onChangeText={setNewComment}
                  multiline
                />
                <TouchableOpacity
                  style={styles.sendButton}
                  onPress={handleComment}
                  disabled={isSubmitting || !newComment.trim()}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FF6B35" />
                  ) : (
                    <Ionicons name="send" size={20} color="#FF6B35" />
                  )}
                </TouchableOpacity>
              </View>

              {/* Comments List */}
              {comments.map((comment) => (
                <View key={comment.id} style={styles.commentItem}>
                  {comment.user_profile_image ? (
                    <Image source={{ uri: comment.user_profile_image }} style={styles.commentAvatar} />
                  ) : (
                    <View style={styles.commentAvatarPlaceholder}>
                      <Ionicons name="person" size={14} color="#888" />
                    </View>
                  )}
                  <View style={styles.commentContent}>
                    <Text style={styles.commentUsername}>@{comment.username}</Text>
                    <Text style={styles.commentText}>{comment.text}</Text>
                    <Text style={styles.commentTime}>
                      {new Date(comment.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0c0c0c',
  },
  flex: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    gap: 12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  recipeImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#1a1a1a',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  leftActions: {
    flexDirection: 'row',
    gap: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  actionCount: {
    color: '#fff',
    fontSize: 15,
  },
  authorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  authorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  authorAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  authorName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  createdAt: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: '#ccc',
    lineHeight: 22,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    color: '#ccc',
    fontSize: 14,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  categoryBadge: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  tag: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    color: '#888',
    fontSize: 13,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  bulletPoint: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FF6B35',
  },
  ingredientText: {
    color: '#ccc',
    fontSize: 15,
  },
  stepItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  stepText: {
    flex: 1,
    color: '#ccc',
    fontSize: 15,
    lineHeight: 22,
  },
  commentInput: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    gap: 10,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    padding: 6,
  },
  commentItem: {
    flexDirection: 'row',
    paddingVertical: 12,
    gap: 12,
  },
  commentAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  commentAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentContent: {
    flex: 1,
  },
  commentUsername: {
    color: '#FF6B35',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  commentText: {
    color: '#ccc',
    fontSize: 14,
    lineHeight: 20,
  },
  commentTime: {
    color: '#666',
    fontSize: 11,
    marginTop: 4,
  },
});
