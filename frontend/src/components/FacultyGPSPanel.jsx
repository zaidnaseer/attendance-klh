import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import { getGpsStats } from '../lib/api';
import { formatDistance } from '../lib/geolocation';

const API_BASE_URL = '';

const FacultyGPSPanel = ({ sessionId, institution, onAttendanceMarked }) => {
    const [studentsVerified, setStudentsVerified] = useState(0);

    useEffect(() => {
        if (!sessionId) return undefined;

        const socket = io(API_BASE_URL);
        socket.on('connect', () => {
            socket.emit('join-faculty', sessionId);
        });

        getGpsStats(sessionId)
            .then((data) => setStudentsVerified(data.count))
            .catch((err) => console.error('Failed to load GPS stats:', err));

        socket.on('gps-stats', (data) => {
            setStudentsVerified(data.count);
        });

        if (onAttendanceMarked) {
            socket.on('attendance-marked', () => onAttendanceMarked());
        }

        return () => {
            socket.disconnect();
        };
    }, [sessionId]);

    return (
        <div style={styles.container}>
            <h3 style={styles.title}>GPS — Location Verification</h3>
            {institution ? (
                <p style={styles.text}>
                    Students must be within <strong>{formatDistance(institution.radius_meters)}</strong> of{' '}
                    <strong>{institution.name || 'the institution'}</strong> to continue.
                </p>
            ) : (
                <p style={styles.warning}>Institution location is not configured. Ask the admin to set it.</p>
            )}
            <div style={styles.stats}>Students verified via GPS: {studentsVerified}</div>
        </div>
    );
};

const styles = {
    container: {
        border: '1px solid rgba(56, 189, 248, 0.3)',
        background: 'rgba(56, 189, 248, 0.06)',
        borderRadius: '8px',
        padding: '16px 20px',
        textAlign: 'center',
        maxWidth: '400px',
        margin: '20px auto',
    },
    title: {
        margin: '0 0 10px',
    },
    text: {
        margin: '0 0 10px',
        color: '#cbd5e1',
    },
    warning: {
        margin: '0 0 10px',
        color: '#fca5a5',
    },
    stats: {
        fontSize: '0.9em',
        color: '#94a3b8',
    },
};

export default FacultyGPSPanel;
