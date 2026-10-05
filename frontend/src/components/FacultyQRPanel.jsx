import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import io from 'socket.io-client';
import styles from './FacultyQRPanel.module.css';

const API_BASE_URL = '';
const ROTATION_SEC = 30;

const FacultyQRPanel = ({ sessionId, isActive, presentCount = 0, totalCount = 0, onAttendanceMarked }) => {
    const [qrData, setQrData] = useState({ jwt: '', shortcode: '', expiresAt: 0, round: 0 });
    const [secondsRemaining, setSecondsRemaining] = useState(0);
    const [fade, setFade] = useState(false);
    const [connected, setConnected] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [projector, setProjector] = useState(false);

    useEffect(() => {
        if (!isActive || !sessionId) return undefined;

        const socket = io(API_BASE_URL);
        socket.on('connect', () => {
            setConnected(true);
            socket.emit('join-faculty', sessionId);
        });
        socket.on('disconnect', () => setConnected(false));

        fetch(`${API_BASE_URL}/api/qr/current/${sessionId}`)
            .then((res) => res.json())
            .then((data) => {
                if (data && data.jwt) {
                    setQrData(data);
                    setLoadError(false);
                } else {
                    setLoadError(true);
                }
            })
            .catch(() => setLoadError(true));

        socket.on('qr-rotate', (data) => {
            setFade(true);
            setTimeout(() => {
                setQrData(data);
                setLoadError(false);
                setFade(false);
            }, 150);
        });

        socket.on('attendance-marked', () => {
            if (onAttendanceMarked) onAttendanceMarked();
        });

        return () => socket.disconnect();
    }, [sessionId, isActive]);

    useEffect(() => {
        const timer = setInterval(() => {
            if (qrData.expiresAt > 0) {
                setSecondsRemaining(Math.max(0, Math.ceil((qrData.expiresAt - Date.now()) / 1000)));
            }
        }, 200);
        return () => clearInterval(timer);
    }, [qrData]);

    useEffect(() => {
        if (!projector) return undefined;
        const onKey = (e) => e.key === 'Escape' && setProjector(false);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [projector]);

    if (!isActive) return null;

    const spacedCode = (qrData.shortcode || '').split('').join(' ');
    const progress = (
        <div className={styles.progress} role="progressbar" aria-valuemin={0} aria-valuemax={ROTATION_SEC} aria-valuenow={secondsRemaining} aria-label="Time until code refresh">
            <div className={styles.bar} style={{ width: `${(secondsRemaining / ROTATION_SEC) * 100}%` }} />
        </div>
    );

    if (projector) {
        return (
            <div className={styles.overlay} role="dialog" aria-label="Projector view">
                <button type="button" className={`${styles.projectorBtn} ${styles.close}`} onClick={() => setProjector(false)}>
                    Exit full screen (Esc)
                </button>
                <div className={styles.overlayQr} style={{ opacity: fade ? 0 : 1 }}>
                    {qrData.jwt && (
                        <QRCodeSVG value={qrData.jwt} size={Math.min(window.innerHeight * 0.55, window.innerWidth * 0.8)} marginSize={1} />
                    )}
                </div>
                <div className={styles.overlayCode}>{spacedCode || '—'}</div>
                <div className={styles.overlayProgress}>{progress}</div>
                <div className={styles.overlayCount}>{presentCount} / {totalCount} present</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h3>Attendance code</h3>
                <span className={styles.conn} role="status">
                    <span className={`${styles.dot} ${connected ? styles.dotOn : ''}`} />
                    {connected ? 'Live' : 'Reconnecting…'}
                </span>
            </div>

            <div className={styles.qrBox} style={{ opacity: fade ? 0 : 1 }}>
                {qrData.jwt ? (
                    <QRCodeSVG value={qrData.jwt} size={240} marginSize={1} />
                ) : (
                    <div className={`${styles.placeholder} ${loadError ? styles.error : ''}`}>
                        {loadError ? 'Could not load the QR code. It will retry on the next refresh.' : 'Loading QR…'}
                    </div>
                )}
            </div>

            <div className={styles.shortcode} aria-label="Attendance code">{spacedCode}</div>
            <div className={styles.hint}>Students without a camera can type this code</div>

            {progress}
            <div className={styles.stats}>
                <span>Refreshes in {secondsRemaining}s</span>
                <span>{presentCount} / {totalCount} present</span>
            </div>

            <div className={styles.actions}>
                <button type="button" className={styles.projectorBtn} onClick={() => setProjector(true)}>
                    Show full screen for projector
                </button>
            </div>
        </div>
    );
};

export default FacultyQRPanel;
