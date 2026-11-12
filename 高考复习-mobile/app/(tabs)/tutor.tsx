/**
 * AI 导师页面 - 苏格拉底式教学
 */

import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    type ScrollViewInstance,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as api from '@/services/api';
import { router } from 'expo-router';
import { clearToken } from '@/services/api';

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

// 学科配置
const SUBJECTS = [
    { id: 'math', name: '数学', icon: '📐' },
    { id: 'physics', name: '物理', icon: '⚡' },
    { id: 'chemistry', name: '化学', icon: '🧪' },
    { id: 'chinese', name: '语文', icon: '📖' },
    { id: 'english', name: '英语', icon: '🔤' },
    { id: 'politics', name: '政治', icon: '⚖️' },
];

// 学习模式
const MODES = [
    { id: 'learn', name: '学习', icon: '📖' },
    { id: 'review', name: '复习', icon: '🔄' },
    { id: 'quiz', name: '测验', icon: '🎯' },
];

// 快捷提问
const QUICK_QUESTIONS: Record<string, string[]> = {
    math: ['三角函数公式怎么记？', '导数的几何意义是什么？'],
    physics: ['牛顿三定律是什么？', '动能定理怎么用？'],
    chemistry: ['氧化还原反应怎么配平？', '化学平衡怎么判断？'],
    chinese: ['文言文翻译技巧？', '作文开头怎么写？'],
    english: ['定语从句怎么用？', '虚拟语气怎么理解？'],
    politics: ['唯物辩证法核心？', '经济生活答题模板？'],
};

export default function TutorScreen() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [subject, setSubject] = useState(SUBJECTS[0]);
    const [mode, setMode] = useState<'learn' | 'review' | 'quiz'>('learn');
    const [topic, setTopic] = useState('');
    const [showSubjects, setShowSubjects] = useState(false);

    const scrollViewRef = useRef<ScrollViewInstance>(null);

    // 滚动到底部
    useEffect(() => {
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
    }, [messages]);

    // 切换学科时重置
    useEffect(() => {
        setMessages([]);
        setSessionId(null);
        setTopic('');
    }, [subject.id]);

    // 发送消息
    const sendMessage = async (text?: string) => {
        const messageText = text || input.trim();
        if (!messageText || isLoading) return;

        // 添加用户消息
        const userMsg: Message = {
            id: Date.now().toString(),
            role: 'user',
            content: messageText,
        };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const response = await api.chatWithTutor({
                sessionId: sessionId || undefined,
                message: messageText,
                subject: subject.id,
                topic: topic || undefined,
                mode,
            });

            if (!sessionId) {
                setSessionId(response.sessionId);
            }

            const assistantMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: response.response,
            };
            setMessages(prev => [...prev, assistantMsg]);

        } catch (error: any) {
            if (error.code === 'UNAUTHORIZED') {
                await clearToken();
                router.replace('/(auth)/login');
                return;
            }

            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                content: `❌ ${error.message || '发送失败，请重试'}`,
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    // 开始新对话
    const startNewChat = () => {
        setMessages([]);
        setSessionId(null);
    };

    return (
        <SafeAreaView style={styles.container} edges={['bottom']}>
            <KeyboardAvoidingView
                style={styles.flex1}
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
            >
                {/* 顶部控制栏 */}
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.subjectButton}
                        onPress={() => setShowSubjects(!showSubjects)}
                    >
                        <Text style={styles.subjectIcon}>{subject.icon}</Text>
                        <Text style={styles.subjectName}>{subject.name}</Text>
                        <Text style={styles.arrow}>▼</Text>
                    </TouchableOpacity>

                    <View style={styles.modeButtons}>
                        {MODES.map(m => (
                            <TouchableOpacity
                                key={m.id}
                                style={[styles.modeButton, mode === m.id && styles.modeButtonActive]}
                                onPress={() => { setMode(m.id as any); startNewChat(); }}
                            >
                                <Text style={styles.modeIcon}>{m.icon}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity style={styles.newChatButton} onPress={startNewChat}>
                        <Text style={styles.newChatText}>🔄</Text>
                    </TouchableOpacity>
                </View>

                {/* 学科选择下拉 */}
                {showSubjects && (
                    <View style={styles.subjectDropdown}>
                        {SUBJECTS.map(s => (
                            <TouchableOpacity
                                key={s.id}
                                style={[styles.subjectOption, subject.id === s.id && styles.subjectOptionActive]}
                                onPress={() => { setSubject(s); setShowSubjects(false); }}
                            >
                                <Text style={styles.subjectOptionIcon}>{s.icon}</Text>
                                <Text style={styles.subjectOptionName}>{s.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}

                {/* 知识点输入 */}
                {messages.length === 0 && (
                    <View style={styles.topicInput}>
                        <TextInput
                            style={styles.topicTextInput}
                            value={topic}
                            onChangeText={setTopic}
                            placeholder="指定知识点（可选）"
                            placeholderTextColor="#9ca3af"
                        />
                    </View>
                )}

                {/* 消息区域 */}
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.messagesContainer}
                    contentContainerStyle={styles.messagesContent}
                >
                    {messages.length === 0 ? (
                        <View style={styles.welcomeContainer}>
                            <Text style={styles.welcomeIcon}>🎓</Text>
                            <Text style={styles.welcomeTitle}>AI 导师</Text>
                            <Text style={styles.welcomeSubtitle}>苏格拉底式教学法</Text>
                            <Text style={styles.welcomeDesc}>
                                我会先了解你已知的内容，然后循序渐进地帮你掌握知识点
                            </Text>

                            {/* 快捷提问 */}
                            <View style={styles.quickQuestions}>
                                {(QUICK_QUESTIONS[subject.id] || []).map((q, idx) => (
                                    <TouchableOpacity
                                        key={idx}
                                        style={styles.quickButton}
                                        onPress={() => sendMessage(q)}
                                    >
                                        <Text style={styles.quickButtonText}>{q}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    ) : (
                        messages.map(msg => (
                            <View
                                key={msg.id}
                                style={[
                                    styles.messageBubble,
                                    msg.role === 'user' ? styles.userBubble : styles.assistantBubble
                                ]}
                            >
                                {msg.role === 'assistant' && (
                                    <View style={styles.assistantHeader}>
                                        <Text style={styles.assistantIcon}>🎓</Text>
                                        <Text style={styles.assistantLabel}>AI 导师</Text>
                                    </View>
                                )}
                                <Text style={[
                                    styles.messageText,
                                    msg.role === 'user' && styles.userText
                                ]}>
                                    {msg.content}
                                </Text>
                            </View>
                        ))
                    )}

                    {isLoading && (
                        <View style={[styles.messageBubble, styles.assistantBubble]}>
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="small" color="#6366f1" />
                                <Text style={styles.loadingText}>思考中...</Text>
                            </View>
                        </View>
                    )}
                </ScrollView>

                {/* 输入区域 */}
                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.textInput}
                        value={input}
                        onChangeText={setInput}
                        placeholder="输入你的问题..."
                        placeholderTextColor="#9ca3af"
                        multiline
                        maxLength={1000}
                        editable={!isLoading}
                    />
                    <TouchableOpacity
                        style={[styles.sendButton, (!input.trim() || isLoading) && styles.sendButtonDisabled]}
                        onPress={() => sendMessage()}
                        disabled={!input.trim() || isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.sendIcon}>➤</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
    },
    flex1: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    subjectButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
    },
    subjectIcon: {
        fontSize: 18,
        marginRight: 6,
    },
    subjectName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    arrow: {
        fontSize: 10,
        marginLeft: 4,
        color: '#9ca3af',
    },
    modeButtons: {
        flexDirection: 'row',
        marginLeft: 'auto',
        marginRight: 8,
    },
    modeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 6,
    },
    modeButtonActive: {
        backgroundColor: '#e0e7ff',
    },
    modeIcon: {
        fontSize: 16,
    },
    newChatButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#f3f4f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
    newChatText: {
        fontSize: 16,
    },
    subjectDropdown: {
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        paddingHorizontal: 12,
        paddingBottom: 12,
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    subjectOption: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        margin: 4,
        borderRadius: 16,
        backgroundColor: '#f3f4f6',
    },
    subjectOptionActive: {
        backgroundColor: '#e0e7ff',
    },
    subjectOptionIcon: {
        fontSize: 16,
        marginRight: 6,
    },
    subjectOptionName: {
        fontSize: 13,
        color: '#374151',
    },
    topicInput: {
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    topicTextInput: {
        backgroundColor: '#f3f4f6',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        fontSize: 14,
    },
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        padding: 16,
        paddingBottom: 100,
    },
    welcomeContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    welcomeIcon: {
        fontSize: 48,
        marginBottom: 12,
    },
    welcomeTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#374151',
        marginBottom: 4,
    },
    welcomeSubtitle: {
        fontSize: 14,
        color: '#6366f1',
        marginBottom: 12,
    },
    welcomeDesc: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        paddingHorizontal: 32,
        marginBottom: 24,
    },
    quickQuestions: {
        width: '100%',
    },
    quickButton: {
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        marginVertical: 4,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    quickButtonText: {
        fontSize: 14,
        color: '#374151',
        textAlign: 'center',
    },
    messageBubble: {
        maxWidth: '85%',
        padding: 12,
        borderRadius: 16,
        marginVertical: 4,
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: '#6366f1',
    },
    assistantBubble: {
        alignSelf: 'flex-start',
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    assistantHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    assistantIcon: {
        fontSize: 16,
        marginRight: 6,
    },
    assistantLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6366f1',
    },
    messageText: {
        fontSize: 15,
        lineHeight: 22,
        color: '#374151',
    },
    userText: {
        color: '#fff',
    },
    loadingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    loadingText: {
        marginLeft: 8,
        fontSize: 14,
        color: '#6b7280',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 12,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
    },
    textInput: {
        flex: 1,
        backgroundColor: '#f3f4f6',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 10,
        paddingRight: 44,
        fontSize: 15,
        maxHeight: 100,
    },
    sendButton: {
        position: 'absolute',
        right: 18,
        bottom: 16,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#6366f1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendButtonDisabled: {
        backgroundColor: '#d1d5db',
    },
    sendIcon: {
        fontSize: 16,
        color: '#fff',
    },
});

