import { useState, useEffect, useRef } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import io from 'socket.io-client';
import styles from './StudentGate1.module.css';

const API_BASE_URL = '';

const REASON_MESSAGES = {
    INVALID_TOKEN: "That code isn't right. Check the teacher's screen and try again.",
    TOKEN_EXPIRED: 'That code just expired. Use the newest one on the teacher\'s screen.',
    NOT_ENROLLED: "You're not enrolled in this class.",
};

const StudentGate1 = ({ sessionId, studentId, onPass }) => {
    const [mode, setMode] = useState('scan');
    const [shortcode, setShortcode] = useState('');
    const [expiresAt, setExpiresAt] = useState(0);
    const [secondsRemaining, setSecondsRemaining] = useState(0);
    const [error, setError] = useState('');
    const [passed, setPassed] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const hasScannedRef = useRef(false);

    useEffect(() => {
        const socket = io(API_BASE_URL);
        socket.on('connect', () => socket.emit('join-session', sessionId));
        socket.on('code-rotate', (data) => {
            if (data.expiresAt > 0) setExpiresAt(data.expiresAt);
        });

        // Start the countdown immediately instead of waiting for the next rotation.
        fetch(`${API_BASE_URL}/api/qr/current/${sessionId}`)
            .then((res) => res.json())
            .then((data) => data && data.expiresAt && setExpiresAt(data.expiresAt))
            .catch(() => {});

        return () => socket.disconnect();
    }, [sessionId]);

    useEffect(() => {
        const timer = setInterval(() => {
            setSecondsRemaining(expiresAt > 0 ? Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)) : 0);
        }, 250);
        return () => clearInterval(timer);
    }, [expiresAt]);

    const handleSubmit = async (inputToken) => {
        if (hasScannedRef.current) return;
        hasScannedRef.current = true;
        setIsSubmitting(true);
        setError('');

        try {
            const response = await fetch(`${API_BASE_URL}/api/qr/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: inputToken, studentId, sessionId }),
            });
            const result = await response.json();

            if (result.valid || result.reason === 'ALREADY_PASSED') {
                setPassed(true);
                setTimeout(() => onPass(), 700);
                return;
            }
            if (response.status === 429) {
                setError('Too many attempts. Wait a minute and try again.');
            } else {
                setError(REASON_MESSAGES[result.reason] || 'Verification failed. Please try again.');
            }
        } catch (err) {
            setError('Could not reach the server. Check your connection and try again.');
        } finally {
            setIsSubmitting(false);
            setTimeout(() => { hasScannedRef.current = false; }, 2000);
        }
    };

    const handleShortcodeSubmit = (e) => {
        e.preventDefault();
        if (shortcode.length === 6) handleSubmit(shortcode);
    };

    return (
        <div className={styles.container}>
            <div className={styles.toggle} role="tablist">
                <button type="button" role="tab" aria-selected={mode === 'scan'}
                    className={`${styles.tab} ${mode === 'scan' ? styles.tabActive : ''}`}
                    onClick={() => { setMode('scan'); setError(''); }}>
                    Scan QR
                </button>
                <button type="button" role="tab" aria-selected={mode === 'shortcode'}
                    className={`${styles.tab} ${mode === 'shortcode' ? styles.tabActive : ''}`}
                    onClick={() => { setMode('shortcode'); setError(''); }}>
                    Type code
                </button>
            </div>

            {mode === 'scan' ? (
                <div>
                    <div className={styles.scanBox}>
                        <Scanner
                            onScan={(result) => {
                                if (result && result.length > 0) handleSubmit(result[0].rawValue);
                            }}
                            onError={(err) => {
                                if (err) {
                                    console.error(err);
                                    setError('Camera unavailable. Allow camera access in your browser, or switch to "Type code".');
                                }
                            }}
                            components={{ finder: true }}
                        />
                    </div>
                    <p className={styles.hint}>Point your camera at the QR code on the teacher's screen.</p>
                </div>
            ) : (
                <form onSubmit={handleShortcodeSubmit}>
                    <label htmlFor="shortcode" className={styles.hint} style={{ display: 'block', marginBottom: 8 }}>
                        Enter the 6-digit code shown on the teacher's screen
                    </label>
                    <input
                        id="shortcode"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        placeholder="000000"
                        aria-label="6-digit attendance code"
                        value={shortcode}
                        onChange={(e) => setShortcode(e.target.value.replace(/\D/g, ''))}
                        className={styles.codeInput}
                        disabled={isSubmitting || passed}
                    />
                    <button type="submit" disabled={shortcode.length !== 6 || isSubmitting || passed} className={styles.submit}>
                        {isSubmitting ? 'Checking…' : 'Continue'}
                    </button>
                </form>
            )}

            {passed && <div className={styles.ok} role="status">Code accepted ✓</div>}
            {error && <div className={styles.error} role="alert">{error}</div>}

            {expiresAt > 0 && (
                <div className={styles.footer}>
                    Code refreshes in {secondsRemaining}s
                    {secondsRemaining > 0 && secondsRemaining < 5 && (
                        <span className={styles.warn}> · changing soon, use the new one if it fails</span>
                    )}
                </div>
            )}
        </div>
    );
};

export default StudentGate1;
