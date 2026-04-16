/**
 * js/core/status.js
 * Canonical STATUS constants for all OCR engines.
 * Prevents string drift and ensures consistent state representation across modules.
 */

export const STATUS = {
    IDLE: 'idle',
    PRE_LOADING: 'pre-loading',
    DOWNLOADING: 'downloading',
    LOADING: 'loading',
    WARMING: 'warming-up',
    READY: 'ready',
    PROCESSING: 'processing',
    ERROR: 'error'
};

// Default export for convenience
export default STATUS;
