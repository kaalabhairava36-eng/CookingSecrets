import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../src/services/api';

const CATEGORIES = [
  'Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Appetizer',
  'Salad', 'Soup', 'Snack', 'Beverage', 'Side Dish',
  'Vegan', 'Vegetarian', 'Seafood', 'Meat', 'Pasta',
  'Asian', 'Italian', 'Mexican', 'Indian', 'Mediterranean'
];

const DIFFICULTIES = ['easy', 'medium', 'hard'];

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

export default function CreateScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [difficulty, setDifficulty] = useState('easy');
  const [cookingTime, setCookingTime] = useState('');
  const [servings, setServings] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([{ name: '', amount: '', unit: '' }]);
  const [steps, setSteps] = useState<Step[]>([{ step_number: 1, instruction: '' }]);
  const [tags, setTags] = useState('');
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState('');

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera roll permissions to upload images.');
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
      setImage(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', amount: '', unit: '' }]);
  };

  const removeIngredient = (index: number) => {
    if (ingredients.length > 1) {
      setIngredients(ingredients.filter((_, i) => i !== index));
    }
  };

  const updateIngredient = (index: number, field: keyof Ingredient, value: string) => {
    const updated = [...ingredients];
    updated[index][field] = value;
    setIngredients(updated);
  };

  const addStep = () => {
    setSteps([...steps, { step_number: steps.length + 1, instruction: '' }]);
  };

  const removeStep = (index: number) => {
    if (steps.length > 1) {
      const updated = steps.filter((_, i) => i !== index);
      setSteps(updated.map((s, i) => ({ ...s, step_number: i + 1 })));
    }
  };

  const updateStep = (index: number, value: string) => {
    const updated = [...steps];
    updated[index].instruction = value;
    setSteps(updated);
  };

  const handleSubmit = async () => {
    if (!image) {
      Alert.alert('Error', 'Please add a photo of your dish');
      return;
    }
    if (!title.trim()) {
      Alert.alert('Error', 'Please add a title');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Please add a description');
      return;
    }
    if (!cookingTime || parseInt(cookingTime) <= 0) {
      Alert.alert('Error', 'Please add valid cooking time');
      return;
    }
    if (!servings || parseInt(servings) <= 0) {
      Alert.alert('Error', 'Please add valid servings');
      return;
    }

    const validIngredients = ingredients.filter(i => i.name.trim() && i.amount.trim());
    if (validIngredients.length === 0) {
      Alert.alert('Error', 'Please add at least one ingredient');
      return;
    }

    const validSteps = steps.filter(s => s.instruction.trim());
    if (validSteps.length === 0) {
      Alert.alert('Error', 'Please add at least one step');
      return;
    }

    setIsLoading(true);
    try {
      const recipeData = {
        title: title.trim(),
        description: description.trim(),
        image,
        category,
        difficulty,
        cooking_time_minutes: parseInt(cookingTime),
        servings: parseInt(servings),
        ingredients: validIngredients,
        steps: validSteps.map((s, i) => ({ ...s, step_number: i + 1 })),
        tags: tags.split(',').map(t => t.trim()).filter(t => t),
      };

      await api.createRecipe(recipeData);
      Alert.alert('Success', 'Recipe created successfully!', [
        { text: 'OK', onPress: () => router.push('/(tabs)/home') }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to create recipe');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Create Recipe</Text>
          <TouchableOpacity
            style={[styles.postButton, isLoading && styles.postButtonDisabled]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.postButtonText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Image Picker */}
          <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
            {image ? (
              <Image source={{ uri: image }} style={styles.previewImage} />
            ) : (
              <View style={styles.imagePickerContent}>
                <Ionicons name="camera" size={40} color="#888" />
                <Text style={styles.imagePickerText}>Add Photo</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Basic Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Info</Text>
            <TextInput
              style={styles.input}
              placeholder="Recipe Title"
              placeholderTextColor="#888"
              value={title}
              onChangeText={setTitle}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description"
              placeholderTextColor="#888"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
            />
          </View>

          {/* Category */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipContainer}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.chip, category === cat && styles.chipActive]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Difficulty */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Difficulty</Text>
            <View style={styles.chipContainer}>
              {DIFFICULTIES.map((diff) => (
                <TouchableOpacity
                  key={diff}
                  style={[styles.chip, difficulty === diff && styles.chipActive]}
                  onPress={() => setDifficulty(diff)}
                >
                  <Text style={[styles.chipText, difficulty === diff && styles.chipTextActive]}>
                    {diff.charAt(0).toUpperCase() + diff.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Time and Servings */}
          <View style={styles.section}>
            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Text style={styles.label}>Cooking Time (min)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="30"
                  placeholderTextColor="#888"
                  value={cookingTime}
                  onChangeText={setCookingTime}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.halfInput}>
                <Text style={styles.label}>Servings</Text>
                <TextInput
                  style={styles.input}
                  placeholder="4"
                  placeholderTextColor="#888"
                  value={servings}
                  onChangeText={setServings}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          {/* Ingredients */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Ingredients</Text>
              <TouchableOpacity onPress={addIngredient}>
                <Ionicons name="add-circle" size={24} color="#FF6B35" />
              </TouchableOpacity>
            </View>
            {ingredients.map((ing, index) => (
              <View key={index} style={styles.ingredientRow}>
                <TextInput
                  style={[styles.input, styles.ingredientAmount]}
                  placeholder="1"
                  placeholderTextColor="#888"
                  value={ing.amount}
                  onChangeText={(v) => updateIngredient(index, 'amount', v)}
                />
                <TextInput
                  style={[styles.input, styles.ingredientUnit]}
                  placeholder="cup"
                  placeholderTextColor="#888"
                  value={ing.unit}
                  onChangeText={(v) => updateIngredient(index, 'unit', v)}
                />
                <TextInput
                  style={[styles.input, styles.ingredientName]}
                  placeholder="Ingredient"
                  placeholderTextColor="#888"
                  value={ing.name}
                  onChangeText={(v) => updateIngredient(index, 'name', v)}
                />
                {ingredients.length > 1 && (
                  <TouchableOpacity onPress={() => removeIngredient(index)}>
                    <Ionicons name="close-circle" size={24} color="#ff4444" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>

          {/* Steps */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Steps</Text>
              <TouchableOpacity onPress={addStep}>
                <Ionicons name="add-circle" size={24} color="#FF6B35" />
              </TouchableOpacity>
            </View>
            {steps.map((step, index) => (
              <View key={index} style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.stepInput]}
                  placeholder="Describe this step..."
                  placeholderTextColor="#888"
                  value={step.instruction}
                  onChangeText={(v) => updateStep(index, v)}
                  multiline
                />
                {steps.length > 1 && (
                  <TouchableOpacity onPress={() => removeStep(index)}>
                    <Ionicons name="close-circle" size={24} color="#ff4444" />
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>

          {/* Tags */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tags</Text>
            <TextInput
              style={styles.input}
              placeholder="healthy, quick, family (comma separated)"
              placeholderTextColor="#888"
              value={tags}
              onChangeText={setTags}
            />
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
  keyboardView: {
    flex: 1,
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
  postButton: {
    backgroundColor: '#FF6B35',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postButtonDisabled: {
    opacity: 0.7,
  },
  postButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  imagePicker: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  imagePickerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePickerText: {
    color: '#888',
    marginTop: 8,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  label: {
    color: '#888',
    fontSize: 13,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
  },
  chipActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  chipText: {
    color: '#888',
    fontSize: 13,
  },
  chipTextActive: {
    color: '#fff',
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  ingredientAmount: {
    width: 60,
    marginBottom: 0,
  },
  ingredientUnit: {
    width: 70,
    marginBottom: 0,
  },
  ingredientName: {
    flex: 1,
    marginBottom: 0,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF6B35',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  stepNumberText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  stepInput: {
    flex: 1,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 0,
  },
});
