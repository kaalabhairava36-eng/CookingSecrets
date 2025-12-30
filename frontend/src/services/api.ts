import axios, { AxiosInstance } from 'axios';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8001';

class ApiService {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: `${BASE_URL}/api`,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.client.defaults.headers.common['Authorization'];
    }
  }

  // Auth
  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    return response.data;
  }

  async register(email: string, password: string, username: string, full_name: string) {
    const response = await this.client.post('/auth/register', { email, password, username, full_name });
    return response.data;
  }

  async getMe() {
    const response = await this.client.get('/auth/me');
    return response.data;
  }

  // Users
  async getUsers() {
    const response = await this.client.get('/users');
    return response.data;
  }

  async getUser(userId: string) {
    const response = await this.client.get(`/users/${userId}`);
    return response.data;
  }

  async getUserByUsername(username: string) {
    const response = await this.client.get(`/users/username/${username}`);
    return response.data;
  }

  async updateUserRole(userId: string, role: string) {
    const response = await this.client.put(`/users/${userId}/role`, { role });
    return response.data;
  }

  async updateProfile(data: { full_name?: string; bio?: string; profile_image?: string }) {
    const response = await this.client.put('/users/profile', data);
    return response.data;
  }

  async toggleUserActive(userId: string) {
    const response = await this.client.put(`/users/${userId}/toggle-active`);
    return response.data;
  }

  // Recipes
  async createRecipe(data: any) {
    const response = await this.client.post('/recipes', data);
    return response.data;
  }

  async getRecipes(params?: { skip?: number; limit?: number; category?: string; author_id?: string; featured_only?: boolean }) {
    const response = await this.client.get('/recipes', { params });
    return response.data;
  }

  async getRecipe(recipeId: string) {
    const response = await this.client.get(`/recipes/${recipeId}`);
    return response.data;
  }

  async updateRecipe(recipeId: string, data: any) {
    const response = await this.client.put(`/recipes/${recipeId}`, data);
    return response.data;
  }

  async deleteRecipe(recipeId: string) {
    const response = await this.client.delete(`/recipes/${recipeId}`);
    return response.data;
  }

  async searchRecipes(query: string) {
    const response = await this.client.get(`/recipes/search/${encodeURIComponent(query)}`);
    return response.data;
  }

  // Likes
  async likeRecipe(recipeId: string) {
    const response = await this.client.post(`/recipes/${recipeId}/like`);
    return response.data;
  }

  async checkLiked(recipeId: string) {
    const response = await this.client.get(`/recipes/${recipeId}/liked`);
    return response.data;
  }

  // Saves
  async saveRecipe(recipeId: string) {
    const response = await this.client.post(`/recipes/${recipeId}/save`);
    return response.data;
  }

  async checkSaved(recipeId: string) {
    const response = await this.client.get(`/recipes/${recipeId}/saved`);
    return response.data;
  }

  async getSavedRecipes(userId: string) {
    const response = await this.client.get(`/users/${userId}/saved-recipes`);
    return response.data;
  }

  // Comments
  async createComment(recipeId: string, text: string) {
    const response = await this.client.post(`/recipes/${recipeId}/comments`, { text });
    return response.data;
  }

  async getComments(recipeId: string) {
    const response = await this.client.get(`/recipes/${recipeId}/comments`);
    return response.data;
  }

  async deleteComment(commentId: string) {
    const response = await this.client.delete(`/comments/${commentId}`);
    return response.data;
  }

  // Follow
  async followUser(userId: string) {
    const response = await this.client.post(`/users/${userId}/follow`);
    return response.data;
  }

  async checkFollowing(userId: string) {
    const response = await this.client.get(`/users/${userId}/is-following`);
    return response.data;
  }

  async getFollowers(userId: string) {
    const response = await this.client.get(`/users/${userId}/followers`);
    return response.data;
  }

  async getFollowing(userId: string) {
    const response = await this.client.get(`/users/${userId}/following`);
    return response.data;
  }

  // Feed
  async getFeed(skip: number = 0, limit: number = 20) {
    const response = await this.client.get('/feed', { params: { skip, limit } });
    return response.data;
  }

  async getExplore(skip: number = 0, limit: number = 20) {
    const response = await this.client.get('/explore', { params: { skip, limit } });
    return response.data;
  }

  async getCategories() {
    const response = await this.client.get('/categories');
    return response.data;
  }

  // Admin
  async getAdminStats() {
    const response = await this.client.get('/admin/stats');
    return response.data;
  }

  // AI Chatbot
  async sendChatMessage(message: string, sessionId?: string) {
    const response = await this.client.post('/chat', { message, session_id: sessionId });
    return response.data;
  }

  async getChatHistory(sessionId?: string) {
    const params = sessionId ? { session_id: sessionId } : {};
    const response = await this.client.get('/chat/history', { params });
    return response.data;
  }

  async getChatSessions() {
    const response = await this.client.get('/chat/sessions');
    return response.data;
  }

  async deleteChatSession(sessionId: string) {
    const response = await this.client.delete(`/chat/session/${sessionId}`);
    return response.data;
  }

  // Recipe Purchase
  async purchaseRecipe(recipeId: string) {
    const response = await this.client.post(`/recipes/${recipeId}/purchase`);
    return response.data;
  }

  async checkPurchased(recipeId: string) {
    const response = await this.client.get(`/recipes/${recipeId}/purchased`);
    return response.data;
  }

  async getPurchasedRecipes(userId: string) {
    const response = await this.client.get(`/users/${userId}/purchases`);
    return response.data;
  }
}

export const api = new ApiService();
