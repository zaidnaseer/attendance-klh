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

export default function VerifyCameraView({ studentCode, studentName }) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const streamRef = useRef(null);

    const [status, setStatus] = useState('Starting camera...');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const [cameraError, setCameraError] = useState('');

    useEffect(() => {
        let mounted = true;

        async function startCamera() {
            try {
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
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                setStatus('Align your face, then tap Verify');
            } catch (_error) {
                setCameraError('Unable to access camera. Check browser permissions.');
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
    }, []);

    const verify = useCallback(async () => {
        if (!videoRef.current || loading) {
            return;
        }

        setLoading(true);
        setResult(null);
        setStatus('Running RetinaFace, ArcFace and anti-spoofing checks...');

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
        } catch (error) {
            setResult({ type: 'error', message: mapVerifyError(error) });
            setStatus('Verification failed');
        } finally {
            setLoading(false);
        }
    }, [loading, studentCode]);

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
        return <section className={styles.panel}>{cameraError}</section>;
    }

    return (
        <section className={styles.panel}>
            <h2>Verify: {studentName}</h2>
            <p className={styles.hint}>{status}</p>
            <div className={styles.cameraShell}>
                <video ref={videoRef} className={styles.video} playsInline muted autoPlay />
            </div>
            <canvas ref={canvasRef} className={styles.hiddenCanvas} />
            <div className={styles.actions}>
                <button type="button" className={styles.button} onClick={verify} disabled={loading}>
                    {loading ? 'Verifying...' : 'Verify'}
                </button>
            </div>
            {resultCard}
        </section>
    );
}
