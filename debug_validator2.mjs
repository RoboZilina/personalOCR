import { cleanVNText } from './js/utils/text_validator.js';

const sample = 'ちなみに、今日はド平日でこいつらも学生だ。、ー \\ ヘハ M ⑧ へへ [NaN%]';
console.log('Input:', JSON.stringify(sample));
console.log('Cleaned:', JSON.stringify(cleanVNText(sample)));
console.log('Cleaned visible:', cleanVNText(sample));