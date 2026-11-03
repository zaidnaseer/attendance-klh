import { useEffect, useRef, useState } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// Same pinned runtime + CDN fallbacks as useFaceDetector, so both load the same WASM build.
const MEDIAPIPE_VERSION = '0.10.21';
const WASM_ROOT_CANDIDATES = [
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`,
  `https://unpkg.com/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`,
];
const MODEL_ASSET_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const INIT_TIMEOUT_MS = 20000;

async function withTimeout(promise, timeoutMessage) {
  let timeoutId;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), INIT_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

// Loads MediaPipe Face Landmarker (478 landmarks + blendshape scores) for gesture liveness.
export function useFaceLandmarker() {
  const landmarkerRef = useRef(null);
  const [landmarker, setLandmarker] = useState(null);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      setError(null);
      const initErrors = [];
      let instance = null;

      for (const wasmRoot of WASM_ROOT_CANDIDATES) {
        try {
          const vision = await withTimeout(
            FilesetResolver.forVisionTasks(wasmRoot),
            `Timed out loading MediaPipe runtime files from ${wasmRoot}.`,
          );
          instance = await withTimeout(FaceLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: MODEL_ASSET_URL },
            runningMode: 'VIDEO',
            numFaces: 2, // 2 so a second person in frame is detected, not silently ignored
            outputFaceBlendshapes: true,
            minFaceDetectionConfidence: 0.5,
            minFacePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5,
          }), `Timed out initializing the face landmarker using ${wasmRoot}.`);
          break;
        } catch (candidateError) {
          const message = candidateError instanceof Error ? candidateError.message : String(candidateError);
          initErrors.push(`[${wasmRoot}] ${message}`);
        }
      }

      if (cancelled) {
        instance?.close();
        return;
      }
      if (!instance) {
        console.error('[useFaceLandmarker] Initialization failed:', initErrors);
        setError(new Error(`Face landmarker init failed. ${initErrors.join(' | ')}`));
        return;
      }
      landmarkerRef.current = instance;
      setLandmarker(instance);
    }

    init();

    return () => {
      cancelled = true;
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
      setLandmarker(null);
    };
  }, [reloadToken]);

  function retry() {
    setReloadToken((value) => value + 1);
  }

  return { landmarker, ready: Boolean(landmarker), error, retry };
}
