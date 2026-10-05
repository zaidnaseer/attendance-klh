import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import { getGpsStats } from '../lib/api';
import { formatDistance } from '../lib/geolocation';
import styles from './FacultyGPSPanel.module.css';

const API_BASE_URL = '';

const FacultyGPSPanel = ({ sessionId, institution, presentCount, totalCount, onAttendanceMarked }) => {
    const [studentsVerified, setStudentsVerified] = useState(0);
    const [connected, setConnected] = useState(false);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        if (!sessionId) return undefined;

        const socket = io(API_BASE_URL);
        socket.on('connect', () => {
            setConnected(true);
            socket.emit('join-faculty', sessionId);
        });
        socket.on('disconnect', () => setConnected(false));

        getGpsStats(sessionId)
            .then((data) => {
                setStudentsVerified(data.count);
                setLoadError(false);
            })
            .catch(() => setLoadError(true));

        socket.on('gps-stats', (data) => {
            setStudentsVerified(data.count);
            setLoadError(false);
        });

        if (onAttendanceMarked) {
            socket.on('attendance-marked', () => onAttendanceMarked());
        }

        return () => {
            socket.disconnect();
        };
    }, [sessionId]);

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h3>Location check</h3>
                <span className={styles.conn} role="status">
                    <span className={`${styles.dot} ${connected ? styles.dotOn : ''}`} />
                    {connected ? 'Live' : 'Reconnecting…'}
                </span>
            </div>

            {institution ? (
                <p className={styles.text}>
                    Students must be within <strong>{formatDistance(institution.radius_meters)}</strong> of{' '}
                    <strong>{institution.name || 'the institution'}</strong> to continue.
                </p>
            ) : (
                <p className={styles.warning} role="alert">
                    Institution location is not configured. Ask the admin to set it.
                </p>
            )}

            {loadError && <p className={styles.error} role="alert">Couldn&apos;t load the location count. It will update live.</p>}

            <div className={styles.stats}>
                <span><strong>{studentsVerified}</strong> verified by location</span>
                {totalCount !== undefined && <span><strong>{presentCount}</strong> / {totalCount} present</span>}
            </div>
        </div>
    );
};

export default FacultyGPSPanel;
