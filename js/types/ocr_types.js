/**
 * @typedef {Object} OCREngine
 * @property {() => Promise<void>} load
 * @property {(canvas: HTMLCanvasElement, options?: any) => Promise<any>} recognize
 * @property {() => void} dispose
 * @property {() => boolean} isLoaded
 */

/**
 * @typedef {Object} EngineMetadata
 * @property {'loading'|'ready'|'error'|'unloaded'} state
 * @property {OCREngine|null} instance
 * @property {Promise<void>|null} loadPromise
 */

/**
 * @typedef {Object} CaptureResult
 * @property {string} text
 * @property {number} durationMs
 * @property {HTMLCanvasElement|null} processedCanvas
 */
