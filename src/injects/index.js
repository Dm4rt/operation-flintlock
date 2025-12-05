/**
 * Inject Handler Registry
 * 
 * Maps inject type IDs to their handler functions.
 * Each handler receives the inject payload and returns execution result.
 */

// SDA Injects
import satelliteDropout from './sda/satelliteDropout';
import unknownSatellite from './sda/unknownSatellite';

// Cyber Injects
import virusDetected from './cyber/virusDetected';
import enemyWebsite from './cyber/enemyWebsite';

// Intel Injects
import asatImagery from './intel/asatImagery';
import crypticTweet from './intel/crypticTweet';

// EW Injects
import unidentifiedSignal from './ew/unidentifiedSignal';
import spectrumOutage from './ew/spectrumOutage';

export const INJECT_HANDLERS = {
  // SDA
  'satellite-dropout': satelliteDropout,
  'unknown-satellite': unknownSatellite,
  
  // Cyber
  'virus-detected': virusDetected,
  'enemy-website': enemyWebsite,
  
  // Intel
  'asat-imagery': asatImagery,
  'cryptic-tweet': crypticTweet,
  
  // EW
  'unidentified-signal': unidentifiedSignal,
  'spectrum-outage': spectrumOutage
};

/**
 * Execute an inject by its type ID
 * @param {string} type - The inject type ID (e.g., 'satellite-dropout')
 * @param {object} payload - Additional data for the inject
 * @returns {object} Result object with success status and message
 */
export function executeInject(type, payload = {}) {
  const handler = INJECT_HANDLERS[type];
  
  if (!handler) {
    console.error(`[Inject] Unknown inject type: ${type}`);
    return {
      success: false,
      message: `Unknown inject type: ${type}`
    };
  }
  
  try {
    console.log(`[Inject] Executing: ${type}`);
    const result = handler(payload);
    return result;
  } catch (error) {
    console.error(`[Inject] Error executing ${type}:`, error);
    return {
      success: false,
      message: error.message
    };
  }
}

export default executeInject;
