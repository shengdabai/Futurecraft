import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, optionalAuthMiddleware } from '../middleware/auth.js';
import { aiLimiter, userRateLimitMiddleware } from '../middleware/rateLimit.js';
import * as geminiService from '../services/geminiService.js';
import * as usageService from '../services/usageService.js';
import { validateUserInput, sanitizeAIOutput, sanitizeResourceUrls, ContentFilterError } from '../services/contentFilter.js';

const router = Router();

// Zod schemas for AI endpoints
const soulScanSchema = z.object({
    name: z.string().min(1).max(100),
    major: z.string().min(1).max(200),
    hobbies: z.array(z.string().max(100)).max(20).default([]),
    hiddenTalent: z.string().max(500).optional().default(''),
    language: z.enum(['zh', 'en']).default('zh'),
});

const simulationSchema = z.object({
    jobTitle: z.string().min(1).max(200),
    language: z.enum(['zh', 'en']).default('zh'),
});

const simulationEvaluateSchema = z.object({
    jobTitle: z.string().min(1).max(200),
    scenario: z.string().min(1).max(2000),
    choice: z.string().min(1).max(1000),
    language: z.enum(['zh', 'en']).default('zh'),
});

const chatSchema = z.object({
    history: z.array(z.object({
        role: z.enum(['user', 'model']),
        content: z.string(),
    })).max(50).default([]),
    message: z.string().min(1).max(2000),
    jobTitle: z.string().max(200).optional(),
    jobDescription: z.string().max(1000).optional(),
    isBossMode: z.boolean().default(false),
    language: z.enum(['zh', 'en']).default('zh'),
});

const skillTreeSchema = z.object({
    jobTitle: z.string().min(1).max(200),
    language: z.enum(['zh', 'en']).default('zh'),
});

const ttsSchema = z.object({
    text: z.string().min(1).max(1000),
    language: z.enum(['zh', 'en']).default('zh'),
});

// 所有 AI 路由需要认证和速率限制
router.use(authMiddleware);
router.use(aiLimiter);
router.use(userRateLimitMiddleware(50, 60 * 60 * 1000)); // 每小时 50 次

/**
 * POST /ai/soul-scan
 * RPG 角色分析
 */
router.post('/soul-scan', async (req: Request, res: Response) => {
    try {
        const parseResult = soulScanSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                error: 'InvalidRequest',
                message: '请求参数无效',
                details: z.flattenError(parseResult.error).fieldErrors,
            });
        }
        const { name, major, hobbies, hiddenTalent, language } = parseResult.data;
        const userId = req.user!.userId;

        // 检查用量配额
        if (!usageService.checkCredits(userId)) {
            return res.status(402).json({
                error: 'InsufficientCredits',
                message: '本月免费额度已用完，请升级订阅',
            });
        }

        // 内容安全检查
        try {
            validateUserInput(`${name} ${major} ${hobbies.join(' ')} ${hiddenTalent}`);
        } catch (error) {
            if (error instanceof ContentFilterError) {
                return res.status(400).json({
                    error: 'ContentFiltered',
                    message: error.message,
                });
            }
            throw error;
        }

        // 调用 Gemini
        const { result, usage } = await geminiService.performSoulScan({
            name,
            major,
            hobbies: hobbies || [],
            hiddenTalent,
            language: language || 'zh',
        });

        // 记录使用量
        const { creditsUsed, remainingCredits } = usageService.recordUsage(
            userId,
            usage.inputTokens,
            usage.outputTokens
        );

        res.json({
            ...result,
            _usage: {
                creditsUsed,
                remainingCredits,
            },
        });
    } catch (error) {
        console.error('Soul scan error:', error);
        res.status(500).json({
            error: 'AIError',
            message: 'AI 服务暂时不可用，请稍后再试',
        });
    }
});

/**
 * POST /ai/simulation
 * 生成模拟场景
 */
router.post('/simulation', async (req: Request, res: Response) => {
    try {
        const parseResult = simulationSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                error: 'InvalidRequest',
                message: '请求参数无效',
                details: z.flattenError(parseResult.error).fieldErrors,
            });
        }
        const { jobTitle, language } = parseResult.data;
        const userId = req.user!.userId;

        if (!usageService.checkCredits(userId)) {
            return res.status(402).json({
                error: 'InsufficientCredits',
                message: '本月免费额度已用完',
            });
        }

        validateUserInput(jobTitle);

        const { result, usage } = await geminiService.generateSimulation({
            jobTitle,
            language: language || 'zh',
        });

        usageService.recordUsage(userId, usage.inputTokens, usage.outputTokens);

        res.json(result);
    } catch (error) {
        if (error instanceof ContentFilterError) {
            return res.status(400).json({
                error: 'ContentFiltered',
                message: error.message,
            });
        }
        console.error('Simulation error:', error);
        res.status(500).json({
            error: 'AIError',
            message: 'AI 服务暂时不可用',
        });
    }
});

/**
 * POST /ai/simulation/evaluate
 * 评估模拟选择
 */
router.post('/simulation/evaluate', async (req: Request, res: Response) => {
    try {
        const parseResult = simulationEvaluateSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                error: 'InvalidRequest',
                message: '请求参数无效',
                details: z.flattenError(parseResult.error).fieldErrors,
            });
        }
        const { jobTitle, scenario, choice, language } = parseResult.data;
        const userId = req.user!.userId;

        if (!usageService.checkCredits(userId)) {
            return res.status(402).json({
                error: 'InsufficientCredits',
                message: '本月免费额度已用完',
            });
        }

        const { result, usage } = await geminiService.evaluateSimulationChoice({
            jobTitle,
            scenario,
            choice,
            language: language || 'zh',
        });

        usageService.recordUsage(userId, usage.inputTokens, usage.outputTokens);

        res.json(result);
    } catch (error) {
        console.error('Evaluate error:', error);
        res.status(500).json({
            error: 'AIError',
            message: 'AI 服务暂时不可用',
        });
    }
});

/**
 * POST /ai/skill-tree
 * 生成技能树
 */
router.post('/skill-tree', async (req: Request, res: Response) => {
    try {
        const parseResult = skillTreeSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                error: 'InvalidRequest',
                message: '请求参数无效',
                details: z.flattenError(parseResult.error).fieldErrors,
            });
        }
        const { jobTitle, language } = parseResult.data;
        const userId = req.user!.userId;

        if (!usageService.checkCredits(userId)) {
            return res.status(402).json({
                error: 'InsufficientCredits',
                message: '本月免费额度已用完',
            });
        }

        validateUserInput(jobTitle);

        const { result, usage } = await geminiService.generateSkillTree({
            jobTitle,
            language: language || 'zh',
        });

        // 过滤不安全的 URL（不可变模式，返回新数组）
        const sanitizedResult = sanitizeResourceUrls(result);

        usageService.recordUsage(userId, usage.inputTokens, usage.outputTokens);

        res.json(sanitizedResult);
    } catch (error) {
        if (error instanceof ContentFilterError) {
            return res.status(400).json({
                error: 'ContentFiltered',
                message: error.message,
            });
        }
        console.error('Skill tree error:', error);
        res.status(500).json({
            error: 'AIError',
            message: 'AI 服务暂时不可用',
        });
    }
});

/**
 * POST /ai/chat
 * AI 导师对话
 */
router.post('/chat', async (req: Request, res: Response) => {
    try {
        const parseResult = chatSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                error: 'InvalidRequest',
                message: '请求参数无效',
                details: z.flattenError(parseResult.error).fieldErrors,
            });
        }
        const { history, message, jobTitle, jobDescription, isBossMode, language } = parseResult.data;
        const userId = req.user!.userId;

        if (!usageService.checkCredits(userId)) {
            return res.status(402).json({
                error: 'InsufficientCredits',
                message: '本月免费额度已用完',
            });
        }

        // 检查用户消息
        try {
            validateUserInput(message);
        } catch (error) {
            if (error instanceof ContentFilterError) {
                return res.status(400).json({
                    error: 'ContentFiltered',
                    message: error.message,
                });
            }
            throw error;
        }

        const { message: responseMessage, usage } = await geminiService.tutorChat({
            history: history || [],
            message,
            jobTitle,
            jobDescription,
            isBossMode: isBossMode || false,
            language: language || 'zh',
        });

        // 过滤 AI 输出
        const sanitizedMessage = sanitizeAIOutput(responseMessage);

        usageService.recordUsage(userId, usage.inputTokens, usage.outputTokens);

        res.json({ message: sanitizedMessage });
    } catch (error) {
        console.error('Chat error:', error);
        res.status(500).json({
            error: 'AIError',
            message: 'AI 服务暂时不可用',
        });
    }
});

/**
 * POST /ai/tts
 * 语音合成 (TTS)
 *
 * 策略:
 * 1. 如果配置了 Google Cloud TTS API key，使用 Google Cloud TTS
 * 2. 否则返回 useClientTTS: true，让前端使用 Web Speech API
 */
router.post('/tts', async (req: Request, res: Response) => {
    try {
        const parseResult = ttsSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({
                error: 'InvalidRequest',
                message: '请求参数无效',
                details: z.flattenError(parseResult.error).fieldErrors,
            });
        }
        const { text, language } = parseResult.data;
        const userId = req.user!.userId;

        if (!usageService.checkCredits(userId)) {
            return res.status(402).json({
                error: 'InsufficientCredits',
                message: '本月免费额度已用完',
            });
        }

        const googleTtsKey = process.env.GOOGLE_CLOUD_TTS_API_KEY;

        // 如果没有 Google Cloud TTS 密钥，降级到客户端 TTS
        if (!googleTtsKey) {
            return res.json({
                audioData: null,
                useClientTTS: true,
                message: '请使用客户端语音合成',
            });
        }

        // 使用 Google Cloud Text-to-Speech API（API key 通过 header 传递，不暴露在 URL 中）
        const ttsLanguage = language === 'en' ? 'en-US' : 'cmn-CN';
        const voiceName = language === 'en' ? 'en-US-Neural2-J' : 'cmn-CN-Wavenet-A';

        const ttsResponse = await fetch(
            'https://texttospeech.googleapis.com/v1/text:synthesize',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': googleTtsKey,
                },
                body: JSON.stringify({
                    input: { text },
                    voice: {
                        languageCode: ttsLanguage,
                        name: voiceName,
                    },
                    audioConfig: {
                        audioEncoding: 'MP3',
                        speakingRate: 1.0,
                        pitch: 0,
                    },
                }),
            },
        );

        if (!ttsResponse.ok) {
            const errorBody = await ttsResponse.text();
            console.error('Google TTS API error:', ttsResponse.status, errorBody);

            // 服务端 TTS 失败时降级到客户端
            return res.json({
                audioData: null,
                useClientTTS: true,
                message: '服务端语音合成失败，请使用客户端合成',
            });
        }

        const ttsResult = await ttsResponse.json() as { audioContent: string };

        // 记录少量 credits 用于 TTS
        usageService.recordUsage(userId, 0, Math.ceil(text.length / 4));

        res.json({
            audioData: ttsResult.audioContent, // base64 encoded MP3
            useClientTTS: false,
            format: 'mp3',
            encoding: 'base64',
        });
    } catch (error) {
        console.error('TTS error:', error);
        // 出错时降级到客户端 TTS
        res.json({
            audioData: null,
            useClientTTS: true,
            message: '语音合成服务暂不可用，请使用客户端合成',
        });
    }
});

export default router;

