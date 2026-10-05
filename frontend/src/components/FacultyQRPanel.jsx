import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import io from 'socket.io-client';

const API_BASE_URL = '';

const FacultyQRPanel = ({ sessionId, isActive, onAttendanceMarked }) => {
    const [qrData, setQrData] = useState({
        jwt: '',
        shortcode: '',
        round: 0
    });
    const [studentsVerified, setStudentsVerified] = useState(0);
    const [fade, setFade] = useState(false);

    useEffect(() => {
        if (!isActive || !sessionId) return;

        const socket = io(API_BASE_URL);
        
        socket.on('connect', () => {
            socket.emit('join-faculty', sessionId);
        });

        // Fetch immediate state on mount rather than waiting 30 seconds
        fetch(`${API_BASE_URL}/api/qr/current/${sessionId}`)
            .then((res) => res.json())
            .then((data) => {
                if (data && data.jwt) {
                    setQrData(data);
                }
            })
            .catch((err) => console.error("Failed to load current QR:", err));

        socket.on('qr-rotate', (data) => {
            setFade(true); // Start fade out
            setTimeout(() => {
                setQrData(data);
                setFade(false); // Fade in
            }, 150);
        });

        socket.on('gate1-stats', (data) => {
            setStudentsVerified(data.count);
        });

        socket.on('attendance-marked', () => {
            if (onAttendanceMarked) {
                onAttendanceMarked();
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [sessionId, isActive]);

    if (!isActive) return null;

    return (
        <div style={styles.container}>
            <h3>GATE 1 — Presence Verification</h3>
            <div style={{ ...styles.qrContainer, opacity: fade ? 0 : 1 }}>
                {qrData.jwt ? (
                    <QRCodeSVG 
                        value={qrData.jwt} 
                        size={240} 
                        bgColor="#ffffff" 
                        fgColor="#000000" 
                        marginSize={2} 
                    />
                ) : (
                    <div style={styles.placeholder}>Waiting for QR...</div>
                )}
            </div>
            
            <div style={styles.shortcodeContainer}>
                <span style={styles.label}>Code:</span>
                <span style={styles.shortcode}>
                    {qrData.shortcode.split('').join(' ')}
                </span>
                <div style={styles.hint}>(for students without phones)</div>
            </div>

            <div style={styles.statsContainer}>
                <div>Round #{qrData.round}</div>
                <div>Students marked via QR: {studentsVerified}</div>
            </div>
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
    qrContainer: {
        margin: '20px 0',
        transition: 'opacity 0.15s ease-in-out',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '240px'
    },
    placeholder: {
        color: '#888',
        fontSize: '1.2em'
    },
    shortcodeContainer: {
        margin: '15px 0'
    },
    label: {
        fontSize: '1em',
        color: '#555',
        marginRight: '10px'
    },
    shortcode: {
        fontSize: '2em',
        fontWeight: 'bold',
        letterSpacing: '5px'
    },
    hint: {
        fontSize: '0.8em',
        color: '#666',
        marginTop: '5px'
    },
    statsContainer: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.9em',
        color: '#777',
        marginTop: '15px'
    }
};

export default FacultyQRPanel;