import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../services/api';

interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  role: string;
  bio?: string;
  profile_image?: string;
  followers_count: number;
  following_count: number;
  recipes_count: number;
  created_at: string;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string, fullName: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        api.setToken(storedToken);
        
        // Verify token is still valid
        try {
          const response = await api.getMe();
          setUser(response);
          await AsyncStorage.setItem('user', JSON.stringify(response));
        } catch (error) {
          // Token invalid, clear auth
          await logout();
        }
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const response = await api.login(email, password);
    setUser(response.user);
    setToken(response.token);
    api.setToken(response.token);
    await AsyncStorage.setItem('token', response.token);
    await AsyncStorage.setItem('user', JSON.stringify(response.user));
  };

  const register = async (email: string, password: string, username: string, fullName: string) => {
    const response = await api.register(email, password, username, fullName);
    setUser(response.user);
    setToken(response.token);
    api.setToken(response.token);
    await AsyncStorage.setItem('token', response.token);
    await AsyncStorage.setItem('user', JSON.stringify(response.user));
  };

  const logout = async () => {
    setUser(null);
    setToken(null);
    api.setToken(null);
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      AsyncStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  const refreshUser = async () => {
    if (token) {
      try {
        const response = await api.getMe();
        setUser(response);
        await AsyncStorage.setItem('user', JSON.stringify(response));
      } catch (error) {
        console.error('Error refreshing user:', error);
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout, updateUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
