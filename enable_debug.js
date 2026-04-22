// Script to enable debug mode for auto-capture debugging
(function() {
    console.log('Enabling debug mode for auto-capture debugging...');
    
    // Get current settings
    const STORAGE_KEY = "vnocr_settings";
    const defaultSettings = {
        ocrEngine: "tesseract",
        ocrMode: "default_mini",
        autoCapture: true,
        autoCopy: true,
        showHeavyWarning: true,
        showMangaWarning: true,
        theme: "auto",
        historyVisible: true,
        previewVisible: false,
        debug: false,
        paddleLineCount: 3,
        textAreaSize: "standard",
        textSize: "standard",
        upscaleFactor: 2.0,
        skipPreloading: false
    };
    
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        let currentSettings = { ...defaultSettings };
        
        if (stored) {
            currentSettings = { ...defaultSettings, ...JSON.parse(stored) };
        }
        
        // Enable debug mode
        currentSettings.debug = true;
        
        // Save back to localStorage
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
        
        console.log('Debug mode enabled! Settings saved:', currentSettings);
        console.log('Refresh the page for changes to take effect.');
        
        // Also log current auto-capture state
        console.log('Current autoCapture setting:', currentSettings.autoCapture);
        
    } catch (e) {
        console.error('Failed to enable debug mode:', e);
    }
})();