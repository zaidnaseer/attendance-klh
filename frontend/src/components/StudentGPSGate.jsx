import { useEffect, useRef, useState } from 'react';
import { validateGpsLocation } from '../lib/api';
import { formatDistance, getCurrentPosition } from '../lib/geolocation';
import styles from './StudentGPSGate.module.css';

function reasonToMessage(result) {
    switch (result.reason) {
        case 'OUT_OF_RANGE':
            return `You appear to be ${formatDistance(result.distance)} away. You must be within ${formatDistance(result.radius)} of the institution.`;
        case 'LOW_ACCURACY':
            return `Your location is too imprecise (±${formatDistance(result.accuracy)}). Turn on precise location / GPS, move near a window, and try again.`;
        case 'GPS_NOT_CONFIGURED':
            return 'The institution location has not been set up yet. Please contact your faculty.';
        case 'NOT_ENROLLED':
            return 'You are not enrolled in this session course';
        case 'SESSION_NOT_ACTIVE':
            return 'This attendance session is no longer active';
        case 'INVALID_COORDINATES':
            return 'Your device returned an invalid location. Please try again.';
        default:
            return result.reason || 'Location verification failed';
    }
}

const StudentGPSGate = ({ sessionId, studentId, onPass }) => {
    const [status, setStatus] = useState('idle'); // idle | locating | checking | passed
    const [error, setError] = useState('');
    const passTimerRef = useRef(null);

    useEffect(() => () => clearTimeout(passTimerRef.current), []);

    const isBusy = status === 'locating' || status === 'checking';

    async function verifyLocation() {
        setError('');
        setStatus('locating');
        try {
            const position = await getCurrentPosition();
            setStatus('checking');
            const result = await validateGpsLocation({ studentId, sessionId, ...position });

            if (result.valid) {
                setStatus('passed');
                passTimerRef.current = setTimeout(() => onPass(), 800);
                return;
            }
            setError(reasonToMessage(result));
        } catch (err) {
            setError(err.data?.reason ? reasonToMessage(err.data) : err.data?.error || err.message);
        }
        setStatus('idle');
    }

    const label = status === 'locating'
        ? 'Getting your location…'
        : status === 'checking'
            ? 'Checking…'
            : error ? 'Try again' : 'Verify my location';

    return (
        <div className={styles.container}>
            <h3 className={styles.title}>Verify your location</h3>
            <p className={styles.text}>
                Your faculty requires you to be on campus. We check your device&apos;s location once; it is not tracked afterwards.
            </p>

            {status === 'passed' ? (
                <div className={styles.ok} role="status">Location verified ✓</div>
            ) : (
                <button type="button" className={styles.submit} onClick={verifyLocation} disabled={isBusy}>
                    {isBusy && <span className={styles.spinner} aria-hidden="true" />}
                    {label}
                </button>
            )}

            <div aria-live="polite">
                {error && <div className={styles.error} role="alert">{error}</div>}
            </div>
        </div>
    );
};

export default StudentGPSGate;
