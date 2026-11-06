import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { config } from '../config/env.js';

// 初始化 Gemini 客户端
const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

// 安全设置映射
const safetyThresholds: Record<string, HarmBlockThreshold> = {
    low: HarmBlockThreshold.BLOCK_ONLY_HIGH,
    medium: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    high: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
};

// 获取安全设置
const getSafetySettings = () => {
    const threshold = safetyThresholds[config.safety.level] || HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE;
    return [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold },
    ];
};

// Token 使用量跟踪
interface TokenUsage {
    inputTokens: number;
    outputTokens: number;
}

/**
 * 调用 Gemini API 生成内容
 */
export async function generateContent(
    prompt: string,
    options: {
        model?: string;
        maxTokens?: number;
        temperature?: number;
        responseFormat?: 'text' | 'json';
    } = {}
): Promise<{ text: string; usage: TokenUsage }> {
    const {
        model = 'gemini-2.0-flash',
        maxTokens = config.gemini.maxTokens,
        temperature = 0.7,
        responseFormat = 'text',
    } = options;

    const generativeModel = genAI.getGenerativeModel({
        model,
        safetySettings: getSafetySettings(),
        generationConfig: {
            maxOutputTokens: maxTokens,
            temperature,
            responseMimeType: responseFormat === 'json' ? 'application/json' : 'text/plain',
        },
    });

    const result = await generativeModel.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    // 估算 Token 使用量（实际生产中应使用 API 返回的精确值）
    const usage: TokenUsage = {
        inputTokens: Math.ceil(prompt.length / 4),
        outputTokens: Math.ceil(text.length / 4),
    };

    return { text, usage };
}

/**
 * 聊天对话
 */
export async function chat(
    history: Array<{ role: 'user' | 'model'; content: string }>,
    message: string,
    systemInstruction?: string,
    options: {
        model?: string;
        maxTokens?: number;
        temperature?: number;
    } = {}
): Promise<{ text: string; usage: TokenUsage }> {
    const {
        model = 'gemini-2.0-flash',
        maxTokens = config.gemini.maxTokens,
        temperature = 0.7,
    } = options;

    const generativeModel = genAI.getGenerativeModel({
        model,
        safetySettings: getSafetySettings(),
        generationConfig: {
            maxOutputTokens: maxTokens,
            temperature,
        },
        systemInstruction,
    });

    const chatSession = generativeModel.startChat({
        history: history.map(h => ({
            role: h.role,
            parts: [{ text: h.content }],
        })),
    });

    const result = await chatSession.sendMessage(message);
    const response = result.response;
    const text = response.text();

    // 估算 Token 使用量
    const historyLength = history.reduce((acc, h) => acc + h.content.length, 0);
    const usage: TokenUsage = {
        inputTokens: Math.ceil((historyLength + message.length + (systemInstruction?.length || 0)) / 4),
        outputTokens: Math.ceil(text.length / 4),
    };

    return { text, usage };
}

/**
 * Soul Scan - RPG 角色分析
 */
export async function performSoulScan(data: {
    name: string;
    major: string;
    hobbies: string[];
    hiddenTalent: string;
    language: 'zh' | 'en';
}): Promise<{ result: object; usage: TokenUsage }> {
    const isZh = data.language === 'zh';

    const prompt = `
    Act as a "FutureCraft" Game Master. Analyze this player profile for a Cyberpunk Career RPG.
    
    Player: ${data.name}
    Background: ${data.major}
    Hidden Data (Hobbies/Habits): ${data.hobbies.join(", ")}
    Self-Perceived Talent: ${data.hiddenTalent}

    Target Language: ${isZh ? 'Simplified Chinese' : 'English'}

    Tasks:
    1. Generate RPG Stats (0-100) based on their profile.
    2. Assign a cool "Cyberpunk Archetype" name (e.g., "Data Mercenary").
    3. Suggest 3 Career Categories, and 2 Jobs per sector.
    4. For each job, provide:
       - "dayInLife": A Gen Z style, short-video script description of a typical day.
       - "pitfalls": The "Reality Check" (Cons) - be honest and slightly sarcastic.
       - "matchScore": 0-100 compatibility.
    
    Return strictly valid JSON with this structure:
    {
      "stats": { "intelligence": number, "creativity": number, "charisma": number, "stamina": number, "tech": number },
      "archetype": "string",
      "careers": [
        {
          "id": "string",
          "category": "string",
          "jobs": [
            {
              "id": "string",
              "title": "string",
              "description": "string",
              "skills": ["string"],
              "salary": "string",
              "dayInLife": "string",
              "pitfalls": "string",
              "matchScore": number
            }
          ]
        }
      ]
    }
  `;

    const { text, usage } = await generateContent(prompt, { responseFormat: 'json' });
    const result = JSON.parse(text);

    return { result, usage };
}

/**
 * 生成模拟场景
 */
export async function generateSimulation(data: {
    jobTitle: string;
    language: 'zh' | 'en';
}): Promise<{ result: object; usage: TokenUsage }> {
    const isZh = data.language === 'zh';

    const prompt = `
    Create a "Day One" RPG scenario for a Junior ${data.jobTitle}.
    Setting: A high-pressure or funny workplace situation.
    Target Language: ${isZh ? 'Simplified Chinese' : 'English'}
    
    Return valid JSON:
    {
      "scenario": "2-3 sentence scenario description",
      "options": [
        { "id": "A", "text": "professional option" },
        { "id": "B", "text": "risky option" },
        { "id": "C", "text": "funny option" }
      ]
    }
  `;

    const { text, usage } = await generateContent(prompt, { responseFormat: 'json' });
    const result = JSON.parse(text);

    return { result, usage };
}

/**
 * 评估模拟选择
 */
export async function evaluateSimulationChoice(data: {
    jobTitle: string;
    scenario: string;
    choice: string;
    language: 'zh' | 'en';
}): Promise<{ result: object; usage: TokenUsage }> {
    const isZh = data.language === 'zh';

    const prompt = `
    Role: RPG Game Master.
    Job: ${data.jobTitle}
    Scenario: ${data.scenario}
    Player Choice: ${data.choice}
    Target Language: ${isZh ? 'Simplified Chinese' : 'English'}

    Analyze the outcome. Did they survive Day 1?
    
    Return valid JSON:
    {
      "feedback": "The narrative result (funny or serious)",
      "score": 0-100,
      "outcome": "SURVIVED" or "WASTED"
    }
  `;

    const { text, usage } = await generateContent(prompt, { responseFormat: 'json' });
    const result = JSON.parse(text);

    return { result, usage };
}

/**
 * 生成技能树
 */
export async function generateSkillTree(data: {
    jobTitle: string;
    language: 'zh' | 'en';
}): Promise<{ result: Array<{ url?: string; [key: string]: unknown }>; usage: TokenUsage }> {
    const isZh = data.language === 'zh';

    const prompt = `
    Create a "Skill Tree" for a ${data.jobTitle}.
    Target Language: ${isZh ? 'Simplified Chinese' : 'English'}
    
    Return 5 high-quality learning resources as valid JSON array:
    [
      {
        "id": "unique-id",
        "title": "Resource Name",
        "type": "Book" | "Video" | "GitHub",
        "description": "Why it's good",
        "xp": 100-500,
        "url": "actual link (github.com, youtube.com, or book link)"
      }
    ]
  `;

    const { text, usage } = await generateContent(prompt, { responseFormat: 'json' });
    const result = JSON.parse(text);

    return { result, usage };
}

/**
 * AI 导师对话
 */
export async function tutorChat(data: {
    history: Array<{ role: 'user' | 'model'; content: string }>;
    message: string;
    jobTitle?: string;
    jobDescription?: string;
    isBossMode: boolean;
    language: 'zh' | 'en';
}): Promise<{ message: string; usage: TokenUsage }> {
    const isZh = data.language === 'zh';

    const systemInstruction = data.isBossMode
        ? `
      [MODE: BOSS BATTLE / MOCK INTERVIEW]
      Role: Ultimate Interviewer Boss for "${data.jobTitle}".
      Language: ${isZh ? 'Simplified Chinese' : 'English'}.
      Style: Strict, high-pressure, professional.
      Goal: Test the user. Ask hard follow-up questions.
      Tone: Intimidating but fair.
    `
        : `
      [MODE: SOCRATIC TUTOR]
      Role: AI Mentor for "${data.jobTitle}".
      Language: ${isZh ? 'Simplified Chinese' : 'English'}.
      Style: Socratic method. Guide with questions, don't just give answers.
      Tone: Encouraging, like a teammate.
      Context: ${data.jobDescription || ''}
    `;

    const { text, usage } = await chat(
        data.history,
        data.message,
        systemInstruction,
        { model: data.isBossMode ? 'gemini-2.0-flash' : 'gemini-2.0-flash' }
    );

    return { message: text, usage };
}

