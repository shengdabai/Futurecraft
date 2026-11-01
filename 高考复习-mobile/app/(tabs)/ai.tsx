/**
 * AI 拍题页面
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as api from '@/services/api';
import { SUBJECTS } from '@/constants/api';

export default function AIScreen() {
  const [selectedSubject, setSelectedSubject] = useState<typeof SUBJECTS[number]>(SUBJECTS[0]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string>('');
  const [tags, setTags] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // 拍照
  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('提示', '需要相机权限才能拍照');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setSelectedImage(base64);
      setAnalysis('');
      setTags([]);
    }
  };

  // 从相册选择
  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('提示', '需要相册权限才能选择图片');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setSelectedImage(base64);
      setAnalysis('');
      setTags([]);
    }
  };

  // 分析图片
  const analyzeImage = async () => {
    if (!selectedImage) return;

    setIsAnalyzing(true);
    setAnalysis('');
    setTags([]);

    try {
      const result = await api.analyzeImage(selectedImage, selectedSubject.id);
      setAnalysis(result.analysis);
      setTags(result.tags);
    } catch (error: any) {
      Alert.alert('分析失败', error.message || '请稍后重试');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 保存到错题本
  const saveToMistakes = async () => {
    if (!selectedImage || !analysis) return;

    try {
      await api.addMistake({
        subject: selectedSubject.id,
        imageUrl: selectedImage,
        analysis,
        tags,
      });
      Alert.alert('成功', '已保存到错题本');
    } catch (error: any) {
      Alert.alert('保存失败', error.message || '请稍后重试');
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
              styles.subjectButton,
              selectedSubject.id === subject.id && styles.subjectButtonActive,
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
            {subject.primary && selectedSubject.id !== subject.id && (
              <Text style={styles.primaryTag}>重点</Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 图片预览区 */}
      <View style={styles.imageContainer}>
        {selectedImage ? (
          <Image source={{ uri: selectedImage }} style={styles.previewImage} resizeMode="contain" />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>📷</Text>
            <Text style={styles.placeholderText}>点击下方按钮上传或拍摄题目</Text>
          </View>
        )}
      </View>

      {/* 操作按钮 */}
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.actionButton} onPress={takePhoto}>
          <Text style={styles.actionButtonIcon}>📸</Text>
          <Text style={styles.actionButtonText}>拍照</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={pickImage}>
          <Text style={styles.actionButtonIcon}>🖼️</Text>
          <Text style={styles.actionButtonText}>相册</Text>
        </TouchableOpacity>
      </View>

      {/* 分析按钮 */}
      <TouchableOpacity
        style={[styles.analyzeButton, (!selectedImage || isAnalyzing) && styles.analyzeButtonDisabled]}
        onPress={analyzeImage}
        disabled={!selectedImage || isAnalyzing}
      >
        {isAnalyzing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Text style={styles.analyzeButtonIcon}>🧠</Text>
            <Text style={styles.analyzeButtonText}>开始分析</Text>
          </>
        )}
      </TouchableOpacity>

      {/* 分析结果 */}
      {analysis && (
        <View style={styles.resultContainer}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>⚡ AI 老师解析</Text>
            <TouchableOpacity style={styles.saveButton} onPress={saveToMistakes}>
              <Text style={styles.saveButtonText}>📌 保存</Text>
            </TouchableOpacity>
          </View>

          {/* 知识点标签 */}
          {tags.length > 0 && (
            <View style={styles.tagsContainer}>
              {tags.map((tag, index) => (
                <View key={index} style={styles.tag}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* 分析内容 */}
          <Text style={styles.resultText}>{analysis}</Text>
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
  subjectButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginRight: 8,
    alignItems: 'center',
    minWidth: 70,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  subjectButtonActive: {
    borderColor: '#3b82f6',
  },
  subjectIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  subjectName: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  subjectNameActive: {
    color: '#3b82f6',
  },
  primaryTag: {
    fontSize: 10,
    color: '#ef4444',
    marginTop: 2,
  },
  imageContainer: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    height: 250,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  placeholderIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  placeholderText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionButtonIcon: {
    fontSize: 20,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  analyzeButton: {
    margin: 16,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  analyzeButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  analyzeButtonIcon: {
    fontSize: 20,
  },
  analyzeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
  saveButton: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  saveButtonText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: {
    color: '#1d4ed8',
    fontSize: 12,
    fontWeight: '500',
  },
  resultText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#374151',
  },
});

