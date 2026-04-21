# AI Implementation Guide for PersonalOCR Bug Fixes

## Overview
This guide provides exact, executable instructions for an AI model to implement minimal, safe bug fixes in the personalOCR codebase. All changes are designed to be backward compatible, non-breaking, and focused on defensive programming.

## Implementation Principles for AI

1. **Exact Changes Only**: Use SEARCH/REPLACE patterns with precise line matching
2. **Minimal Surface Area**: Each change should be as small as possible
3. **Preserve Behavior**: Don't change functionality, only add safety nets
4. **Test After Each Change**: Verify the application still works
5. **Document Changes**: Update this guide with results

## Phase 1: Critical Safety Nets (Week 1)

### Day 1: Engine Manager Safety Improvements

#### Task 1.1: Add Null Checks to Engine Switching
**File:** `js/core/engine_manager.js`
**Objective:** Prevent crashes when switching engines fails
**Exact Change:**

```javascript
------- SEARCH
    async function switchEngine(id, options = {}) {
        if (switchingLock) return;
        switchingLock = true;
        currentEngineId = id;

        try {
            const instance = await getOrLoadEngine(id);
=======
    async function switchEngine(id, options = {}) {
        // Safety check: validate engine ID
        if (!id || typeof id !== 'string') {
            console.warn('[ENGINE] Invalid engine ID:', id);
            switchingLock = false;
            return;
        }
        
        if (switchingLock) {
            console.warn('[ENGINE] Ignored overlapping switch attempt');
            return;
        }
        
        switchingLock = true;
        const previousEngineId = currentEngineId;

        try {
            const instance = await getOrLoadEngine(id);
            // Only update currentEngineId AFTER successful load
            currentEngineId = id;
+++++++ REPLACE
```

**Testing Instructions:**
1. After making this change, test engine switching in the UI
2. Verify all three engines (Tesseract, PaddleOCR, MangaOCR) still load correctly
3. Test rapid switching between engines

#### Task 1.2: Add Error Boundary to getOrLoadEngine
**File:** `js/core/engine_manager.js`
**Objective:** Prevent unhandled exceptions in engine loading
**Exact Change:**

```javascript
------- SEARCH
    async function getOrLoadEngine(id, isSilent = false) {
        // 1. Cache/Deduplication Hit
        if (meta.state === 'ready') return meta.instance;
        if (meta.state === 'loading') return meta.loadPromise;

        // 2. Start Loading Lifecycle
        meta.state = 'loading';
        const loadStartTime = performance.now();

        // ATOMIC FIX: Create and assign promise synchronously BEFORE any await
        const loadPromise = (async () => {
=======
    async function getOrLoadEngine(id, isSilent = false) {
        // Safety check: validate engine ID
        if (!id || typeof id !== 'string') {
            console.error('[ENGINE] Invalid engine ID in getOrLoadEngine:', id);
            throw new Error(`Invalid engine ID: ${id}`);
        }
        
        let meta = engineMetadata.get(id);
        if (!meta) {
            meta = { state: 'pending', instance: null, loadPromise: null };
            engineMetadata.set(id, meta);
        }
        
        // 1. Cache/Deduplication Hit
        if (meta.state === 'ready') return meta.instance;
        if (meta.state === 'loading') return meta.loadPromise;

        // 2. Start Loading Lifecycle
        meta.state = 'loading';
        const loadStartTime = performance.now();

        // ATOMIC FIX: Create and assign promise synchronously BEFORE any await
        const loadPromise = (async () => {
            try {
+++++++ REPLACE
```

**Additional Change at end of loadPromise:**

```javascript
------- SEARCH
                return instance;
            } catch (err) {
                meta.state = 'error';
                meta.loadPromise = null;
                throw err;
            }
=======
                return instance;
            } catch (err) {
                meta.state = 'error';
                meta.loadPromise = null;
                console.error(`[ENGINE] Failed to load engine ${id}:`, err);
                // Rethrow with context
                throw new Error(`Failed to load engine ${id}: ${err.message}`);
            }
+++++++ REPLACE
```

**Testing Instructions:**
1. Test engine loading after making this change
2. Verify error messages are clearer if an engine fails to load
3. Check that the UI still shows proper status when engines fail

### Day 2: Capture Pipeline Safety Improvements

#### Task 2.1: Add Generation Check at Start of Capture
**File:** `js/core/capture_pipeline.js`
**Objective:** Prevent race conditions by checking generation earlier
**Exact Change:**

```javascript
------- SEARCH
    // Capture entry point — called by UI button or auto‑capture timer
    async function captureFrame(rect = null) {
        // Early exit if engine not ready or already processing
        if (!window.engineReady || window.captureLocked) {
            console.warn('[CAPTURE] Skipped — engine not ready or locked');
            return;
        }

        window.captureLocked = true;
        const myGen = ++window.captureGeneration;
=======
    // Capture entry point — called by UI button or auto‑capture timer
    async function captureFrame(rect = null) {
        // Safety check: validate engine state
        if (!window.engineReady || window.captureLocked) {
            console.warn('[CAPTURE] Skipped — engine not ready or locked');
            return;
        }

        window.captureLocked = true;
        const myGen = ++window.captureGeneration;
        
        // IMMEDIATE generation check (safety against rapid triggers)
        if (window.captureGeneration !== myGen) {
            window.captureLocked = false;
            console.warn('[CAPTURE] Generation mismatch, aborting');
            return;
        }
+++++++ REPLACE
```

#### Task 2.2: Add Error Handling to OCR Processing
**File:** `js/core/capture_pipeline.js`
**Objective:** Prevent unhandled exceptions during OCR
**Exact Change:**

```javascript
------- SEARCH
            // 1. First Pass: Early exit if result is highly confident and clean
            const infStart = performance.now();
            const first = await window.EngineManager.runOCR(canvases[0], { engineInstance: pinnedEngine });
            
            // Generation Check (Critical for preventing UI ghosting)
            if (window.captureGeneration !== myGen) {
                canvases.forEach(c => { c.width = 0; c.height = 0; });
                releaseLock();
                return;
            }
=======
            // 1. First Pass: Early exit if result is highly confident and clean
            const infStart = performance.now();
            
            // Safety wrapper for OCR operation
            let first;
            try {
                first = await window.EngineManager.runOCR(canvases[0], { engineInstance: pinnedEngine });
            } catch (ocrErr) {
                console.error('[CAPTURE] OCR processing failed:', ocrErr);
                canvases.forEach(c => { c.width = 0; c.height = 0; });
                releaseLock();
                return;
            }
            
            // Generation Check (Critical for preventing UI ghosting)
            if (window.captureGeneration !== myGen) {
                canvases.forEach(c => { c.width = 0; c.height = 0; });
                releaseLock();
                return;
            }
+++++++ REPLACE
```

**Testing Instructions:**
1. Test manual capture after making these changes
2. Test auto-capture functionality
3. Verify no new errors appear in console

### Day 3: Settings System Safety Improvements

#### Task 3.1: Add localStorage Error Handling
**File:** `settings.js`
**Objective:** Prevent crashes when localStorage is full or unavailable
**Exact Change:**

```javascript
------- SEARCH
export function saveSettings(settings) {
    currentSettings = { ...settings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
}
=======
export function saveSettings(settings) {
    currentSettings = { ...settings };
    
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
    } catch (storageError) {
        // Graceful degradation: log error but continue with in-memory settings
        console.warn('[SETTINGS] Failed to save to localStorage:', storageError);
        // Continue with in-memory settings only
    }
}
+++++++ REPLACE
```

#### Task 3.2: Add Null Checks to loadSettings
**File:** `settings.js`
**Objective:** Handle corrupted localStorage data gracefully
**Exact Change:**

```javascript
------- SEARCH
export function loadSettings() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            // Merge defaults with parsed to handle missing keys in old versions
            currentSettings = { ...defaultSettings, ...parsed };
            
            // Migration: legacy 'upscale' -> 'upscaleFactor'
            if ('upscale' in parsed && !('upscaleFactor' in parsed)) {
                currentSettings.upscaleFactor = parsed.upscale;
            }
        }
    } catch (err) {
        console.warn('Failed to load settings, using defaults:', err);
        currentSettings = { ...defaultSettings };
    }
    return currentSettings;
}
=======
export function loadSettings() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored);
            
            // Safety check: ensure parsed is an object
            if (typeof parsed !== 'object' || parsed === null) {
                console.warn('[SETTINGS] Invalid settings format, using defaults');
                currentSettings = { ...defaultSettings };
                return currentSettings;
            }
            
            // Merge defaults with parsed to handle missing keys in old versions
            currentSettings = { ...defaultSettings, ...parsed };
            
            // Migration: legacy 'upscale' -> 'upscaleFactor'
            if ('upscale' in parsed && !('upscaleFactor' in parsed)) {
                currentSettings.upscaleFactor = parsed.upscale;
            }
        }
    } catch (err) {
        console.warn('[SETTINGS] Failed to load settings, using defaults:', err);
        currentSettings = { ...defaultSettings };
    }
    
    // Final safety: ensure all required keys exist
    currentSettings = { ...defaultSettings, ...currentSettings };
    return currentSettings;
}
+++++++ REPLACE
```

**Testing Instructions:**
1. Test settings persistence after making changes
2. Simulate localStorage failure (use browser devtools to disable storage)
3. Verify settings UI still works when localStorage fails

### Day 4: UI Controller Safety Improvements

#### Task 4.1: Add DOM Element Null Checks
**File:** `js/ui/ui_controller.js`
**Objective:** Prevent crashes when DOM elements are missing
**Exact Change:**

```javascript
------- SEARCH
function setOCRStatus(state, text, progress = null, sourceId = null) {
    // 1. Internal EngineManager Sync
    // Only forward UI-originated status updates (no explicit sourceId).
    // Engine-originated updates already come through EngineManager.onStatusChange;
    // rebroadcasting them here causes status loops and can relabel source engines.
    if (sourceId == null && window.EngineManager && typeof window.EngineManager._notifyStatus === 'function') {
        window.EngineManager._notifyStatus(state, text, progress);
    }

    const ocrStatus = document.getElementById('ocr-status');
    const statusLabel = document.getElementById('status-text');
    if (!ocrStatus || !statusLabel) return;
=======
function setOCRStatus(state, text, progress = null, sourceId = null) {
    // Safety check: validate inputs
    if (!state || typeof state !== 'string') {
        console.warn('[UI] Invalid status state:', state);
        return;
    }
    
    // 1. Internal EngineManager Sync
    // Only forward UI-originated status updates (no explicit sourceId).
    // Engine-originated updates already come through EngineManager.onStatusChange;
    // rebroadcasting them here causes status loops and can relabel source engines.
    if (sourceId == null && window.EngineManager && typeof window.EngineManager._notifyStatus === 'function') {
        window.EngineManager._notifyStatus(state, text, progress);
    }

    const ocrStatus = document.getElementById('ocr-status');
    const statusLabel = document.getElementById('status-text');
    
    // Safety check: ensure DOM elements exist
    if (!ocrStatus || !statusLabel) {
        console.warn('[UI] Status DOM elements not found');
        return;
    }
+++++++ REPLACE
```

#### Task 4.2: Add Timer Cleanup
**File:** `js/ui/ui_controller.js`
**Objective:** Prevent memory leaks from uncleared timers
**Exact Change:**

```javascript
------- SEARCH
// ==========================================
// Progress Pill v2: Unified State Machine (Gold v3.8)
// ==========================================
let statusSettleTimer = null;
=======
// ==========================================
// Progress Pill v2: Unified State Machine (Gold v3.8)
// ==========================================
let statusSettleTimer = null;

// Cleanup function for timers and event listeners
function cleanupUIResources() {
    if (statusSettleTimer) {
        clearTimeout(statusSettleTimer);
        statusSettleTimer = null;
    }
}

// Register cleanup on page unload
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', cleanupUIResources);
    window.addEventListener('pagehide', cleanupUIResources);
}
+++++++ REPLACE
```

**Testing Instructions:**
1. Test status updates in the UI
2. Verify no console errors when elements are missing
3. Check that page navigation doesn't leave hanging timers

### Day 5: Engine-Specific Safety Improvements

#### Task 5.1: Tesseract Engine Error Handling
**File:** `js/tesseract/tesseract_engine.js`
**Objective:** Add error handling to asset checking
**Exact Change:**

```javascript
------- SEARCH
    async checkAssets() {
        const localAssets = [
            './js/tesseract/worker.min.js',
            './js/tesseract/core/tesseract-core-simd-lstm.wasm.js',
            './js/tesseract/core/tesseract-core-simd-lstm.wasm'
        ];
        const remoteAssets = [
            'https://pub-77a4ba72da6d4b9e892b6511ae694813.r2.dev/tesseract/jpn.traineddata'
        ];
        
        try {
            const [localResults, remoteResults] = await Promise.all([
                Promise.all(localAssets.map(url => fetch(url, { method: 'HEAD' }))),
                Promise.all(remoteAssets.map(url => fetch(url, { method: 'HEAD' })))
            ]);
            
            const allFound = [...localResults, ...remoteResults].every(res => res.ok);
            
            const diagAssets = document.getElementById('diag-assets');
            if (diagAssets) {
                diagAssets.textContent = allFound ? '✅ FOUND' : '❌ MISSING';
                diagAssets.className = allFound ? 'diag-status-ok' : 'diag-status-fail';
            }
            return allFound;
        } catch (err) {
            console.warn("Tesseract: Hybrid asset check failed:", err);
            return false;
        }
    }
=======
    async checkAssets() {
        const localAssets = [
            './js/tesseract/worker.min.js',
            './js/tesseract/core/tesseract-core-simd-lstm.wasm.js',
            './js/tesseract/core/tesseract-core-simd-lstm.wasm'
        ];
        const remoteAssets = [
            'https://pub-77a4ba72da6d4b9e892b6511ae694813.r2.dev/tesseract/jpn.traineddata'
        ];
        
        try {
            const [localResults, remoteResults] = await Promise.all([
                Promise.all(localAssets.map(url => this.safeFetch(url, { method: 'HEAD' }))),
                Promise.all(remoteAssets.map(url => this.safeFetch(url, { method: 'HEAD' })))
            ]);
            
            const allFound = [...localResults, ...remoteResults].every(res => res && res.ok);
            
            const diagAssets = document.getElementById('diag-assets');
            if (diagAssets) {
                diagAssets.textContent = allFound ? '✅ FOUND' : '❌ MISSING';
                diagAssets.className = allFound ? 'diag-status-ok' : 'diag-status-fail';
            }
            return allFound;
        } catch (err) {
            console.warn("[TESSERACT] Hybrid asset check failed:", err);
            return false;
        }
    }
    
    // Safe fetch helper with timeout and error handling
    async safeFetch(url, options = {}) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
            
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            return response;
        } catch (fetchErr) {
            console.warn(`[TESSERACT] Failed to fetch ${url}:`, fetchErr);
            return { ok: false };
        }
    }
+++++++ REPLACE
```

**Testing Instructions:**
1. Test Tesseract engine loading
2. Verify asset checking still works
3. Check error messages are clear if assets are missing

## Phase 2: Conservative Bug Fixes (Week 2)

### Day 6-7: Memory Leak Prevention

#### Task 6.1: Improve Canvas Cleanup
**File:** `js/core/capture_pipeline.js`
**Objective:** Ensure canvases are properly cleaned up
**Look for canvas cleanup code and ensure all canvases are cleaned:**

Search for all occurrences of canvas cleanup and standardize:

```javascript
// Standardize canvas cleanup pattern
function safeCanvasCleanup(canvas) {
    if (canvas && canvas.width > 0 && canvas.height > 0) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        canvas.width = 0;
        canvas.height = 0;
    }
}

// Replace all canvas cleanup with this pattern
```

#### Task 6.2: Add Engine Disposal Methods
**File:** `js/core/engine_manager.js`
**Objective:** Ensure engines can be properly disposed
**Add to evictOtherEngines function:**

```javascript
------- SEARCH
            if (meta.instance) {
                try {
                    meta.instance.dispose?.();
                } catch (e) {
                    console.warn(`[ENGINE] dispose failed for ${id}`, e);
                }
            }
=======
            if (meta.instance) {
                try {
                    // Try standard disposal method
                    if (typeof meta.instance.dispose === 'function') {
                        await meta.instance.dispose();
                    }
                    // Clear references
                    meta.instance = null;
                    meta.loadPromise = null;
                } catch (e) {
                    console.warn(`[ENGINE] dispose failed for ${id}`, e);
                }
            }
+++++++ REPLACE
```

### Day 8-10: Testing and Validation

#### Testing Protocol for Each Change:
1. **Manual Testing**: Test the specific functionality affected
2. **Regression Testing**: Ensure existing functionality still works
3. **Error Simulation**: Test error conditions if possible
4. **Console Monitoring**: Check for new warnings or errors

#### Validation Checklist:
- [ ] Application starts without errors
- [ ] All three OCR engines load correctly
- [ ] Capture functionality works (manual and auto)
- [ ] Settings are saved and loaded correctly
- [ ] UI status updates work properly
- [ ] No new console errors appear
- [ ] Memory usage doesn't increase over time

## Execution Instructions for AI

### For Each Task:
1. **Read the file** to understand context
2. **Apply the exact SEARCH/REPLACE** pattern provided
3. **Test the change** using the testing instructions
4. **Document results** in this guide (add checkboxes)
5. **Proceed to next task** only if current task passes testing

### Safety Rules:
1. **Don't change behavior** - Only add safety nets
2. **Preserve existing patterns** - Match code style
3. **Test thoroughly** - Each change must be validated
4. **Rollback if needed** - Keep backups of original files

## Monitoring and Rollback

### Monitoring After Deployment:
1. Watch for increased error rates
2. Monitor memory usage patterns
3. Check user-reported issues
4. Review console logs for new warnings

### Rollback Procedure:
1. Revert to original file versions
2. Test that rollback doesn't break anything
3. Document what was rolled back and why
4. Analyze failure before retrying

## Conclusion

This guide provides minimal, safe changes that improve robustness without breaking existing functionality. By following these exact instructions, an AI can safely implement defensive programming improvements that will make the personalOCR application more resilient to edge cases and errors.