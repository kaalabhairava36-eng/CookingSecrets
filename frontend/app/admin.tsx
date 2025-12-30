import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/services/api';
import { useAuth } from '../src/context/AuthContext';

interface User {
  id: string;
  email: string;
  username: string;
  full_name: string;
  role: string;
  profile_image?: string;
  recipes_count: number;
  followers_count: number;
  is_active: boolean;
}

interface Stats {
  users_count: number;
  recipes_count: number;
  comments_count: number;
  role_counts: {
    admin: number;
    moderator: number;
    chef: number;
    user: number;
  };
}

const ROLES = ['admin', 'moderator', 'chef', 'user'];

const getRoleColor = (role: string) => {
  switch (role) {
    case 'admin':
      return '#FF4444';
    case 'moderator':
      return '#4CAF50';
    case 'chef':
      return '#FFD700';
    default:
      return '#888';
  }
};

export default function AdminScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsData, usersData] = await Promise.all([
        api.getAdminStats(),
        api.getUsers(),
      ]);
      setStats(statsData);
      setUsers(usersData);
    } catch (error) {
      console.error('Error fetching admin data:', error);
      Alert.alert('Error', 'Failed to load admin data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (newRole: string) => {
    if (!selectedUser) return;
    setIsUpdating(true);
    try {
      await api.updateUserRole(selectedUser.id, newRole);
      setUsers(users.map(u => u.id === selectedUser.id ? { ...u, role: newRole } : u));
      setIsRoleModalOpen(false);
      Alert.alert('Success', 'User role updated');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update role');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleActive = async (userId: string) => {
    try {
      await api.toggleUserActive(userId);
      setUsers(users.map(u => u.id === userId ? { ...u, is_active: !u.is_active } : u));
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update user status');
    }
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

  if (!user || (user.role !== 'admin' && user.role !== 'moderator')) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.noAccess}>
          <Ionicons name="lock-closed" size={60} color="#888" />
          <Text style={styles.noAccessText}>Access Denied</Text>
          <Text style={styles.noAccessSubtext}>You need admin or moderator privileges</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Stats Cards */}
        {stats && (
          <View style={styles.statsSection}>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Ionicons name="people" size={24} color="#FF6B35" />
                <Text style={styles.statValue}>{stats.users_count}</Text>
                <Text style={styles.statLabel}>Total Users</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="restaurant" size={24} color="#4CAF50" />
                <Text style={styles.statValue}>{stats.recipes_count}</Text>
                <Text style={styles.statLabel}>Recipes</Text>
              </View>
              <View style={styles.statCard}>
                <Ionicons name="chatbubbles" size={24} color="#2196F3" />
                <Text style={styles.statValue}>{stats.comments_count}</Text>
                <Text style={styles.statLabel}>Comments</Text>
              </View>
            </View>

            <View style={styles.rolesSection}>
              <Text style={styles.sectionTitle}>Users by Role</Text>
              <View style={styles.roleStats}>
                <View style={styles.roleStatItem}>
                  <View style={[styles.roleDot, { backgroundColor: '#FF4444' }]} />
                  <Text style={styles.roleStatText}>Admins: {stats.role_counts.admin}</Text>
                </View>
                <View style={styles.roleStatItem}>
                  <View style={[styles.roleDot, { backgroundColor: '#4CAF50' }]} />
                  <Text style={styles.roleStatText}>Moderators: {stats.role_counts.moderator}</Text>
                </View>
                <View style={styles.roleStatItem}>
                  <View style={[styles.roleDot, { backgroundColor: '#FFD700' }]} />
                  <Text style={styles.roleStatText}>Chefs: {stats.role_counts.chef}</Text>
                </View>
                <View style={styles.roleStatItem}>
                  <View style={[styles.roleDot, { backgroundColor: '#888' }]} />
                  <Text style={styles.roleStatText}>Users: {stats.role_counts.user}</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Users List */}
        <View style={styles.usersSection}>
          <Text style={styles.sectionTitle}>Manage Users</Text>
          {users.map((u) => (
            <View key={u.id} style={[styles.userCard, !u.is_active && styles.userCardInactive]}>
              <View style={styles.userInfo}>
                {u.profile_image ? (
                  <Image source={{ uri: u.profile_image }} style={styles.userAvatar} />
                ) : (
                  <View style={styles.userAvatarPlaceholder}>
                    <Ionicons name="person" size={18} color="#888" />
                  </View>
                )}
                <View style={styles.userDetails}>
                  <Text style={styles.userName}>{u.full_name}</Text>
                  <Text style={styles.userUsername}>@{u.username}</Text>
                  <View style={[styles.roleBadge, { backgroundColor: getRoleColor(u.role) + '20' }]}>
                    <Text style={[styles.roleText, { color: getRoleColor(u.role) }]}>
                      {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.userActions}>
                {user.role === 'admin' && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => {
                      setSelectedUser(u);
                      setIsRoleModalOpen(true);
                    }}
                  >
                    <Ionicons name="shield" size={20} color="#FF6B35" />
                  </TouchableOpacity>
                )}
                {user.role === 'admin' && u.id !== user.id && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleToggleActive(u.id)}
                  >
                    <Ionicons
                      name={u.is_active ? 'eye-off' : 'eye'}
                      size={20}
                      color={u.is_active ? '#ff4444' : '#4CAF50'}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Role Change Modal */}
      <Modal visible={isRoleModalOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Change Role</Text>
              <TouchableOpacity onPress={() => setIsRoleModalOpen(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            {selectedUser && (
              <View style={styles.modalBody}>
                <Text style={styles.selectedUserName}>{selectedUser.full_name}</Text>
                <Text style={styles.selectedUserEmail}>{selectedUser.email}</Text>
                <View style={styles.roleOptions}>
                  {ROLES.map((role) => (
                    <TouchableOpacity
                      key={role}
                      style={[
                        styles.roleOption,
                        selectedUser.role === role && styles.roleOptionActive,
                        { borderColor: getRoleColor(role) },
                      ]}
                      onPress={() => handleRoleChange(role)}
                      disabled={isUpdating}
                    >
                      <Text
                        style={[
                          styles.roleOptionText,
                          { color: selectedUser.role === role ? '#fff' : getRoleColor(role) },
                        ]}
                      >
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {isUpdating && <ActivityIndicator style={{ marginTop: 16 }} color="#FF6B35" />}
              </View>
            )}
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
  noAccess: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  noAccessText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
  },
  noAccessSubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
  },
  backButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#FF6B35',
    borderRadius: 20,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
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
  statsSection: {
    padding: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    color: '#888',
    fontSize: 12,
    marginTop: 4,
  },
  rolesSection: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  roleStats: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  roleStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  roleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  roleStatText: {
    color: '#ccc',
    fontSize: 14,
  },
  usersSection: {
    padding: 16,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  userCardInactive: {
    opacity: 0.5,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  userAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  userName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  userUsername: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '600',
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    padding: 8,
    backgroundColor: '#333',
    borderRadius: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    overflow: 'hidden',
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
  modalBody: {
    padding: 20,
    alignItems: 'center',
  },
  selectedUserName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  selectedUserEmail: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  roleOptions: {
    marginTop: 24,
    width: '100%',
    gap: 10,
  },
  roleOption: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  roleOptionActive: {
    backgroundColor: '#FF6B35',
    borderColor: '#FF6B35',
  },
  roleOptionText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
