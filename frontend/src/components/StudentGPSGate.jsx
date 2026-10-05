import { useEffect, useRef, useState } from 'react';
import { validateGpsLocation } from '../lib/api';
import { formatDistance, getCurrentPosition } from '../lib/geolocation';

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

const StudentGPSGate = ({ sessionId, studentId, step = 1, totalSteps = 2, onPass }) => {
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

    return (
        <div style={styles.container}>
            <h3>Step {step} of {totalSteps} — Verify Location</h3>
            <p style={styles.text}>
                Your faculty requires you to be on campus. We will check your device&apos;s location once; it is not tracked afterwards.
            </p>

            {status === 'passed' ? (
                <div style={styles.success}>Location verified ✓</div>
            ) : (
                <button type="button" style={styles.button} onClick={verifyLocation} disabled={isBusy}>
                    {status === 'locating' ? 'Getting your location…' : status === 'checking' ? 'Checking…' : 'Verify My Location'}
                </button>
            )}

            {error && <div style={styles.error}>{error}</div>}
        </div>
    );
};

const styles = {
    container: {
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '20px',
        textAlign: 'center',
        maxWidth: '400px',
        margin: '20px auto',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    },
    text: {
        fontSize: '0.9em',
        color: '#94a3b8',
        margin: '0 0 20px',
    },
    button: {
        width: '80%',
        padding: '15px',
        fontSize: '1em',
        backgroundColor: '#2196F3',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
    },
    success: {
        color: '#22c55e',
        fontWeight: 'bold',
        fontSize: '1.1em',
        padding: '12px 0',
    },
    error: {
        color: 'red',
        margin: '14px 0 0',
        fontWeight: 'bold',
    },
};

export default StudentGPSGate;
