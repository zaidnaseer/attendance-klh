import { useCallback, useEffect, useRef, useState } from 'react';
import { requestGestureChallenge, verifyGestureTrace } from '../lib/api';
import { GestureTracker, extractFeatures } from '../lib/gestures';
import { useFaceLandmarker } from '../hooks/useFaceLandmarker';
import styles from './StudentGestureGate.module.css';

const MAX_TRACE_FRAMES = 1400; // server accepts up to 1500

function reasonToMessage(result) {
    switch (result.reason) {
        case 'GESTURE_NOT_PERFORMED':
            return 'We did not detect the requested gestures in time. Face the camera in good light and try again.';
        case 'MULTIPLE_FACES':
            return 'More than one face was visible. Only you should be in the frame.';
        case 'FACE_LOST':
            return 'We lost sight of your face. Keep it centered in the frame the whole time.';
        case 'FRAME_RATE_TOO_LOW':
            return 'Your device was too slow to track the gestures. Close other apps and try again.';
        case 'CHALLENGE_EXPIRED':
            return 'The check timed out. Please start again.';
        case 'CHALLENGE_ALREADY_USED':
        case 'CHALLENGE_NOT_FOUND':
        case 'INVALID_TRACE':
        case 'TRACE_TOO_SHORT':
        case 'TRACE_TIMING_MISMATCH':
            return 'The check could not be completed. Please try again.';
        case 'NOT_ENROLLED':
            return 'You are not enrolled in this session course';
        case 'SESSION_NOT_ACTIVE':
            return 'This attendance session is no longer active';
        case 'GESTURE_NOT_REQUIRED':
            return 'This session does not require a gesture check.';
        default:
            return result.reason || 'Liveness check failed';
    }
}

const StudentGestureGate = ({ sessionId, studentId, onPass }) => {
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const rafRef = useRef(null);
    const passTimerRef = useRef(null);
    const debugRef = useRef(null);
    const showDebug = new URLSearchParams(window.location.search).has('debug');
    const runRef = useRef(0); // bumped on every start/stop so stale async work can bail out

    const { landmarker, ready, error: modelError, retry: retryModel } = useFaceLandmarker();

    // idle | starting | running | submitting | passed
    const [status, setStatus] = useState('idle');
    const [error, setError] = useState('');
    const [challenge, setChallenge] = useState(null);
    const [progress, setProgress] = useState({ index: 0, cycles: 0 });

    const stopCamera = useCallback(() => {
        runRef.current += 1;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
    }, []);

    useEffect(() => () => {
        stopCamera();
        clearTimeout(passTimerRef.current);
    }, [stopCamera]);

    const submit = useCallback(async (activeChallenge, trace, avgFps) => {
        const video = videoRef.current;
        const clientInfo = {
            userAgent: navigator.userAgent,
            videoWidth: video?.videoWidth,
            videoHeight: video?.videoHeight,
            avgFps,
        };
        stopCamera();
        setStatus('submitting');
        try {
            const result = await verifyGestureTrace({
                studentId,
                sessionId,
                challengeId: activeChallenge.challengeId,
                trace,
                clientInfo,
            });
            if (result.valid) {
                setStatus('passed');
                passTimerRef.current = setTimeout(() => onPass(), 800);
                return;
            }
            setError(reasonToMessage(result));
        } catch (err) {
            setError(err.data?.reason ? reasonToMessage(err.data) : err.data?.error || err.message);
        }
        setChallenge(null);
        setStatus('idle');
    }, [onPass, sessionId, stopCamera, studentId]);

    // The detection loop must not restart when the parent re-renders (dashboard polling gives
    // onPass a new identity every few seconds), so it calls submit through a ref.
    const submitRef = useRef(submit);
    submitRef.current = submit;

    async function start() {
        setError('');
        setStatus('starting');
        const runId = runRef.current + 1;
        runRef.current = runId;

        try {
            const issued = await requestGestureChallenge({ studentId, sessionId, debug: showDebug });
            if (runRef.current !== runId) return;

            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
            });
            if (runRef.current !== runId) {
                stream.getTracks().forEach((track) => track.stop());
                return;
            }
            streamRef.current = stream;
            videoRef.current.srcObject = stream;
            await videoRef.current.play();

            setChallenge(issued);
            setProgress({ index: 0, cycles: 0 });
            setStatus('running');
        } catch (err) {
            stopCamera();
            if (err?.data?.reason) setError(reasonToMessage(err.data));
            else if (err?.name === 'NotAllowedError' || err?.name === 'NotFoundError') {
                setError('Unable to access the camera. Check browser permissions and close other apps using it.');
            } else setError(err?.data?.error || err?.message || 'Could not start the liveness check.');
            setStatus('idle');
        }
    }

    // Detection loop: runs while status === 'running'
    useEffect(() => {
        if (status !== 'running' || !challenge || !landmarker || !videoRef.current) return undefined;

        const video = videoRef.current;
        const runId = runRef.current;
        const tracker = new GestureTracker(challenge.gestures, challenge.timeLimitMs);
        const trace = [];
        const t0 = performance.now();
        let lastVideoTime = -1;

        function frame() {
            if (runRef.current !== runId) return;
            const now = performance.now();

            if (video.readyState >= 2 && video.currentTime !== lastVideoTime) {
                lastVideoTime = video.currentTime;
                const result = landmarker.detectForVideo(video, now);
                const features = extractFeatures(result);
                const entry = { t: Math.round(now - t0), ...features };
                trace.push(entry);
                // Debug mode has no practical time limit, so keep only the most recent frames.
                if (trace.length > MAX_TRACE_FRAMES) trace.shift();

                if (debugRef.current) {
                    const n = trace.length;
                    const fps = n > 1 ? (n - 1) / ((entry.t - trace[0].t) / 1000) : 0;
                    debugRef.current.textContent = `faces ${entry.faces} | fps ${fps.toFixed(1)}\n`
                        + `blink ${entry.blink.toFixed(2)} smile ${entry.smile.toFixed(2)} jaw ${entry.jaw.toFixed(2)} turn ${entry.turn.toFixed(2)}`;
                }

                if (tracker.push(entry)) {
                    setProgress({ index: tracker.index, cycles: tracker.cycles });
                }
                if (tracker.status !== 'running' || (!showDebug && trace.length >= MAX_TRACE_FRAMES)) {
                    const elapsed = (trace[trace.length - 1].t - trace[0].t) / 1000;
                    submitRef.current(challenge, trace, elapsed > 0 ? trace.length / elapsed : 0);
                    return;
                }
            }
            rafRef.current = requestAnimationFrame(frame);
        }
        rafRef.current = requestAnimationFrame(frame);

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        };
    }, [status, challenge, landmarker]);

    const current = challenge?.gestures[progress.index];
    const total = challenge?.gestures.length || 0;
    const busy = status === 'starting' || status === 'submitting';
    const showVideo = status === 'running' || status === 'starting';

    return (
        <div className={styles.container}>
            <h3 className={styles.title}>Liveness check</h3>
            <p className={styles.text}>
                {status === 'running' && current
                    ? `Step ${progress.index + 1} of ${total}`
                    : 'Your faculty requires a quick liveness check. You will be asked to perform a couple of simple gestures in front of the camera. Video stays on your device; only measurements are sent.'}
            </p>

            <div className={styles.cameraShell} hidden={!showVideo}>
                <video ref={videoRef} className={styles.video} playsInline muted autoPlay />
                {status === 'running' && current ? (
                    <>
                        <div className={styles.prompt} role="status" aria-live="assertive">
                            {current.label}
                            {current.reps > 1 ? ` (${progress.cycles}/${current.reps})` : ''}
                        </div>
                        {!showDebug && <div
                            key={`${progress.index}`}
                            className={styles.timer}
                            style={{ animationDuration: `${challenge.timeLimitMs}ms` }}
                            aria-hidden="true"
                        />}
                    </>
                ) : null}
            </div>
            {showDebug && status === 'running' ? (
                <pre ref={debugRef} style={{ margin: '0 0 12px', fontSize: '0.8rem', textAlign: 'left' }} />
            ) : null}

            {status === 'passed' ? (
                <div className={styles.ok} role="status">Liveness verified ✓</div>
            ) : status === 'running' ? null : (
                <button
                    type="button"
                    className={styles.submit}
                    onClick={start}
                    disabled={busy || (!ready && !modelError)}
                >
                    {(busy || (!ready && !modelError)) && <span className={styles.spinner} aria-hidden="true" />}
                    {status === 'starting'
                        ? 'Starting camera…'
                        : status === 'submitting'
                            ? 'Checking…'
                            : !ready && !modelError
                                ? 'Loading detector…'
                                : error ? 'Try again' : 'Start liveness check'}
                </button>
            )}

            <div aria-live="polite">
                {error && <div className={styles.error} role="alert">{error}</div>}
                {modelError && (
                    <div className={styles.error} role="alert">
                        Could not load the gesture detector. Check your connection.
                        <button type="button" className={styles.linkBtn} onClick={retryModel}>Retry</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentGestureGate;
