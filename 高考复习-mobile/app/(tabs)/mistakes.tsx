/**
 * 错题本页面
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  Alert,
  RefreshControl,
} from 'react-native';
import * as api from '@/services/api';
import { SUBJECTS } from '@/constants/api';

export default function MistakesScreen() {
  const [mistakes, setMistakes] = useState<api.MistakeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  const loadMistakes = useCallback(async () => {
    try {
      const result = await api.getMistakes({
        subject: selectedSubject || undefined,
        limit: 100,
      });
      setMistakes(result.items);
    } catch (error: any) {
      Alert.alert('加载失败', error.message || '请稍后重试');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedSubject]);

  useEffect(() => {
    loadMistakes();
  }, [loadMistakes]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadMistakes();
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      '确认删除',
      '确定要删除这条错题记录吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteMistake(id);
              setMistakes(prev => prev.filter(m => m.id !== id));
            } catch (error: any) {
              Alert.alert('删除失败', error.message || '请稍后重试');
            }
          },
        },
      ]
    );
  };

  const getSubjectName = (subjectId: string) => {
    return SUBJECTS.find(s => s.id === subjectId)?.name || subjectId;
  };

  const renderMistakeItem = ({ item }: { item: api.MistakeItem }) => (
    <View style={styles.mistakeCard}>
      <View style={styles.cardHeader}>
        <View style={styles.subjectBadge}>
          <Text style={styles.subjectBadgeText}>{getSubjectName(item.subject)}</Text>
        </View>
        <Text style={styles.dateText}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
        <TouchableOpacity onPress={() => handleDelete(item.id)}>
          <Text style={styles.deleteButton}>🗑️</Text>
        </TouchableOpacity>
      </View>

      {item.imageUrl && (
        <Image
          source={{ uri: item.imageUrl }}
          style={styles.mistakeImage}
          resizeMode="contain"
        />
      )}

      {item.tags && item.tags.length > 0 && (
        <View style={styles.tagsContainer}>
          {item.tags.map((tag, index) => (
            <View key={index} style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={styles.analysisText} numberOfLines={4}>
        {item.analysis}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* 学科筛选 */}
      <FlatList
        horizontal
        data={[{ id: null, name: '全部', icon: '📋' }, ...SUBJECTS]}
        keyExtractor={(item) => item.id || 'all'}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedSubject === item.id && styles.filterChipActive,
            ]}
            onPress={() => setSelectedSubject(item.id)}
          >
            <Text style={styles.filterIcon}>{item.icon}</Text>
            <Text
              style={[
                styles.filterText,
                selectedSubject === item.id && styles.filterTextActive,
              ]}
            >
              {item.name}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* 错题列表 */}
      <FlatList
        data={mistakes}
        keyExtractor={(item) => item.id}
        renderItem={renderMistakeItem}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          !isLoading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyText}>还没有错题记录</Text>
              <Text style={styles.emptySubtext}>去「AI 拍题」添加错题吧</Text>
            </View>
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  filterList: {
    padding: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    gap: 4,
  },
  filterChipActive: {
    backgroundColor: '#3b82f6',
  },
  filterIcon: {
    fontSize: 14,
  },
  filterText: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  mistakeCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  subjectBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  subjectBadgeText: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '600',
  },
  dateText: {
    flex: 1,
    marginLeft: 8,
    color: '#9ca3af',
    fontSize: 12,
  },
  deleteButton: {
    fontSize: 16,
    padding: 4,
  },
  mistakeImage: {
    width: '100%',
    height: 120,
    borderRadius: 8,
    backgroundColor: '#f9fafb',
    marginBottom: 12,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  tag: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    color: '#6b7280',
    fontSize: 11,
  },
  analysisText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#4b5563',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#d1d5db',
  },
});

