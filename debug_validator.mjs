import { cleanVNText, applyVNValidator, scoreJapaneseDensity } from './js/utils/text_validator.js';

const sample = 'ちなみに、今日はド平日でこいつらも学生だ。、ー \\ ヘハ M ⑧ へへ [NaN%]';
console.log('Input:', JSON.stringify(sample));
console.log('Cleaned:', JSON.stringify(cleanVNText(sample)));
console.log('Density:', scoreJapaneseDensity(sample));

// Let's also test each internal function by importing them? Not exported.
// We'll manually call removeGarbage by importing the whole module and using eval? Not needed.
// Let's just see what the garbage removal does by copying the function logic.
// But we can also import the module and call non-exported functions via module.default? Not possible.

// Let's create a quick hack: read the file and evaluate? Too heavy.
// Instead, we can test the regex patterns.

const uiPatterns = [
    /\[NaN%\]/g,
    /\[undefined\]/g,
    /\[object Object\]/g,
    /\[0%\]/g,
    /\[100%\]/g,
    /\[[0-9]{1,3}%\]/g,
    /%$/g,
];
let cleaned = sample;
uiPatterns.forEach(p => cleaned = cleaned.replace(p, ''));
console.log('After UI patterns:', JSON.stringify(cleaned));

// Isolated garbage removal
cleaned = cleaned.replace(/[\|><*_~#^)(\]\[}{%@+=;:](?![A-Za-z0-9])/g, '');
cleaned = cleaned.replace(/(?<![A-Za-z0-9])[\|><*_~#^)(\]\[}{%@+=;:]/g, '');
console.log('After isolated garbage:', JSON.stringify(cleaned));

// Punctuation normalization
function isMostlyJapanese(text) {
    const jp = (text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\uFF65-\uFF9F]/g) || []).length;
    return jp / text.length >= 0.6;
}
let normalized = cleaned;
normalized = normalized.replace(/。{2,}/g, '。');
normalized = normalized.replace(/、{2,}/g, '、');
normalized = normalized.replace(/！{2,}/g, '！');
normalized = normalized.replace(/？{2,}/g, '？');
normalized = normalized.replace(/、,/g, '、');
normalized = normalized.replace(/。,/g, '。');
normalized = normalized.replace(/。\./g, '。');
normalized = normalized.replace(/、\./g, '、');
if (isMostlyJapanese(cleaned)) {
    normalized = normalized.replace(/,/g, '、');
    normalized = normalized.replace(/\./g, '。');
}
console.log('After punctuation:', JSON.stringify(normalized));

// Spacing rules
function applySpacingRules(text) {
    let cleaned = text.replace(/\s+/g, ' ');
    const chars = cleaned;
    let result = '';
    let prevType = null;
    for (let i = 0; i < chars.length; i++) {
        const ch = chars[i];
        let type = 'other';
        if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\uFF65-\uFF9F]/.test(ch)) type = 'jp';
        else if (/[A-Za-z0-9]/.test(ch)) type = 'latin';
        if (prevType && prevType !== type && ((prevType === 'jp' && type === 'latin') || (prevType === 'latin' && type === 'jp'))) {
            if (result.length > 0 && result[result.length - 1] !== ' ') result += ' ';
        }
        result += ch;
        prevType = type;
    }
    // Remove spaces between Japanese characters
    let finalResult = '';
    for (let i = 0; i < result.length; i++) {
        const ch = result[i];
        if (ch === ' ') {
            const prev = i > 0 ? result[i - 1] : null;
            const next = i < result.length - 1 ? result[i + 1] : null;
            if (prev && next && /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\uFF65-\uFF9F]/.test(prev) && /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\uFF65-\uFF9F]/.test(next)) {
                continue;
            }
        }
        finalResult += ch;
    }
    cleaned = finalResult.replace(/\s+([、。])/g, '$1');
    return cleaned;
}
console.log('After spacing:', JSON.stringify(applySpacingRules(normalized)));