export async function isWebGPUSupported() {
    const isIsolated = self.crossOriginIsolated;
    
    // Check hardware support natively
    let hasHardwareSupport = false;
    try {
        if (navigator.gpu) {
            const adapter = await navigator.gpu.requestAdapter();
            if (adapter) {
                hasHardwareSupport = true;
            }
        }
    } catch (e) {
        hasHardwareSupport = false;
    }
    
    console.log(`[ENGINE] Hardware Support — isolated: ${isIsolated}, webgpu API natively available: ${hasHardwareSupport}`);

    return hasHardwareSupport;
}
