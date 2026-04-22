import { cleanVNText, applyVNValidator, scoreJapaneseDensity } from './js/utils/text_validator.js';

function testCleaning() {
    const tests = [
        { input: 'こんにちは、世界。', expected: 'こんにちは、世界。' },
        { input: 'こんにちは|世界', expected: 'こんにちは世界' },
        { input: '[NaN%] ありがとう', expected: 'ありがとう' },
        { input: 'こんにちは、世界。。', expected: 'こんにちは、世界。' },
        { input: 'Hello, world.', expected: 'Hello, world.' },
        { input: 'こんにちは  世界', expected: 'こんにちは世界' },
        { input: 'Hell0 w0rld', expected: 'HellO wOrld' },
        { input: '1ove', expected: 'love' },
        { input: 'こんにちはworld', expected: 'こんにちは world' },
        { input: 'Hello世界', expected: 'Hello 世界' },
        { input: 'です。。', expected: 'です。' },
        { input: '> ありがとう', expected: 'ありがとう' },
        { input: '', expected: '' },
        { input: 'a', expected: 'a' },
    ];
    
    let passed = 0;
    let failed = 0;
    for (const test of tests) {
        const actual = cleanVNText(test.input);
        if (actual === test.expected) {
            passed++;
            console.log(`✓ ${JSON.stringify(test.input)} => ${JSON.stringify(actual)}`);
        } else {
            failed++;
            console.log(`✗ ${JSON.stringify(test.input)}`);
            console.log(`  expected ${JSON.stringify(test.expected)}`);
            console.log(`  got      ${JSON.stringify(actual)}`);
        }
    }
    console.log(`\nCleaning tests: ${passed} passed, ${failed} failed`);
    return failed === 0;
}

function testValidator() {
    const tests = [
        {
            lines: ['こんにちは', '[NaN%]', '世界', '|', ''],
            separator: ' ',
            expected: 'こんにちは 世界'
        },
        {
            lines: ['Hello', 'world', '|', 'こんにちは'],
            separator: '\n',
            expected: 'Hello\nworld\nこんにちは'
        },
    ];
    
    let passed = 0;
    let failed = 0;
    for (const test of tests) {
        const actual = applyVNValidator(test.lines, test.separator);
        if (actual === test.expected) {
            passed++;
            console.log(`✓ lines ${JSON.stringify(test.lines)} => ${JSON.stringify(actual)}`);
        } else {
            failed++;
            console.log(`✗ lines ${JSON.stringify(test.lines)}`);
            console.log(`  expected ${JSON.stringify(test.expected)}`);
            console.log(`  got      ${JSON.stringify(actual)}`);
        }
    }
    console.log(`\nValidator tests: ${passed} passed, ${failed} failed`);
    return failed === 0;
}

function testDensity() {
    const tests = [
        { text: 'こんにちは', expected: 5 },
        { text: 'Hello', expected: -2.5 },
        { text: 'こんにちは world', expected: 2.5 },
    ];
    
    let passed = 0;
    let failed = 0;
    for (const test of tests) {
        const actual = scoreJapaneseDensity(test.text);
        // allow floating point tolerance
        if (Math.abs(actual - test.expected) < 0.01) {
            passed++;
            console.log(`✓ density "${test.text}" => ${actual}`);
        } else {
            failed++;
            console.log(`✗ density "${test.text}"`);
            console.log(`  expected ${test.expected}`);
            console.log(`  got      ${actual}`);
        }
    }
    console.log(`\nDensity tests: ${passed} passed, ${failed} failed`);
    return failed === 0;
}

async function main() {
    console.log('Running VN Text Validator tests...\n');
    const cleanOk = testCleaning();
    console.log('');
    const validatorOk = testValidator();
    console.log('');
    const densityOk = testDensity();
    console.log('');
    
    const allOk = cleanOk && validatorOk && densityOk;
    if (allOk) {
        console.log('All tests passed!');
        process.exit(0);
    } else {
        console.log('Some tests failed.');
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});