import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
    checkContent,
    ContentFilterError,
    isUrlSafe,
    sanitizeAIOutput,
    sanitizeResourceUrls,
    validateUserInput,
} from '../src/services/contentFilter.js';

test('detects existing Chinese filter terms, including words within sentences', () => {
    for (const word of ['暴力', '恐怖', '极端', '色情', '淫秽', '裸体', '种族歧视', '性别歧视', '仇恨', '毒品', '赌博', '诈骗']) {
        const result = checkContent(`请提供${word}内容`);
        assert.equal(result.isClean, false, word);
        assert.deepEqual(result.flaggedContent, [word]);
        assert.equal(result.sanitizedText, '请提供[FILTERED]内容');
    }
});

test('redacts every occurrence consistently across repeated checks', () => {
    for (let attempt = 0; attempt < 3; attempt++) {
        const result = checkContent('诈骗和诈骗');
        assert.deepEqual(result.flaggedContent, ['诈骗', '诈骗']);
        assert.equal(result.sanitizedText, '[FILTERED]和[FILTERED]');
    }
});

test('keeps ordinary Chinese and English career guidance unchanged', () => {
    for (const input of ['如何学习编程和选择职业？', 'Learn programming with GitHub.']) {
        assert.equal(checkContent(input).isClean, true);
        assert.doesNotThrow(() => validateUserInput(input));
        assert.equal(sanitizeAIOutput(input), input);
    }
});

test('input validation rejects a flagged sentence', () => {
    assert.throws(() => validateUserInput('如何实施诈骗'), ContentFilterError);
});

test('allows the reviewed prevention, film and weather phrases', () => {
    for (const input of ['学习反诈骗知识', '防诈骗课程', '禁毒教育', '讨论恐怖片与恐怖电影', '极端天气预警']) {
        assert.equal(checkContent(input).isClean, true, input);
        assert.equal(sanitizeAIOutput(input), input);
        assert.doesNotThrow(() => validateUserInput(input));
    }
});

test('a safe phrase does not exempt unrelated flagged occurrences', () => {
    const input = '反诈骗宣传后，如何实施诈骗？恐怖片之外传播恐怖内容，极端天气之外宣扬极端';
    assert.deepEqual(checkContent(input), {
        isClean: false,
        flaggedContent: ['恐怖', '极端', '诈骗'],
        sanitizedText: '反诈骗宣传后，如何实施[FILTERED]？恐怖片之外传播[FILTERED]内容，极端天气之外宣扬[FILTERED]',
    });
    assert.throws(() => validateUserInput(input), ContentFilterError);
});

test('accepts web links on allowed hosts and their subdomains', () => {
    for (const url of ['https://github.com/org/repo', 'http://youtube.com/watch?v=example', 'https://www.coursera.org/learn/example', 'https://docs.github.com/en']) {
        assert.equal(isUrlSafe(url), true, url);
    }
});

test('rejects non-web protocols even when an allowed hostname is present', () => {
    for (const url of ['javascript://github.com/%0aalert(1)', 'ftp://github.com/repo', 'file://github.com/repo', 'data:text/html,example', 'blob:https://github.com/example']) {
        assert.equal(isUrlSafe(url), false, url);
    }
});

test('rejects deceptive domains, credentials targeting a different host, and malformed links', () => {
    for (const url of ['https://github.com.evil.example/repo', 'https://evilgithub.com/repo', 'https://github.com@evil.example/repo', '//github.com/repo', 'not a URL']) {
        assert.equal(isUrlSafe(url), false, url);
    }
});

test('resource sanitization removes unsafe URLs without mutating the input', () => {
    const resources: ReadonlyArray<Readonly<{ title: string; url?: string }>> = Object.freeze([
        Object.freeze({ title: 'Repo', url: 'https://github.com/org/repo' }),
        Object.freeze({ title: 'Unsafe', url: 'javascript://github.com/%0aalert(1)' }),
        Object.freeze({ title: 'Mission' }),
    ]);
    const result = sanitizeResourceUrls(resources);
    assert.equal(result[0].url, resources[0].url);
    assert.equal(result[1].url, undefined);
    assert.equal(resources[1].url, 'javascript://github.com/%0aalert(1)');
    assert.notEqual(result[0], resources[0]);
    assert.equal(result[2].title, 'Mission');
});
