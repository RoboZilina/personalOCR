# PersonalOCR Bug Fix Implementation Plan

## Overview
This document provides a detailed, step-by-step implementation plan for fixing the bugs identified in personalOCR. The plan is organized by priority and provides specific instructions, testing procedures, and validation steps for each fix.

## Phase 1: Critical Bug Fixes (Week 1)

### Week 1, Day 1-2: Engine Management Fixes

#### Task 1.1: Fix Race Conditions in Engine Switching
**File:** `js/core/engine_manager.js`
**Lines:** ~250-310 (switchEngine function)
**Issue:** `currentEngineId` set before engine is fully loaded
**Fix:**
```javascript
// Current problematic code:
async function switchEngine(id, options = {}) {
    if (switchingLock) return;
    switchingLock = true;
    currentEngineId = id; // PROBLEM: Set before load
    // ... rest of code
}

// Fixed version:
async function switchEngine(id, options = {}) {
    if (switchingLock) {
        console.warn("[TRACE] Ignored overlapping engine switch");
        return;
    }
    switchingLock = true;
    const previousEngineId = currentEngineId;
    
    try {
        const instance = await getOrLoadEngine(id);
        // Only set currentEngineId AFTER successful load
        currentEngineId = id;
        // ... rest of code
    } catch (err) {
        // Revert to previous engine on error
        currentEngineId = previousEngineId;
        switchingLock = false;
        throw err;
    } finally {
        // Ensure lock is always released
        switchingLock = false;
    }
}
```

**Testing:**
1. Test rapid engine switching (click between engines quickly)
2. Test switching during engine load
3. Verify `currentEngineId` always matches active engine
4. Test error handling by simulating failed loads

#### Task 1.2: Fix Memory Leak in Engine Eviction
**File:** `js/core/engine_manager.js`
**Lines:** ~28-45 (evictOtherEngines function)
**Issue:** Instance references not fully cleared
**Fix:**
```javascript
function evictOtherEngines(activeId) {
    const KEEP_CACHED = new Set(['paddle', 'tesseract']);
    
    for (const [id, meta] of engineMetadata.entries()) {
        if (id === activeId || KEEP_CACHED.has(id)) continue;
        
        if (meta.instance) {
            try {
                // Call dispose if available
                meta.instance.dispose?.();
                // Clear all references
                meta.instance = null;
                if (meta.loadPromise) {
                    meta.loadPromise = null;
                }
            } catch (e) {
                console.warn(`[ENGINE] dispose failed for ${id}`, e);
            }
        }
        // Delete from map
        engineMetadata.delete(id);
    }
}
```

**Testing:**
1. Monitor memory usage while switching engines
2. Verify disposed engines don't retain references
3. Test with Chrome DevTools Memory Profiler

### Week 1, Day 3-4: Capture Pipeline Fixes

#### Task 1.3: Fix Generation Check Race Condition
**File:** `js/core/capture_pipeline.js`
**Lines:** ~86-90 (generation check after first OCR pass)
**Issue:** Check happens too late, allowing interference
**Fix:**
```javascript
// Move generation check to start of captureFrame
async function captureFrame(rect = null) {
    // ... existing initialization code
    
    const myGen = ++window.captureGeneration;
    
    // IMMEDIATE generation check
    if (window.captureGeneration !== myGen) {
        releaseLock();
        return;
    }
    
    // ... rest of capture logic with additional checks
    // Add generation checks before each async operation
}
```

**Testing:**
1. Test rapid capture triggers
2. Verify old captures don't interfere with new ones
3. Test concurrent auto-capture scenarios

#### Task 1.4: Centralize Canvas Cleanup
**File:** `js/core/capture_pipeline.js`
**Issue:** Canvas cleanup scattered, risk of incomplete cleanup
**Fix:**
```javascript
// Create centralized cleanup function
function cleanupCaptureResources(canvases, buffers = []) {
    // Clean canvases
    canvases.forEach(canvas => {
        if (canvas && canvas !== rawCropCanvas) {
            canvas.width = 0;
            canvas.height = 0;
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, 0, 0);
        }
    });
    
    // Clean buffers
    buffers.forEach(buf => {
        if (buf) {
            buf.length = 0; // Clear typed arrays
        }
    });
    
    // Force garbage collection hint
    if (window.gc) window.gc();
}
```

**Testing:**
1. Monitor canvas memory usage
2. Test cleanup during errors
3. Verify no orphaned canvases

### Week 1, Day 5: Settings System Fixes

#### Task 1.5: Fix Settings System Error Handling
**File:** `settings.js`
**Issue:** localStorage failures not handled, event listeners never removed
**Fixes:**

**1. Robust localStorage handling:**
```javascript
export function saveSettings(settings) {
    try {
        currentSettings = { ...settings };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
    } catch (e) {
        console.error("[SETTINGS] Failed to save to localStorage:", e);
        // Fallback strategies:
        // 1. Try to clear space and retry
        // 2. Use sessionStorage as temporary fallback
        // 3. Continue with in-memory only
        currentSettings = { ...settings };
    }
}
```

**2. Event listener cleanup:**
```javascript
// Store reference to listener for cleanup
let themeChangeListener = null;

function initSettings() {
    if (window.matchMedia) {
        themeChangeListener = (e) => {
            if (currentSettings.theme === 'auto') {
                applySettingsToUI();
            }
        };
        window.matchMedia('(prefers-color-scheme: light)')
            .addEventListener('change', themeChangeListener);
    }
}

// Add cleanup function
export function cleanupSettings() {
    if (window.matchMedia && themeChangeListener) {
        window.matchMedia('(prefers-color-scheme: light)')
            .removeEventListener('change', themeChangeListener);
        themeChangeListener = null;
    }
}
```

**Testing:**
1. Test with full localStorage
2. Test event listener cleanup on page unload
3. Verify theme changes work correctly

## Phase 2: High Priority Fixes (Week 2)

### Week 2, Day 1-2: Engine-Specific Fixes

#### Task 2.1: Tesseract Engine Improvements
**File:** `js/tesseract/tesseract_engine.js`
**Issues:** Asset check race, error handling, memory leaks
**Fixes:**

**1. Sequential asset check:**
```javascript
async function load() {
    if (this.isLoaded && this.worker) return;
    
    // Check assets BEFORE creating worker
    const assetsOk = await this.checkAssets();
    if (!assetsOk) {
        throw new Error("Tesseract assets not available");
    }
    
    // ... rest of load logic with proper error handling
}
```

**2. Proper disposal:**
```javascript
async function dispose() {
    if (this.worker) {
        await this.worker.terminate();
        this.worker = null;
    }
    this.isLoaded = false;
}
```

#### Task 2.2: PaddleOCR Engine Fixes
**File:** `js/paddle/paddle_engine.js`
**Issues:** Global state dependency, buffer leaks, error handling
**Fixes:**

**1. Check ONNX Runtime availability:**
```javascript
function getOrtRuntime() {
    const ortRuntime = globalThis.ort;
    if (!ortRuntime) {
        throw new Error('ONNX Runtime not loaded. Check ort.min.js inclusion.');
    }
    return ortRuntime;
}
```

**2. Buffer cleanup:**
```javascript
async function dispose() {
    if (this.recognitionBuffer) {
        this.recognitionBuffer = null;
    }
    if (this.detectionSession) {
        await this.detectionSession.release();
    }
    // ... cleanup other resources
}
```

### Week 2, Day 3-4: UI Controller Fixes

#### Task 2.3: UI Controller Robustness
**File:** `js/ui/ui_controller.js`
**Issues:** DOM element assumptions, timer leaks
**Fixes:**

**1. Safe DOM element access:**
```javascript
function setOCRStatus(state, text, progress = null, sourceId = null) {
    // Get elements safely
    const ocrStatus = document.getElementById('ocr-status');
    const statusLabel = document.getElementById('status-text');
    
    if (!ocrStatus || !statusLabel) {
        console.warn("[UI] Status elements not found");
        return;
    }
    
    // ... rest of implementation
}
```

**2. Timer management:**
```javascript
let statusSettleTimer = null;

function updateStatusWithSettle(state, text) {
    // Clear existing timer
    if (statusSettleTimer) {
        clearTimeout(statusSettleTimer);
        statusSettleTimer = null;
    }
    
    // Set new timer
    statusSettleTimer = setTimeout(() => {
        setOCRStatus(state, text);
        statusSettleTimer = null;
    }, 300);
}

// Cleanup function
function cleanupUI() {
    if (statusSettleTimer) {
        clearTimeout(statusSettleTimer);
        statusSettleTimer = null;
    }
}
```

### Week 2, Day 5: Main Application Fixes

#### Task 2.4: Global State Management
**File:** `app.js`
**Issue:** Excessive global variables
**Fix:**
```javascript
// Encapsulate global state
const AppState = {
    VNOCR_BUILD: "3.8.5",
    VNOCR_DEBUG: false,
    perfStats: {
        inference: 0,
        preprocess: 0,
        lastUpdate: Date.now(),
        showAdvanced: false
    },
    captureGeneration: 0,
    engineReady: false,
    captureLocked: false,
    isProcessing: false
};

// Access via getter/setter
function getAppState(key) {
    return AppState[key];
}

function setAppState(key, value) {
    AppState[key] = value;
}
```

## Phase 3: Medium Priority & Quality Improvements (Week 3)

### Week 3, Day 1-2: Code Quality Improvements

#### Task 3.1: Add Comprehensive Error Boundaries
**Goal:** Wrap critical operations in error boundaries
**Implementation:**
```javascript
function withErrorBoundary(operation, context, fallback) {
    try {
        return operation();
    } catch (err) {
        console.error(`[ERROR] ${context}:`, err);
        if (fallback) return fallback();
        throw err;
    }
}

// Usage example:
async function safeCaptureFrame() {
    return withErrorBoundary(
        () => captureFrame(),
        "captureFrame",
        () => ({ text: "", confidence: 0 })
    );
}
```

#### Task 3.2: Improve Input Validation
**Goal:** Validate all inputs to critical functions
**Implementation:**
```javascript
function validateRect(rect) {
    if (!rect || typeof rect !== 'object') {
        throw new Error("Invalid rect parameter");
    }
    const { x, y, width, height } = rect;
    if (typeof x !== 'number' || typeof y !== 'number' ||
        typeof width !== 'number' || typeof height !== 'number') {
        throw new Error("Rect must have numeric x, y, width, height");
    }
    if (width <= 0 || height <= 0) {
        throw new Error("Rect dimensions must be positive");
    }
    return true;
}
```

### Week 3, Day 3-4: Testing Infrastructure

#### Task 3.3: Add Unit Tests
**Goal:** Create test suite for critical functions
**Test Files to Create:**
1. `tests/engine_manager.test.js`
2. `tests/capture_pipeline.test.js`
3. `tests/settings.test.js`
4. `tests/ui_controller.test.js`

**Example Test:**
```javascript
// tests/engine_manager.test.js
describe('EngineManager', () => {
    beforeEach(() => {
        // Reset EngineManager state
        window.EngineManager = new EngineManager();
    });
    
    test('switchEngine sets currentEngineId only after load', async () => {
        const engineId = 'tesseract';
        await window.EngineManager.switchEngine(engineId);
        expect(window.EngineManager.currentEngineId).toBe(engineId);
    });
    
    test('evictOtherEngines clears references', () => {
        // Test memory cleanup
    });
});
```

#### Task 3.4: Performance Testing
**Goal:** Add performance monitoring
**Implementation:**
```javascript
// Performance monitoring utility
class PerformanceMonitor {
    constructor() {
        this.metrics = new Map();
        this.samples = new Map();
    }
    
    start(operation) {
        this.metrics.set(operation, {
            startTime: performance.now(),
            memoryBefore: this.getMemoryUsage()
        });
    }
    
    end(operation) {
        const metric = this.metrics.get(operation);
        if (!metric) return null;
        
        const duration = performance.now() - metric.startTime;
        const memoryAfter = this.getMemoryUsage();
        
        // Store sample
        const samples = this.samples.get(operation) || [];
        samples.push({ duration, memoryDelta: memoryAfter - metric.memoryBefore });
        this.samples.set(operation, samples.slice(-100)); // Keep last 100
        
        this.metrics.delete(operation);
        return { duration, memoryDelta: memoryAfter - metric.memoryBefore };
    }
    
    getMemoryUsage() {
        // Browser-specific memory API
        return performance.memory?.usedJSHeapSize || 0;
    }
}
```

### Week 3, Day 5: Documentation & Finalization

#### Task 3.5: Update Documentation
**Files to Update:**
1. `README.md` - Add bug fix documentation
2. `CHANGELOG.md` - Document all fixes
3. `API_DOCUMENTATION.md` - Document public APIs

#### Task 3.6: Create Rollback Plan
**Plan for each fix:**
1. **Pre-deployment:** Backup current code
2. **Staged rollout:** Deploy to staging first
3. **Monitoring:** Monitor for regressions
4. **Rollback procedure:** Document steps to revert if issues arise

## Implementation Priorities

### Must-Have (Critical Path)
1. Race condition fixes in engine switching
2. Memory leak fixes in capture pipeline
3. Error handling improvements
4. Settings system robustness

### Should-Have (High Value)
1. Engine-specific improvements
2. UI controller robustness
3. Global state management
4. Input validation

### Nice-to-Have (Quality)
1. Comprehensive error boundaries
2. Unit test suite
3. Performance monitoring
4. Documentation updates

## Risk Mitigation

### Technical Risks
1. **Breaking changes:** Test thoroughly before deployment
2. **Performance impact:** Profile before/after each change
3. **Browser compatibility:** Test across target browsers

### Process Risks
1. **Scope creep:** Stick to priority list
2. **Timeline slippage:** Weekly progress reviews
3. **Quality issues:** Code reviews for each fix

## Success Metrics

### Quantitative Metrics
1. **Memory usage:** Reduce by 20% after fixes
2. **Error rate:** Reduce unhandled exceptions by 90%
3. **Performance:** Maintain or improve current speed
4. **Test coverage:** Achieve 80% coverage for critical paths

### Qualitative Metrics
1. **Code maintainability:** Improved readability
2. **Developer experience:** Clearer error messages
3. **User experience:** More stable application

## Timeline Summary

**Week 1:** Critical bug fixes (stability)
**Week 2:** High priority fixes (robustness)
**Week 3:** Quality improvements (maintainability)
**Week 4:** Testing, documentation, deployment

## Next Steps

1. **Review this plan** with the development team
2. **Prioritize fixes** based on impact/effort
3. **Begin implementation** with Phase 1
4. **Weekly progress reviews** to adjust as needed

This implementation plan provides a clear, actionable roadmap for fixing all identified bugs while maintaining application stability and improving overall quality.