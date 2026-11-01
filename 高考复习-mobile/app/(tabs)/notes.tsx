/**
 * 笔记搜索页面
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as api from '@/services/api';
import { SUBJECTS } from '@/constants/api';

export default function NotesScreen() {
  const [selectedSubject, setSelectedSubject] = useState<typeof SUBJECTS[number]>(SUBJECTS[0]);
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<{ content: string; source: string } | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // 热门知识点
  const hotTopics: Record<string, string[]> = {
    math: ['三角函数', '立体几何', '导数基础', '圆锥曲线'],
    physics: ['牛顿定律', '动能定理', '电磁感应', '电路分析'],
    chemistry: ['氧化还原', '有机化学', '电化学', '化学平衡'],
    chinese: ['文言文实词', '古诗词鉴赏', '作文素材'],
    english: ['定语从句', '虚拟语气', '完形技巧'],
    politics: ['唯物辩证法', '经济生活', '政治生活'],
  };

  const searchNotes = async (searchQuery?: string) => {
    const q = searchQuery || query;
    if (!q.trim()) {
      Alert.alert('提示', '请输入搜索关键词');
      return;
    }

    setIsSearching(true);
    setResult(null);

    try {
      const data = await api.searchNotes(q.trim(), selectedSubject.id);
      setResult({
        content: data.content,
        source: data.source === 'ai' ? 'AI 智能笔记' : 'Get 笔记',
      });
    } catch (error: any) {
      Alert.alert('搜索失败', error.message || '请稍后重试');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* 学科选择 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.subjectScroll}>
        {SUBJECTS.map((subject) => (
          <TouchableOpacity
            key={subject.id}
            style={[
              styles.subjectChip,
              selectedSubject.id === subject.id && styles.subjectChipActive,
            ]}
            onPress={() => setSelectedSubject(subject)}
          >
            <Text style={styles.subjectIcon}>{subject.icon}</Text>
            <Text
              style={[
                styles.subjectName,
                selectedSubject.id === subject.id && styles.subjectNameActive,
              ]}
            >
              {subject.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 搜索框 */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={`搜索${selectedSubject.name}知识点...`}
          placeholderTextColor="#9ca3af"
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => searchNotes()}
          returnKeyType="search"
        />
        <TouchableOpacity
          style={[styles.searchButton, isSearching && styles.searchButtonDisabled]}
          onPress={() => searchNotes()}
          disabled={isSearching}
        >
          {isSearching ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.searchButtonText}>🔍</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* 热门知识点 */}
      {!result && (
        <View style={styles.hotTopicsContainer}>
          <Text style={styles.hotTopicsTitle}>{selectedSubject.name} · 高频考点</Text>
          <View style={styles.hotTopicsList}>
            {hotTopics[selectedSubject.id]?.map((topic, index) => (
              <TouchableOpacity
                key={index}
                style={styles.hotTopicChip}
                onPress={() => {
                  setQuery(topic);
                  searchNotes(topic);
                }}
              >
                <Text style={styles.hotTopicText}>{topic}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* 搜索结果 */}
      {result && (
        <View style={styles.resultContainer}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>📚 搜索结果</Text>
            <View style={styles.sourceBadge}>
              <Text style={styles.sourceBadgeText}>{result.source}</Text>
            </View>
          </View>
          <Text style={styles.resultContent}>{result.content}</Text>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  subjectScroll: {
    padding: 16,
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    gap: 4,
  },
  subjectChipActive: {
    backgroundColor: '#3b82f6',
  },
  subjectIcon: {
    fontSize: 16,
  },
  subjectName: {
    fontSize: 13,
    color: '#6b7280',
    fontWeight: '500',
  },
  subjectNameActive: {
    color: '#fff',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#1f2937',
  },
  searchButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  searchButtonText: {
    fontSize: 20,
  },
  hotTopicsContainer: {
    padding: 16,
  },
  hotTopicsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 12,
  },
  hotTopicsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hotTopicChip: {
    backgroundColor: '#e5e7eb',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  hotTopicText: {
    fontSize: 13,
    color: '#4b5563',
  },
  resultContainer: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  sourceBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sourceBadgeText: {
    color: '#1d4ed8',
    fontSize: 11,
    fontWeight: '600',
  },
  resultContent: {
    fontSize: 14,
    lineHeight: 22,
    color: '#374151',
  },
});

