// Simple console test for preprocessing functions
// This tests the core logic without browser dependencies

console.log('Testing preprocessing function logic...\n');

// Mock canvas and context for testing
class MockCanvas {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.data = new Array(width * height * 4).fill(255); // White background
    }
    
    getContext() {
        return {
            drawImage: () => {},
            getImageData: () => ({
                data: this.data,
                width: this.width,
                height: this.height
            }),
            putImageData: () => {},
            createImageData: () => ({
                data: new Uint8ClampedArray(this.width * this.height * 4),
                width: this.width,
                height: this.height
            }),
            fillRect: () => {},
            fillStyle: ''
        };
    }
}

// Test the lumaBT601 function (should be defined in app.js)
function testLumaBT601() {
    console.log('Testing lumaBT601 function...');
    
    // This is the actual function from app.js line 854
    const lumaBT601 = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
    
    const tests = [
        { r: 0, g: 0, b: 0, expected: 0 },
        { r: 255, g: 255, b: 255, expected: 255 },
        { r: 100, g: 150, b: 200, expected: 0.299*100 + 0.587*150 + 0.114*200 }
    ];
    
    let passed = 0;
    tests.forEach((test, i) => {
        const result = lumaBT601(test.r, test.g, test.b);
        const expected = test.expected;
        const tolerance = 0.001;
        const success = Math.abs(result - expected) < tolerance;
        
        if (success) {
            passed++;
            console.log(`  Test ${i+1}: ✓ PASS (${result.toFixed(2)})`);
        } else {
            console.log(`  Test ${i+1}: ✗ FAIL (got ${result.toFixed(2)}, expected ${expected.toFixed(2)})`);
        }
    });
    
    console.log(`  Result: ${passed}/${tests.length} passed\n`);
    return passed === tests.length;
}

// Test the applyPreprocessing function structure
function testPreprocessingStructure() {
    console.log('Checking preprocessing function structure...');
    
    // Read the app.js file to check for issues
    const fs = require('fs');
    const path = require('path');
    
    try {
        const appJsContent = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
        
        // Check for common issues
        const issues = [];
        
        // 1. Check if applyPreprocessing function exists
        if (!appJsContent.includes('function applyPreprocessing')) {
            issues.push('applyPreprocessing function not found');
        }
        
        // 2. Check for missing helper functions
        const requiredHelpers = [
            'function lr_upscale',
            'function lr_addPadding',
            'function medianFilter',
            'function invertCanvas',
            'function sharpenCanvas',
            'function adaptiveThreshold'
        ];
        
        requiredHelpers.forEach(helper => {
            if (!appJsContent.includes(helper)) {
                issues.push(`${helper} not found`);
            }
        });
        
        // 3. Check for mode handling
        const modes = ['default_mini', 'default_full', 'adaptive', 'binarize', 'grayscale', 'raw'];
        modes.forEach(mode => {
            if (!appJsContent.includes(`mode === '${mode}'`)) {
                issues.push(`Mode '${mode}' not handled in applyPreprocessing`);
            }
        });
        
        // Check for multi and last_resort modes in applyTesseractPreprocessing
        if (!appJsContent.includes("mode === 'multi'")) {
            issues.push("Multi-pass mode ('multi') not handled");
        }
        
        if (!appJsContent.includes("mode === 'last_resort'")) {
            issues.push("Last resort mode ('last_resort') not handled");
        }
        
        if (issues.length === 0) {
            console.log('  ✓ All structural checks passed\n');
            return true;
        } else {
            console.log('  ✗ Found issues:');
            issues.forEach(issue => console.log(`    - ${issue}`));
            console.log('');
            return false;
        }
    } catch (err) {
        console.log(`  ✗ Error reading app.js: ${err.message}\n`);
        return false;
    }
}

// Test the actual preprocessing logic by examining the code
function testPreprocessingLogic() {
    console.log('Analyzing preprocessing logic...');
    
    const fs = require('fs');
    const path = require('path');
    
    try {
        const appJsContent = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
        
        // Extract the applyPreprocessing function
        const funcStart = appJsContent.indexOf('function applyPreprocessing');
        if (funcStart === -1) {
            console.log('  ✗ applyPreprocessing function not found\n');
            return false;
        }
        
        // Find the end of the function (next function declaration)
        const nextFuncMatch = appJsContent.substring(funcStart).match(/\nfunction \w+\(|\nconst \w+ = \(|\n\/\/ Enhancements/);
        const funcEnd = nextFuncMatch ? funcStart + nextFuncMatch.index : appJsContent.length;
        const funcContent = appJsContent.substring(funcStart, funcEnd);
        
        console.log('  Function found, analyzing logic...');
        
        // Check for potential issues
        const warnings = [];
        
        // 1. Check for upscaleSlider reference
        if (funcContent.includes('upscaleSlider?.value')) {
            console.log('  ✓ upscaleSlider reference found (line 1048)');
        } else {
            warnings.push('upscaleSlider reference missing - may cause scaling issues');
        }
        
        // 2. Check for lumaBT601 usage
        if (funcContent.includes('lumaBT601')) {
            console.log('  ✓ lumaBT601 function used');
        } else {
            warnings.push('lumaBT601 not used - luminance calculation may be incorrect');
        }
        
        // 3. Check for canvas creation and disposal
        if (funcContent.includes('document.createElement(\'canvas\')')) {
            console.log('  ✓ Canvas creation logic present');
        }
        
        // 4. Check for unified cleanup step
        if (funcContent.includes('UNIFIED CLEANUP STEP')) {
            console.log('  ✓ Unified cleanup step present');
        }
        
        // 5. Check for return statement
        if (funcContent.includes('return lr_addPadding')) {
            console.log('  ✓ Function returns padded canvas');
        }
        
        if (warnings.length > 0) {
            console.log('  ⚠ Warnings:');
            warnings.forEach(warning => console.log(`    - ${warning}`));
        }
        
        console.log('');
        return warnings.length === 0;
    } catch (err) {
        console.log(`  ✗ Error analyzing function: ${err.message}\n`);
        return false;
    }
}

// Run all tests
function runAllTests() {
    console.log('='.repeat(60));
    console.log('PREPROCESSING DIAGNOSTIC TESTS');
    console.log('='.repeat(60));
    
    const test1 = testLumaBT601();
    const test2 = testPreprocessingStructure();
    const test3 = testPreprocessingLogic();
    
    console.log('='.repeat(60));
    console.log('SUMMARY:');
    console.log(`  lumaBT601 function: ${test1 ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Structure checks: ${test2 ? '✓ PASS' : '✗ FAIL'}`);
    console.log(`  Logic analysis: ${test3 ? '✓ PASS' : '⚠ WARNINGS'}`);
    
    const allPassed = test1 && test2;
    console.log(`\nOverall: ${allPassed ? '✓ PREPROCESSING LOOKS OK' : '✗ ISSUES DETECTED'}`);
    console.log('='.repeat(60));
    
    if (!allPassed) {
        console.log('\nRECOMMENDED ACTIONS:');
        console.log('1. Check browser console for JavaScript errors');
        console.log('2. Verify all helper functions are defined in app.js');
        console.log('3. Test each preprocessing mode individually');
        console.log('4. Check for missing variable declarations (upscaleSlider)');
    }
}

// Run tests
runAllTests();