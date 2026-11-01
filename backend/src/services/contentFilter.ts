/**
 * 内容安全过滤服务
 * 在调用 Gemini 前后进行内容检查
 */

// 敏感词模式工厂（每次调用返回新的 RegExp，避免 g flag 状态问题）
const sensitivePatternFactories: ReadonlyArray<() => RegExp> = [
    // 政治敏感
    () => /(暴力|恐怖|极端)/g,
    // 色情
    () => /(色情|淫秽|裸体)/g,
    // 歧视
    () => /(种族歧视|性别歧视|仇恨)/g,
    // 违法
    () => /(毒品|赌博|诈骗)/g,
];

// 用于替换敏感内容的占位符
const REDACTED = '[FILTERED]';

export interface ContentCheckResult {
    isClean: boolean;
    flaggedContent: string[];
    sanitizedText: string;
}

/**
 * 检查文本是否包含敏感内容
 */
export function checkContent(text: string): ContentCheckResult {
    const flaggedContent: string[] = [];
    let sanitizedText = text;
    // Exempt only the matched phrase, never the rest of the message.
    const safeRanges = Array.from(text.matchAll(/反诈骗|防诈骗|禁毒|恐怖片|恐怖电影|极端天气/g), match => ({
        start: match.index!, end: match.index! + match[0].length,
    }));
    const replacements: Array<{ start: number; end: number }> = [];

    for (const createPattern of sensitivePatternFactories) {
        for (const match of text.matchAll(createPattern())) {
            const start = match.index!;
            const end = start + match[0].length;
            if (!safeRanges.some(range => start >= range.start && end <= range.end)) {
                flaggedContent.push(match[0]);
                replacements.push({ start, end });
            }
        }
    }
    for (const { start, end } of replacements.sort((a, b) => b.start - a.start)) {
        sanitizedText = sanitizedText.slice(0, start) + REDACTED + sanitizedText.slice(end);
    }

    return {
        isClean: flaggedContent.length === 0,
        flaggedContent,
        sanitizedText,
    };
}

/**
 * 检查用户输入
 * 如果包含敏感内容，抛出错误
 */
export function validateUserInput(input: string): void {
    const result = checkContent(input);

    if (!result.isClean) {
        throw new ContentFilterError(
            '输入包含不当内容，请修改后重试',
            result.flaggedContent
        );
    }
}

/**
 * 过滤 AI 输出
 * 确保返回内容符合安全标准
 */
export function sanitizeAIOutput(output: string): string {
    const result = checkContent(output);

    if (!result.isClean) {
        console.warn('AI output contained sensitive content:', result.flaggedContent);
        return result.sanitizedText;
    }

    return output;
}

/**
 * 检查 URL 是否安全
 */
export function isUrlSafe(url: string): boolean {
    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
            return false;
        }
        const safeHosts = [
            'github.com',
            'youtube.com',
            'www.youtube.com',
            'youtu.be',
            'amazon.com',
            'www.amazon.com',
            'goodreads.com',
            'www.goodreads.com',
            'coursera.org',
            'www.coursera.org',
            'udemy.com',
            'www.udemy.com',
        ];

        return safeHosts.some(host =>
            parsedUrl.hostname === host || parsedUrl.hostname.endsWith('.' + host)
        );
    } catch {
        return false;
    }
}

/**
 * 过滤资源列表中的不安全 URL（不可变模式，返回新数组）
 */
export function sanitizeResourceUrls<T extends { url?: string;[key: string]: unknown }>(
    resources: ReadonlyArray<T>,
): T[] {
    return resources.map((resource) => {
        if (resource.url && !isUrlSafe(resource.url)) {
            return { ...resource, url: undefined };
        }
        return { ...resource };
    });
}

/**
 * 内容过滤错误
 */
export class ContentFilterError extends Error {
    public flaggedContent: string[];

    constructor(message: string, flaggedContent: string[]) {
        super(message);
        this.name = 'ContentFilterError';
        this.flaggedContent = flaggedContent;
    }
}

