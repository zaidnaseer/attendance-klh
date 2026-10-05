import React, { useState, useEffect, useRef } from 'react';
import { Scanner } from '@yudiel/react-qr-scanner';
import io from 'socket.io-client';

const API_BASE_URL = '';

const StudentGate1 = ({ sessionId, studentId, step = 1, totalSteps = 2, onPass }) => {
    const [mode, setMode] = useState('shortcode'); // 'shortcode' or 'scan'
    const [shortcode, setShortcode] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const hasScannedRef = useRef(false);

    useEffect(() => {
        const socket = io(API_BASE_URL);

        socket.on('connect', () => {
            socket.emit('join-session', sessionId);
        });

        return () => {
            socket.disconnect();
        };
    }, [sessionId]);

    const handleSubmit = async (inputToken) => {
        if (hasScannedRef.current) return;
        hasScannedRef.current = true;
        setIsSubmitting(true);
        setError('');

        try {
            const response = await fetch(`${API_BASE_URL}/api/qr/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: inputToken, studentId, sessionId })
            });

            const result = await response.json();

            if (result.valid) {
                onPass();
            } else {
                switch (result.reason) {
                    case 'INVALID_TOKEN':
                        setError('Wrong code — try again');
                        break;
                    case 'TOKEN_EXPIRED':
                        setError('Code expired — ask faculty to show new code');
                        break;
                    case 'ALREADY_PASSED':
                        setError('Already verified this session');
                        // Need a small timeout to let user see message, or just advance
                        setTimeout(() => onPass(), 1500); 
                        break;
                    case 'NOT_ENROLLED':
                        setError('You are not enrolled in this session course');
                        break;
                    default:
                        setError(result.reason || 'Verification failed');
                }
            }
        } catch (err) {
            setError('Network error connecting to server');
        } finally {
            setIsSubmitting(false);
            // Allow scanning again after 2 seconds if submission completely fails or gives an error
            setTimeout(() => {
                hasScannedRef.current = false;
            }, 2000);
        }
    };

    const handleShortcodeSubmit = (e) => {
        e.preventDefault();
        if (shortcode.length === 6) {
            handleSubmit(shortcode);
        }
    };

    return (
        <div style={styles.container}>
            <h3>Step {step} of {totalSteps} — Verify Presence</h3>

            <div style={styles.modeToggle}>
                <button 
                    style={mode === 'scan' ? styles.activeBtn : styles.inactiveBtn}
                    onClick={() => setMode('scan')}
                >
                    Scan QR
                </button>
                <button 
                    style={mode === 'shortcode' ? styles.activeBtn : styles.inactiveBtn}
                    onClick={() => setMode('shortcode')}
                >
                    Type Code
                </button>
            </div>

            {mode === 'scan' ? (
                <div style={styles.scanContainer}>
                    <Scanner
                        onScan={(result) => {
                            if (result && result.length > 0) { 
                                handleSubmit(result[0].rawValue);
                            }
                        }}
                        onError={(err) => {
                            if (err) {
                                console.error(err);
                                setError("Camera access denied or unsupported. Please accept permissions.");
                            }
                        }}
                        components={{
                            finder: true
                        }}
                    />
                    <p style={styles.hint}>Point your camera at the faculty's screen</p>
                </div>
            ) : (
                <form onSubmit={handleShortcodeSubmit} style={styles.formContainer}>
                    <input
                        type="text"
                        maxLength={6}
                        placeholder="_ _ _ _ _ _"
                        value={shortcode}
                        onChange={(e) => setShortcode(e.target.value.replace(/\D/g, ''))}
                        style={styles.input}
                        disabled={isSubmitting}
                    />
                    <br />
                    <button type="submit" disabled={shortcode.length !== 6 || isSubmitting} style={styles.submitBtn}>
                        Verify Presence
                    </button>
                </form>
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
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    },
    modeToggle: {
        display: 'flex',
        justifyContent: 'space-around',
        marginBottom: '20px'
    },
    activeBtn: {
        backgroundColor: '#4CAF50',
        color: 'white',
        border: 'none',
        padding: '10px 20px',
        borderRadius: '5px',
        cursor: 'pointer'
    },
    inactiveBtn: {
        backgroundColor: '#eee',
        color: '#333',
        border: '1px solid #ccc',
        padding: '10px 20px',
        borderRadius: '5px',
        cursor: 'pointer'
    },
    scanContainer: {
        margin: '20px 0'
    },
    formContainer: {
        margin: '20px 0'
    },
    input: {
        fontSize: '2em',
        letterSpacing: '5px',
        textAlign: 'center',
        width: '80%',
        padding: '10px',
        borderRadius: '5px',
        border: '1px solid #ccc'
    },
    submitBtn: {
        marginTop: '20px',
        width: '80%',
        padding: '15px',
        fontSize: '1em',
        backgroundColor: '#2196F3',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer'
    },
    error: {
        color: 'red',
        margin: '10px 0',
        fontWeight: 'bold'
    },
    hint: {
        fontSize: '0.8em',
        color: '#666',
        marginTop: '10px'
    }
};

export default StudentGate1;