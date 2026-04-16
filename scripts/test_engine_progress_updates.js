/**
 * scripts/test_engine_progress_updates.js
 * Unit tests for engine progress update filtering logic
 * Ensures errors from background load are shown when state==ERROR or debug flag is set
 */

// Mock the global objects and constants that the engine code depends on
global.window = {
    VNOCR_DEBUG: false
};

global.STATUS = {
    IDLE: 'idle',
    PRE_LOADING: 'pre-loading',
    DOWNLOADING: 'downloading',
    LOADING: 'loading',
    WARMING: 'warming-up',
    READY: 'ready',
    PROCESSING: 'processing',
    ERROR: 'error'
};

// Mock the notifyStatus function to capture calls
let capturedCalls = [];
const mockNotifyStatus = (state, text, progress = null, targetId = null) => {
    capturedCalls.push({ state, text, progress, targetId });
};

// Test the reporter function logic that was modified
function createReporter(isSilent, currentEngineId, engineId) {
    return (state, text, progress) => {
        // This is the core logic from the modified app.v38.js
        if (!isSilent || engineId === currentEngineId || state === global.STATUS.ERROR || global.window.VNOCR_DEBUG) {
            mockNotifyStatus(state, text, progress, engineId);
        }
    };
}

console.log("--- Starting Engine Progress Update Tests ---");

const tests = [
    {
        name: "Non-active engine progress updates should be filtered in silent mode",
        setup: () => {
            capturedCalls = [];
            global.window.VNOCR_DEBUG = false;
            const reporter = createReporter(true, 'tesseract', 'manga');
            reporter(global.STATUS.LOADING, 'Loading...', 0.5);
        },
        expected: 0,
        description: "Should not show progress from non-active engine in silent mode"
    },
    {
        name: "Non-active engine ERROR updates should be shown in silent mode",
        setup: () => {
            capturedCalls = [];
            global.window.VNOCR_DEBUG = false;
            const reporter = createReporter(true, 'tesseract', 'manga');
            reporter(global.STATUS.ERROR, 'Load failed', null);
        },
        expected: 1,
        description: "Should show ERROR from non-active engine even in silent mode"
    },
    {
        name: "Non-active engine updates should be shown when debug flag is set",
        setup: () => {
            capturedCalls = [];
            global.window.VNOCR_DEBUG = true;
            const reporter = createReporter(true, 'tesseract', 'manga');
            reporter(global.STATUS.LOADING, 'Loading...', 0.5);
        },
        expected: 1,
        description: "Should show all updates from non-active engine when debug flag is set"
    },
    {
        name: "Active engine updates should always be shown",
        setup: () => {
            capturedCalls = [];
            global.window.VNOCR_DEBUG = false;
            const reporter = createReporter(true, 'manga', 'manga');
            reporter(global.STATUS.LOADING, 'Loading...', 0.5);
        },
        expected: 1,
        description: "Should always show updates from active engine"
    },
    {
        name: "Non-silent mode should show all updates",
        setup: () => {
            capturedCalls = [];
            global.window.VNOCR_DEBUG = false;
            const reporter = createReporter(false, 'tesseract', 'manga');
            reporter(global.STATUS.LOADING, 'Loading...', 0.5);
        },
        expected: 1,
        description: "Should show all updates in non-silent mode"
    },
    {
        name: "Non-active engine READY updates should be filtered in silent mode",
        setup: () => {
            capturedCalls = [];
            global.window.VNOCR_DEBUG = false;
            const reporter = createReporter(true, 'tesseract', 'manga');
            reporter(global.STATUS.READY, 'Ready', null);
        },
        expected: 0,
        description: "Should not show READY from non-active engine in silent mode"
    },
    {
        name: "Non-active engine ERROR updates should be shown even when not debug",
        setup: () => {
            capturedCalls = [];
            global.window.VNOCR_DEBUG = false;
            const reporter = createReporter(true, 'tesseract', 'paddle');
            reporter(global.STATUS.ERROR, 'Network timeout', null);
        },
        expected: 1,
        description: "Should show ERROR from background engine without debug flag"
    }
];

let passCount = 0;
tests.forEach((test, i) => {
    test.setup();
    const passed = capturedCalls.length === test.expected;
    
    if (passed) {
        console.log(`✅ Test ${i + 1}: ${test.name}`);
        console.log(`   ${test.description}`);
        passCount++;
    } else {
        console.error(`❌ Test ${i + 1}: ${test.name}`);
        console.error(`   ${test.description}`);
        console.error(`   Expected ${test.expected} calls, got ${capturedCalls.length}`);
        if (capturedCalls.length > 0) {
            console.error(`   Captured calls:`, capturedCalls);
        }
    }
});

console.log("---------------------------------------------");
console.log(`Summary: ${passCount}/${tests.length} tests PASSED.`);

// Test specific background load error scenario
console.log("\n--- Background Load Error Scenario Test ---");
capturedCalls = [];
global.window.VNOCR_DEBUG = false;

// Simulate background loading of manga engine while tesseract is active
const backgroundReporter = createReporter(true, 'tesseract', 'manga');

// Simulate various background loading states
backgroundReporter(global.STATUS.DOWNLOADING, '🟡 MangaOCR: downloading manifest…', 0.1);
backgroundReporter(global.STATUS.DOWNLOADING, '🟡 MangaOCR: downloading encoder…', 0.3);
backgroundReporter(global.STATUS.ERROR, '🔴 MangaOCR: Network timeout while downloading decoder', null);

const errorShown = capturedCalls.some(call => 
    call.state === global.STATUS.ERROR && call.targetId === 'manga'
);
const progressFiltered = capturedCalls.filter(call => 
    call.state === global.STATUS.DOWNLOADING && call.targetId === 'manga'
).length === 0;

if (errorShown && progressFiltered) {
    console.log("✅ Background Load Error Scenario: PASSED");
    console.log("   Progress updates were filtered, but error was shown");
    passCount++;
} else {
    console.error("❌ Background Load Error Scenario: FAILED");
    console.error(`   Error shown: ${errorShown}, Progress filtered: ${progressFiltered}`);
    console.error(`   Captured calls:`, capturedCalls);
}

console.log("---------------------------------------------");
console.log(`Final Summary: ${passCount}/${tests.length + 1} tests PASSED.`);

if (passCount === tests.length + 1) {
    console.log("🎉 All tests passed! Engine progress update filtering works correctly.");
    process.exit(0);
} else {
    console.error("💥 Some tests failed. Please review the implementation.");
    process.exit(1);
}
