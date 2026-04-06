import { useEffect, useRef, useState } from 'react';
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision';

const MEDIAPIPE_VERSION = '0.10.21';
const WASM_ROOT_CANDIDATES = [
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`,
  `https://unpkg.com/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`,
];
const MODEL_ASSET_URL = 'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';
const INIT_TIMEOUT_MS = 15000;

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
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export function useFaceDetector() {
  const detectorRef = useRef(null);
  const [detector, setDetector] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setError(null);
        setReady(false);

        let instance = null;
        const initErrors = [];

        for (const wasmRoot of WASM_ROOT_CANDIDATES) {
          try {
            const vision = await withTimeout(
              FilesetResolver.forVisionTasks(wasmRoot),
              `Timed out loading MediaPipe runtime files from ${wasmRoot}.`
            );

            instance = await withTimeout(FaceDetector.createFromOptions(vision, {
              baseOptions: {
                modelAssetPath: MODEL_ASSET_URL,
              },
              runningMode: 'VIDEO',
              minDetectionConfidence: 0.5,
              minSuppressionThreshold: 0.3,
            }), `Timed out initializing the face detector model using ${wasmRoot}.`);

            break;
          } catch (candidateError) {
            const message = candidateError instanceof Error ? candidateError.message : String(candidateError);
            initErrors.push(`[${wasmRoot}] ${message}`);
          }
        }

        if (!instance) {
          throw new Error(`Face detector init failed. ${initErrors.join(' | ')}`);
        }

        if (cancelled) {
          instance.close();
          return;
        }
        detectorRef.current = instance;
        setDetector(instance);
        setReady(true);
      } catch (initError) {
        if (!cancelled) {
          const message = initError instanceof Error ? initError.message : 'Failed to initialize face detector.';
          console.error('[useFaceDetector] Initialization failed:', initError);
          setError(new Error(message));
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (detectorRef.current) {
        detectorRef.current.close();
        detectorRef.current = null;
      }
    };
  }, [reloadToken]);

  function closeDetector() {
    if (detectorRef.current) {
      detectorRef.current.close();
      detectorRef.current = null;
      setDetector(null);
      setReady(false);
    }
  }

  function retryDetector() {
    closeDetector();
    setError(null);
    setReloadToken((value) => value + 1);
  }

  return { detector, ready, error, closeDetector, retryDetector };
}
