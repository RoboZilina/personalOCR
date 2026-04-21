# PersonalOCR Defensive Implementation Plan (Phased)

**Goal:** Apply minimal, reversible, defensive fixes to harden the application without altering core functionality. Each phase is designed to be interruptible; manual testing can be performed after each phase.

**Principles:**
1. **Exact Changes Only** – Use SEARCH/REPLACE patterns with precise line matching.
2. **Minimal Surface Area** – Each change is as small as possible.
3. **Preserve Behavior** – Add safety nets, do not change existing logic.
4. **Test After Each Phase** – Verify the application still works as expected.

---

## Phase 1: Critical Engine & Capture Pipeline Fixes
*(Already documented in `bug_fix_plan.md` and `ai_implementation_guide.md`)*

**Objective:** Fix race conditions and memory leaks that could cause crashes or UI ghosting.

### Task 1.1 – Engine‑Switching Race Condition
**File:** `js/core/engine_manager.js`  
**Reference:** `bug_fix_plan.md` section “1. Engine Management Issues”, Fix 1.  
**Change:** Move `currentEngineId = id` after successful load, ensure `switchingLock` is released in all error paths.

**Exact SEARCH/REPLACE block (from `ai_implementation_guide.md` Day 1, Task 1.1):**
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
++++++ REPLACE
```

### Task 1.2 – Memory Leak in Engine Eviction
**File:** `js/core/engine_manager.js`  
**Reference:** `bug_fix_plan.md` Fix 2.  
**Change:** Clear `meta.instance = null` after disposal.

**Exact SEARCH/REPLACE block (from `bug_fix_plan.md` lines 55–71):**
```javascript
------- SEARCH
function evictOtherEngines(activeId) {
    const KEEP_CACHED = new Set(['paddle', 'tesseract']);
    for (const [id, meta] of engineMetadata.entries()) {
        if (id === activeId || KEEP_CACHED.has(id)) continue;
        
        if (meta.instance) {
            try {
                meta.instance.dispose?.();
            } catch (e) {
                console.warn(`[ENGINE] dispose failed for ${id}`, e);
            }
        }
        engineMetadata.delete(id);
    }
}
=======
function evictOtherEngines(activeId) {
    const KEEP_CACHED = new Set(['paddle', 'tesseract']);
    for (const [id, meta] of engineMetadata.entries()) {
        if (id === activeId || KEEP_CACHED.has(id)) continue;
        
        if (meta.instance) {
            try {
                meta.instance.dispose?.();
                meta.instance = null; // Clear reference
            } catch (e) {
                console.warn(`[ENGINE] dispose failed for ${id}`, e);
            }
        }
        engineMetadata.delete(id);
    }
}
++++++ REPLACE
```

### Task 1.3 – Generation‑Check Race in Capture Pipeline
**File:** `js/core/capture_pipeline.js`  
**Reference:** `bug_fix_plan.md` section “2. Capture Pipeline Issues”, Fix 1.  
**Change:** Move generation check before the first OCR pass in the multi‑pass Tesseract branch.

**Exact SEARCH/REPLACE block (from `bug_fix_plan.md` lines 84–98):**
```javascript
------- SEARCH
    const myGen = ++window.captureGeneration;
    let lockReleased = false;
    
    // Helper to release lock safely
    const releaseLock = () => {
        if (!lockReleased) {
            window.isProcessing = false;
            lockReleased = true;
        }
    };
    
    window.isProcessing = true;
    
    // Engine Pinning: Lock current instance and ID to ensure consistency throughout the slice cycle
    const pinnedEngine = window.EngineManager.getEngineInstance();
    const pinnedInfo = window.EngineManager.getInfo() || { id: null, capabilities: {} };
    const pinnedCaps = pinnedInfo.capabilities || {};
    const pinnedId = pinnedInfo.id || null;
    
    window.logTrace(`Capture started. Gen: ${myGen} | Engine: ${pinnedId}`);

    const vWidth = window.vnVideo.videoWidth, vHeight = window.vnVideo.videoHeight;
    const activeRect = rect || window.selectionRect || window.lastValidSelectionRect;
    if (!activeRect) {
        releaseLock();
        return;
    }
    const sel = window.denormalizeSelection(activeRect, window.vnVideo, window.selectionOverlay);
    if (!sel) {
        releaseLock();
        return;
    }
    const cx_ = Math.max(0, Math.floor(sel.x)), cy_ = Math.max(0, Math.floor(sel.y));
    const cw_ = Math.max(1, Math.min(vWidth - cx_, Math.floor(sel.w))), ch_ = Math.max(1, Math.min(vHeight - cy_, Math.floor(sel.h)));

    const rawCropCanvas = document.createElement('canvas');
    rawCropCanvas.width = cw_; rawCropCanvas.height = ch_;
    rawCropCanvas.getContext('2d').drawImage(window.vnVideo, cx_, cy_, cw_, ch_, 0, 0, cw_, ch_);

    window.EngineManager._notifyStatus(window.STATUS.PROCESSING, '🟡 Processing...', null, pinnedId);
    await new Promise(r => setTimeout(r, 0)); // yield to browser for repaint
    
    const mode = window.modeSelector?.value || 'default_mini';
    
    try {
        // Tesseract Multi-Pass Branch
        if (pinnedId === 'tesseract' && mode === 'multi') {
            const preStart = performance.now();
            const canvases = window.applyTesseractPreprocessing(rawCropCanvas, mode);
            if (window.perfStats) window.perfStats.preprocess = performance.now() - preStart;
            const results = [];

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
    const myGen = ++window.captureGeneration;
    let lockReleased = false;
    
    // Helper to release lock safely
    const releaseLock = () => {
        if (!lockReleased) {
            window.isProcessing = false;
            lockReleased = true;
        }
    };
    
    window.isProcessing = true;
    
    // Check generation before any processing
    if (window.captureGeneration !== myGen) {
        releaseLock();
        return;
    }
    
    // Engine Pinning: Lock current instance and ID to ensure consistency throughout the slice cycle
    const pinnedEngine = window.EngineManager.getEngineInstance();
    const pinnedInfo = window.EngineManager.getInfo() || { id: null, capabilities: {} };
    const pinnedCaps = pinnedInfo.capabilities || {};
    const pinnedId = pinnedInfo.id || null;
    
    window.logTrace(`Capture started. Gen: ${myGen} | Engine: ${pinnedId}`);

    const vWidth = window.vnVideo.videoWidth, vHeight = window.vnVideo.videoHeight;
    const activeRect = rect || window.selectionRect || window.lastValidSelectionRect;
    if (!activeRect) {
        releaseLock();
        return;
    }
    const sel = window.denormalizeSelection(activeRect, window.vnVideo, window.selectionOverlay);
    if (!sel) {
        releaseLock();
        return;
    }
    const cx_ = Math.max(0, Math.floor(sel.x)), cy_ = Math.max(0, Math.floor(sel.y));
    const cw_ = Math.max(1, Math.min(vWidth - cx_, Math.floor(sel.w))), ch_ = Math.max(1, Math.min(vHeight - cy_, Math.floor(sel.h)));

    const rawCropCanvas = document.createElement('canvas');
    rawCropCanvas.width = cw_; rawCropCanvas.height = ch_;
    rawCropCanvas.getContext('2d').drawImage(window.vnVideo, cx_, cy_, cw_, ch_, 0, 0, cw_, ch_);

    window.EngineManager._notifyStatus(window.STATUS.PROCESSING, '🟡 Processing...', null, pinnedId);
    await new Promise(r => setTimeout(r, 0)); // yield to browser for repaint
    
    const mode = window.modeSelector?.value || 'default_mini';
    
    try {
        // Tesseract Multi-Pass Branch
        if (pinnedId === 'tesseract' && mode === 'multi') {
            const preStart = performance.now();
            const canvases = window.applyTesseractPreprocessing(rawCropCanvas, mode);
            if (window.perfStats) window.perfStats.preprocess = performance.now() - preStart;
            const results = [];

            // Generation Check before first OCR pass
            if (window.captureGeneration !== myGen) {
                canvases.forEach(c => { c.width = 0; c.height = 0; });
                releaseLock();
                return;
            }

            // 1. First Pass: Early exit if result is highly confident and clean
            const infStart = performance.now();
            const first = await window.EngineManager.runOCR(canvases[0], { engineInstance: pinnedEngine });
++++++ REPLACE
```

**Testing after Phase 1:**
1. Start the application and verify the splash screen disappears.
2. Switch engines (Tesseract ↔ Paddle ↔ Manga) rapidly; ensure no UI lock‑up.
3. Perform a capture with multi‑pass mode; verify no “ghost” captures.
4. Check console for any new errors.

---

## Phase 2: Service‑Worker Reliability
**Objective:** Prevent runtime exceptions and cache mismatches.

### Task 2.1 – Ensure Fetch Handler Always Returns a Response
**File:** `service‑worker.js`  
**Issue:** The catch block may return `null`, causing a `TypeError`.  
**Change:** Return a plain‑text offline response instead of `null`.

**Exact SEARCH/REPLACE block:**
```javascript
------- SEARCH
      }).catch(async () => {
        // Network failed: try to find any cached version
        const fallbackMatch = await caches.match(event.request);
        if (fallbackMatch) {
          return fallbackMatch;
        }
        // Return a minimal offline response for navigation requests
        if (event.request.mode === 'navigate') {
          return new Response('Offline - App not cached', { 
            status: 503, 
            headers: { 'Content-Type': 'text/plain' } 
          });
        }
        return null;
      });
=======
      }).catch(async () => {
        // Network failed: try to find any cached version
        const fallbackMatch = await caches.match(event.request);
        if (fallbackMatch) {
          return fallbackMatch;
        }
        // Return a minimal offline response for navigation requests
        if (event.request.mode === 'navigate') {
          return new Response('Offline - App not cached', { 
            status: 503, 
            headers: { 'Content-Type': 'text/plain' } 
          });
        }
        // Return a generic error response for any other request (avoid null)
        return new Response('Network error', {
          status: 408,
          headers: { 'Content-Type': 'text/plain' }
        });
      });
++++++ REPLACE
```

### Task 2.2 – Fix Cache‑Integrity Mismatch
**File:** `service‑worker.js`  
**Issue:** Integrity check compares normalized paths (without query strings) against cached keys that include query strings, causing false warnings.  
**Change:** Strip query strings from `ASSETS` before `cache.addAll`, or normalize both sides identically.

**Simpler fix:** Modify the integrity check to compare normalized URLs consistently.

**Exact SEARCH/REPLACE block (lines 77‑90):**
```javascript
------- SEARCH
        .then(({ cache, keys }) => {
          // Integrity check: verify cached keys match normalized assets
          const cachedPaths = keys.map(r => new URL(r.url).pathname);
          const missing = NORMALIZED_ASSETS.filter(a => a !== '/' && !cachedPaths.includes(a));
          const extra = cachedPaths.filter(c => c !== '/' && !NORMALIZED_ASSETS.includes(c));
          if (missing.length > 0) {
            console.warn('[SW:INSTALL] Cache mismatch - missing assets:', missing);
            // Auto-heal: re-populate missing assets
            console.log('[SW:INSTALL] Auto-healing cache with missing assets...');
            return cache.addAll(missing);
          }
          if (extra.length > 0) {
            console.warn('[SW:INSTALL] Cache mismatch - unexpected extra assets:', extra);
          }
        })
=======
        .then(({ cache, keys }) => {
          // Integrity check: compare normalized paths (ignore query strings)
          const cachedPaths = keys.map(r => normalizeUrl(r.url));
          const missing = NORMALIZED_ASSETS.filter(a => a !== '/' && !cachedPaths.includes(a));
          const extra = cachedPaths.filter(c => c !== '/' && !NORMALIZED_ASSETS.includes(c));
          if (missing.length > 0) {
            console.warn('[SW:INSTALL] Cache mismatch - missing assets:', missing);
            // Auto-heal: re-populate missing assets (with original query strings)
            console.log('[SW:INSTALL] Auto-healing cache with missing assets...');
            return cache.addAll(ASSETS.filter(a => missing.includes(normalizeUrl(a))));
          }
          if (extra.length > 0) {
            console.warn('[SW:INSTALL] Cache mismatch - unexpected extra assets:', extra);
          }
        })
++++++ REPLACE
```

**Testing after Phase 2:**
1. Unregister any existing service worker, reload the page, and verify the new worker installs without console warnings about missing assets.
2. Go offline and attempt to reload the app; verify you see the offline message instead of a blank page or console error.
3. Check that OCR engines still load correctly (they fetch models from remote R2, which should not be intercepted).

---

## Phase 3: UI Resilience
**Objective:** Prevent UI staleness and minor memory leaks.

### Task 3.1 – Improve Status‑Settle Timer Logic
**File:** `js/ui/ui_controller.js`  
**Issue:** READY status updates are dropped while a settle timer is pending, potentially leaving the UI stale.  
**Change:** Reset the timer with the new status text instead of dropping the update.

**Exact SEARCH/REPLACE block:**
```javascript
------- SEARCH
    // 3. Settle Logic: Prevent rapid-fire READY flickers
    if (state === STATUS.READY) {
        if (statusSettleTimer) return; // Wait for the existing timer
        statusSettleTimer = setTimeout(() => {
            applyStatusStage(STATUS.READY, text || window.EngineManager.getReadyStatus(), null);
            statusSettleTimer = null;
        }, 120); // 120ms "Settle" window for absolute stability
        return;
    }
=======
    // 3. Settle Logic: Prevent rapid-fire READY flickers
    if (state === STATUS.READY) {
        if (statusSettleTimer) {
            clearTimeout(statusSettleTimer); // Cancel pending timer
        }
        statusSettleTimer = setTimeout(() => {
            applyStatusStage(STATUS.READY, text || window.EngineManager.getReadyStatus(), null);
            statusSettleTimer = null;
        }, 120); // 120ms "Settle" window for absolute stability
        return;
    }
++++++ REPLACE
```

### Task 3.2 – Clean Up Timer on Page Unload
**File:** `js/ui/ui_controller.js`  
**Issue:** The settle timer may fire after the page has been unloaded (minor memory leak).  
**Change:** Add an event listener to clear the timer.

**Note:** This change is additive, not a replacement. Add the following line after the `statusSettleTimer` declaration (around line 13).

**Exact SEARCH/REPLACE block:**
```javascript
------- SEARCH
let statusSettleTimer = null;
=======
let statusSettleTimer = null;
// Clean up timer on page unload to prevent memory leaks
window.addEventListener('beforeunload', () => {
    if (statusSettleTimer) clearTimeout(statusSettleTimer);
});
++++++ REPLACE
```

**Testing after Phase 3:**
1. Trigger multiple rapid engine switches; verify the status pill always reflects the correct final state.
2. Navigate away from the app (or close the tab) while a status update is pending; ensure no console errors.

---

## Phase 4: Settings & Configuration
**Objective:** Align UI controls with stored settings.

### Task 4.1 – Fix Checkbox ID Inconsistency
**File:** `settings.js`  
**Issue:** `applyUIToSettings` looks for `#heavy‑warning‑checkbox` while the UI uses `#banner‑nocall‑checkbox`.  
**Change:** Update the selector to match the actual element ID.

**Exact SEARCH/REPLACE block:**
```javascript
------- SEARCH
    const warningCheckbox = document.querySelector("#heavy-warning-checkbox");
    if (warningCheckbox) currentSettings.showHeavyWarning = !warningCheckbox.checked;
=======
    const warningCheckbox = document.querySelector("#banner-nocall-checkbox");
    if (warningCheckbox) currentSettings.showHeavyWarning = !warningCheckbox.checked;
++++++ REPLACE
```

**Testing after Phase 4:**
1. Toggle the “Don't show again” checkbox in the PaddleOCR startup banner, refresh the page, and verify the setting persists.
2. Check that the banner appears/hides according to the saved preference.

---

## Phase 5: Engine‑Specific Safety Nets
**Objective:** Add defensive guards to engine loading and preprocessing.

### Task 5.1 – Clear Paddle Engine `loadPromise` on Failure
**File:** `js/paddle/paddle_engine.js`  
**Issue:** If `loadModels` fails, `loadPromise` remains populated, causing subsequent load attempts to hang.  
**Change:** Ensure `loadPromise` is cleared in the catch block.

**Exact SEARCH/REPLACE block (locate the `load` method around line 89):**
```javascript
------- SEARCH
        this.loadPromise = (async () => {
            await this.loadModels();
            this.isLoaded = true;
            return this;
        })();

        return this.loadPromise;
=======
        this.loadPromise = (async () => {
            try {
                await this.loadModels();
                this.isLoaded = true;
                return this;
            } catch (err) {
                this.loadPromise = null; // Clear promise on failure
                throw err;
            }
        })();

        return this.loadPromise;
++++++ REPLACE
```

### Task 5.2 – Guard Against Empty Canvas Array in `preprocessForEngine`
**File:** `js/core/capture_pipeline.js`  
**Issue:** `preprocessForEngine` could return an empty array; callers assume at least one canvas.  
**Change:** Add a fallback that returns a cloned raw canvas.

**Exact SEARCH/REPLACE block (lines 285‑292):**
```javascript
------- SEARCH
    // Final Fallback: Clone raw canvas to prevent pipeline from destroying original
    if (window.VNOCR_DEBUG) console.debug("[ENGINE] No preprocess available, returning cloned canvas");
    const cloned = document.createElement('canvas');
    cloned.width = rawCanvas.width;
    cloned.height = rawCanvas.height;
    cloned.getContext('2d').drawImage(rawCanvas, 0, 0);
    return [cloned];
=======
    // Final Fallback: Clone raw canvas to prevent pipeline from destroying original
    if (window.VNOCR_DEBUG) console.debug("[ENGINE] No preprocess available, returning cloned canvas");
    const cloned = document.createElement('canvas');
    cloned.width = rawCanvas.width;
    cloned.height = rawCanvas.height;
    cloned.getContext('2d').drawImage(rawCanvas, 0, 0);
    return [cloned];
    // Ensure we never return an empty array
++++++ REPLACE
```
*(Note: The change is minimal—just a comment addition. The existing fallback already returns a single canvas, so the risk is low. This task is mostly a documentation update.)*

**Testing after Phase 5:**
1. Force a Paddle engine load failure (e.g., by temporarily disabling network) and verify the engine does not get stuck in a “loading” state.
2. Trigger OCR with a corrupted engine ID (if possible) and ensure the UI degrades gracefully.

---

## Final Verification
After all phases are complete, run the built‑in audit suite:
```bash
npm run audit:static
npm run audit
```
Ensure no new warnings appear. Then manually test the core OCR workflow with each engine to confirm stability.

## Interruption Points
Each phase is independent and can be paused for manual testing. After a phase is applied, the application should remain fully functional; if any regression is observed, revert the changes of that phase before proceeding.

---

*This plan is designed for an AI assistant to execute step‑by‑step. All changes are minimal, reversible, and focused on defensive hardening.*