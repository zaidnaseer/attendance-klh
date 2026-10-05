import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { verifyStudent } from '../lib/api';
import styles from './VerifyCameraView.module.css';

function mapVerifyError(error) {
    const code = error?.data?.code;
    if (code === 'FACE_NOT_DETECTED') {
        return 'No face detected. Center your face and try again.';
    }
    if (code === 'MULTIPLE_FACES') {
        return 'Multiple faces detected. Ensure only your face is visible.';
    }
    if (code === 'SPOOF_DETECTED') {
        return 'Liveness check failed. Please use a real face and try again.';
    }
    if (code === 'FACE_MISMATCH') {
        return 'Face mismatch: captured face does not match this student code.';
    }
    if (code === 'FACE_NOT_RECOGNIZED') {
        return 'Face not recognized. Try again with better lighting and frontal pose.';
    }
    if (code === 'NOT_ENROLLED') {
        return 'This student is not enrolled yet.';
    }
    if (code === 'ML_TIMEOUT') {
        return 'Verification service is unavailable. Please try again shortly.';
    }
    return error?.message || 'Verification failed. Please retry.';
}

async function frameToBlob(video, canvas) {
    const width = video.videoWidth;
    const height = video.videoHeight;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, width, height);
    return new Promise((resolve) => {
        canvas.toBlob(resolve, 'image/jpeg', 0.92);
    });
}

export default function VerifyCameraView({ studentCode, studentName, onVerified }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    const [status, setStatus] = useState('Starting camera...');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [cameraError, setCameraError] = useState('');
    const [cameraAttempt, setCameraAttempt] = useState(0);

    useEffect(() => {
        let mounted = true;

        async function startCamera(retries = 0) {
            try {
                // Short wait allows previous components (like QR Scanner) to release the camera hardware lock seamlessly
                if (retries === 0) await new Promise(r => setTimeout(r, 600));

                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: 'user',
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                });

                if (!mounted) {
                    stream.getTracks().forEach((track) => track.stop());
                    return;
                }

                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    await videoRef.current.play();
                }
                setStatus('Fit your face inside the oval, then tap Verify');
            } catch (_error) {
                console.error("Camera start error:", _error);
                if (retries < 3) {
                    // Retry starting camera automatically if it's locked by another process temporarily
                    setTimeout(() => startCamera(retries + 1), 1000);
                } else {
                    setCameraError('Unable to access camera. Check browser permissions or close other apps using it.');
                }
            }
        }

        startCamera();

        return () => {
            mounted = false;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
            }
        };
    }, [cameraAttempt]);

    const verify = useCallback(async () => {
        if (!videoRef.current || loading) {
            return;
        }

        setLoading(true);
        setResult(null);
        setStatus('Checking your face…');

        try {
            const blob = await frameToBlob(videoRef.current, canvasRef.current);
            if (!blob) {
                throw new Error('Failed to capture verification frame');
            }

            const formData = new FormData();
            formData.append('image', blob, 'verify.jpg');
            const response = await verifyStudent(studentCode, formData);
            setResult({ type: 'success', message: response.message, similarity: response.similarity });
            setStatus('Verification successful');
            onVerified?.(response);
        } catch (error) {
            setResult({ type: 'error', message: mapVerifyError(error) });
            setStatus('Verification failed');
        } finally {
            setLoading(false);
        }
    }, [loading, onVerified, studentCode]);

    const resultCard = useMemo(() => {
        if (!result) {
            return null;
        }
        return (
            <div className={`${styles.result} ${result.type === 'success' ? styles.success : styles.error}`}>
                <p>{result.message}</p>
                {typeof result.similarity === 'number' ? <small>Similarity: {(result.similarity * 100).toFixed(1)}%</small> : null}
            </div>
        );
    }, [result]);

    if (cameraError) {
        return (
            <section className={styles.panel} role="alert">
                <p>{cameraError}</p>
                <button
                    type="button"
                    className={styles.button}
                    onClick={() => { setCameraError(''); setStatus('Starting camera...'); setCameraAttempt((n) => n + 1); }}
                >
                    Try again
                </button>
            </section>
        );
    }

    return (
        <section className={styles.panel}>
            <p className={styles.hint} role="status">{status}</p>
            <div className={styles.cameraShell}>
                <video ref={videoRef} className={styles.video} playsInline muted autoPlay />
                <div className={styles.oval} aria-hidden="true" />
            </div>
            <ul className={styles.tips}>
                <li>Face the light, remove hats or masks</li>
                <li>Only your face should be in the frame</li>
            </ul>
            <canvas ref={canvasRef} className={styles.hiddenCanvas} />
            <div className={styles.actions}>
                <button type="button" className={styles.button} onClick={verify} disabled={loading}>
                    {loading ? 'Verifying…' : result?.type === 'error' ? 'Try again' : 'Verify'}
                </button>
            </div>
            {resultCard}
        </section>
    );
}
