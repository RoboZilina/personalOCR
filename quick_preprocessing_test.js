// Quick preprocessing test
console.log("Testing preprocessing pipeline...");

// Check if key functions exist
const functionsToCheck = [
    'applyPreprocessing',
    'applyTesseractPreprocessing',
    'EngineManager',
    'EngineManager.preprocess',
    'preprocessForEngine'
];

console.log("Checking function availability:");
functionsToCheck.forEach(funcName => {
    let exists = false;
    let path = '';
    
    if (funcName.includes('.')) {
        const parts = funcName.split('.');
        let obj = window;
        for (const part of parts) {
            if (obj && typeof obj === 'object' && part in obj) {
                obj = obj[part];
            } else {
                obj = undefined;
                break;
            }
        }
        exists = typeof obj === 'function';
        path = funcName;
    } else {
        exists = typeof window[funcName] === 'function';
        path = `window.${funcName}`;
    }
    
    console.log(`  ${exists ? '✅' : '❌'} ${path}: ${exists ? 'FOUND' : 'NOT FOUND'}`);
});

// Test applyPreprocessing directly if available
if (typeof window.applyPreprocessing === 'function') {
    console.log("\nTesting applyPreprocessing function...");
    
    // Create a test canvas
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    
    // Draw test pattern
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.font = '20px Arial';
    ctx.fillText('Test', 10, 30);
    
    // Test different modes
    const testModes = ['default_mini', 'adaptive', 'grayscale', 'binarize', 'raw'];
    
    testModes.forEach(mode => {
        try {
            const start = performance.now();
            const result = window.applyPreprocessing(canvas, mode);
            const time = performance.now() - start;
            
            if (result && result.width && result.height) {
                console.log(`  ✅ ${mode}: Success (${time.toFixed(1)}ms), output: ${result.width}x${result.height}`);
                
                // Check if output is different from input (for non-raw modes)
                if (mode !== 'raw') {
                    const inputCtx = canvas.getContext('2d');
                    const outputCtx = result.getContext('2d');
                    const inputData = inputCtx.getImageData(0, 0, canvas.width, canvas.height).data;
                    const outputData = outputCtx.getImageData(0, 0, result.width, result.height).data;
                    
                    // Simple diff check
                    let differentPixels = 0;
                    const minLength = Math.min(inputData.length, outputData.length);
                    for (let i = 0; i < minLength; i += 4) {
                        if (Math.abs(inputData[i] - outputData[i]) > 10 ||
                            Math.abs(inputData[i+1] - outputData[i+1]) > 10 ||
                            Math.abs(inputData[i+2] - outputData[i+2]) > 10) {
                            differentPixels++;
                        }
                    }
                    
                    const diffPercent = (differentPixels / (minLength / 4) * 100).toFixed(1);
                    console.log(`     Diff: ${diffPercent}% pixels changed`);
                }
            } else {
                console.log(`  ❌ ${mode}: Failed - invalid result`);
            }
        } catch (error) {
            console.log(`  ❌ ${mode}: Error - ${error.message}`);
        }
    });
} else {
    console.log("\n⚠️ applyPreprocessing not available for direct testing");
}

// Test EngineManager.preprocess if available
if (window.EngineManager && typeof window.EngineManager.preprocess === 'function') {
    console.log("\nTesting EngineManager.preprocess...");
    
    // Create a test canvas
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.font = '20px Arial';
    ctx.fillText('Test', 10, 30);
    
    try {
        const start = performance.now();
        window.EngineManager.preprocess(canvas, 'default_mini', 1).then(result => {
            const time = performance.now() - start;
            
            if (result && Array.isArray(result) && result.length > 0 && result[0].width && result[0].height) {
                console.log(`  ✅ EngineManager.preprocess: Success (${time.toFixed(1)}ms)`);
                console.log(`     Returned ${result.length} canvas(es), first: ${result[0].width}x${result[0].height}`);
            } else {
                console.log(`  ❌ EngineManager.preprocess: Invalid result format`);
                console.log(`     Result:`, result);
            }
        }).catch(error => {
            console.log(`  ❌ EngineManager.preprocess: Promise rejected - ${error.message}`);
        });
    } catch (error) {
        console.log(`  ❌ EngineManager.preprocess: Error - ${error.message}`);
    }
}

// Test preprocessForEngine if available (in capture_pipeline.js)
if (typeof window.preprocessForEngine === 'function') {
    console.log("\nTesting preprocessForEngine...");
    
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    ctx.font = '20px Arial';
    ctx.fillText('Test', 10, 30);
    
    try {
        const start = performance.now();
        window.preprocessForEngine('tesseract', canvas, 'default_mini', 1).then(result => {
            const time = performance.now() - start;
            
            if (result && Array.isArray(result) && result.length > 0 && result[0].width && result[0].height) {
                console.log(`  ✅ preprocessForEngine: Success (${time.toFixed(1)}ms)`);
                console.log(`     Returned ${result.length} canvas(es), first: ${result[0].width}x${result[0].height}`);
            } else {
                console.log(`  ❌ preprocessForEngine: Invalid result format`);
            }
        }).catch(error => {
            console.log(`  ❌ preprocessForEngine: Promise rejected - ${error.message}`);
        });
    } catch (error) {
        console.log(`  ❌ preprocessForEngine: Error - ${error.message}`);
    }
}

console.log("\n=== Preprocessing Test Complete ===");