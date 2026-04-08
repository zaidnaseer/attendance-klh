const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { pool } = require('../db/client');

const QR_SECRET = process.env.QR_SECRET || 'dev_secret_change_me';
const ROTATION_SEC = 30;

class QrService {
    constructor() {
        this.io = null;
        this.timers = new Map(); 
        this.rounds = new Map();
    }

    setSocketIo(io) {
        this.io = io;
    }

    async startSessionRotation(sessionId) {
        if (this.timers.has(sessionId)) return;

        this.rounds.set(sessionId, 1);
        
        // Initial token
        await this.rotateTokens(sessionId);

        // Schedule rotation
        const timer = setInterval(() => {
            this.rotateTokens(sessionId);
        }, ROTATION_SEC * 1000);

        this.timers.set(sessionId, timer);
    }

    async stopSessionRotation(sessionId) {
        const timer = this.timers.get(sessionId);
        if (timer) {
            clearInterval(timer);
            this.timers.delete(sessionId);
            this.rounds.delete(sessionId);
        }

        // Invalidate all active tokens for this session
        try {
            await pool.query(
                `UPDATE qr_tokens SET is_active = false WHERE session_id = $1 AND is_active = true`,
                [sessionId]
            );
        } catch (error) {
            console.error('Error stopping session rotation:', error);
        }
    }

    async generateToken(sessionId) {
        const tokenId = uuidv4();
        const round = this.rounds.get(sessionId) || 1;
        this.rounds.set(sessionId, round + 1);

        const iat = Math.floor(Date.now() / 1000);
        const exp = iat + ROTATION_SEC;

        const payload = { sessionId, tokenId, round, iat, exp };
        const tokenJwt = jwt.sign(payload, QR_SECRET);

        // Generate 6 digit shortcode from uuid
        const shortcode = String(parseInt(tokenId.slice(0, 5), 16) % 1000000).padStart(6, '0');
        const expiresAt = new Date(exp * 1000);

        try {
            await pool.query(
                `INSERT INTO qr_tokens (token_id, session_id, shortcode, round, expires_at)
                 VALUES ($1, $2, $3, $4, $5)`,
                [tokenId, sessionId, shortcode, round, expiresAt]
            );
            return { jwt: tokenJwt, shortcode, expiresAt, round };
        } catch (error) {
            console.error('Error in generateToken:', error);
            throw error;
        }
    }

    async getCurrentState(sessionId) {
        try {
            const res = await pool.query(
                `SELECT token_id as jwt, shortcode, expires_at, round 
                 FROM qr_tokens 
                 WHERE session_id = $1 AND is_active = true 
                 ORDER BY issued_at DESC LIMIT 1`,
                [sessionId]
            );
            
            if (res.rowCount === 0) return null;
            
            const data = res.rows[0];
            
            // Note: Since we only store token_id locally, we need to reconstruct the JWT 
            // for the faculty panel if they refresh. 
            // But actually we have token_id, maybe we should've stored the full JWT?
            // Re-sign it to give them the full JWT:
            const iat = Math.floor(new Date(data.expires_at).getTime() / 1000) - ROTATION_SEC;
            const exp = Math.floor(new Date(data.expires_at).getTime() / 1000);
            const tokenJwt = jwt.sign({ 
                sessionId, 
                tokenId: data.jwt, 
                round: data.round, 
                iat, 
                exp 
            }, QR_SECRET);

            return {
                jwt: tokenJwt,
                shortcode: data.shortcode,
                expiresAt: new Date(data.expires_at).getTime(),
                round: data.round
            };
        } catch (error) {
            console.error('Error getting current state:', error);
            return null;
        }
    }

    async rotateTokens(sessionId) {
        try {
            // Deactivate previous active tokens
            await pool.query(
                `UPDATE qr_tokens SET is_active = false WHERE session_id = $1 AND is_active = true`,
                [sessionId]
            );

            const tokenData = await this.generateToken(sessionId);
            
            // Emit to faculty showing QR code
            if (this.io) {
                this.io.to(`faculty-${sessionId}`).emit('qr-rotate', {
                    jwt: tokenData.jwt,
                    shortcode: tokenData.shortcode,
                    expiresAt: tokenData.expiresAt.getTime(),
                    round: tokenData.round
                });

                // Emit to students waiting on page
                this.io.to(`session-${sessionId}`).emit('code-rotate', {
                    shortcode: tokenData.shortcode, // Optional depending on UI choices
                    expiresAt: tokenData.expiresAt.getTime()
                });
            }
        } catch (error) {
            console.error(`Error rotating token for session ${sessionId}:`, error);
        }
    }

    async validateToken(input, studentId, sessionId) {
        let tokenIdToLog = null;
        let method = 'qr_scan';

        try {
            let actualSessionId, parsedTokenId;

            // 1. Determine Input Type
            if (input.length === 6 && !input.includes('.')) {
                method = 'shortcode';
                // Lookup by shortcode
                const res = await pool.query(
                    `SELECT token_id, is_active, expires_at, used_by FROM qr_tokens 
                     WHERE session_id = $1 AND shortcode = $2 ORDER BY issued_at DESC LIMIT 1`,
                    [sessionId, input]
                );
                
                if (res.rowCount === 0) {
                    return this.logAttemptAndReturn(null, studentId, sessionId, method, 'INVALID_TOKEN');
                }
                tokenIdToLog = res.rows[0].token_id;
                
                if (!res.rows[0].is_active || new Date() > res.rows[0].expires_at) {
                    return this.logAttemptAndReturn(tokenIdToLog, studentId, sessionId, method, 'TOKEN_EXPIRED');
                }
                if (res.rows[0].used_by) {
                    return this.logAttemptAndReturn(tokenIdToLog, studentId, sessionId, method, 'TOKEN_ALREADY_USED');
                }

            } else {
                // QR scan (JWT string)
                try {
                    const decoded = jwt.verify(input, QR_SECRET);
                    parsedTokenId = decoded.tokenId;
                    actualSessionId = decoded.sessionId;
                    tokenIdToLog = parsedTokenId;
                    
                    if (actualSessionId !== sessionId) {
                        return this.logAttemptAndReturn(tokenIdToLog, studentId, sessionId, method, 'INVALID_TOKEN');
                    }
                } catch (err) {
                    return this.logAttemptAndReturn(null, studentId, sessionId, method, err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN');
                }

                const res = await pool.query(
                    `SELECT is_active, expires_at, used_by FROM qr_tokens WHERE token_id = $1 AND session_id = $2`,
                    [parsedTokenId, sessionId]
                );

                if (res.rowCount === 0) {
                    return this.logAttemptAndReturn(parsedTokenId, studentId, sessionId, method, 'INVALID_TOKEN');
                }
                if (!res.rows[0].is_active || new Date() > res.rows[0].expires_at) {
                    return this.logAttemptAndReturn(parsedTokenId, studentId, sessionId, method, 'TOKEN_EXPIRED');
                }
                if (res.rows[0].used_by) {
                    return this.logAttemptAndReturn(parsedTokenId, studentId, sessionId, method, 'TOKEN_ALREADY_USED');
                }
            }

            // Verify enrollment
            const enrollRes = await pool.query(
                `SELECT cs.id FROM course_students cs
                 JOIN attendance_sessions asess ON asess.course_id = cs.course_id
                 WHERE cs.student_id = $1 AND asess.id = $2`,
                [studentId, sessionId]
            );

            if (enrollRes.rowCount === 0) {
                return this.logAttemptAndReturn(tokenIdToLog, studentId, sessionId, method, 'NOT_ENROLLED');
            }

            // Check if already passed
            const attendRes = await pool.query(
                `SELECT id, ble_passed FROM attendance_records 
                 WHERE student_id = $1 AND session_id = $2`,
                [studentId, sessionId]
            );

            if (attendRes.rowCount > 0 && attendRes.rows[0].ble_passed) {
                return this.logAttemptAndReturn(tokenIdToLog, studentId, sessionId, method, 'ALREADY_PASSED');
            }

            // Success! Update token
            await pool.query(
                `UPDATE qr_tokens SET used_by = $1, used_at = CURRENT_TIMESTAMP WHERE token_id = $2`,
                [studentId, tokenIdToLog]
            );

            // Update attendance record (Gate 1 passed)
            if (attendRes.rowCount > 0) {
                await pool.query(
                    `UPDATE attendance_records SET ble_passed = true, ble_method = 'qr' WHERE id = $1`,
                    [attendRes.rows[0].id]
                );
            } else {
                await pool.query(
                    `INSERT INTO attendance_records (session_id, student_id, status, ble_passed, ble_method) VALUES ($1, $2, 'qr_verified', true, 'qr')`,
                    [sessionId, studentId]
                );
            }

            this.logAttemptAndReturn(tokenIdToLog, studentId, sessionId, method, 'VALID');

            // Optionally alert faculty that a student passed gate 1
            if (this.io) {
                const countRes = await pool.query(
                    `SELECT COUNT(*) as count FROM attendance_records WHERE session_id = $1 AND ble_passed = true`,
                    [sessionId]
                );
                this.io.to(`faculty-${sessionId}`).emit('gate1-stats', { count: countRes.rows[0].count });
            }

            return { valid: true };

        } catch (error) {
            console.error('Validation error:', error);
            throw error;
        }
    }

    async logAttemptAndReturn(tokenId, studentId, sessionId, method, result) {
        try {
            await pool.query(
                `INSERT INTO qr_attempts (token_id, student_id, session_id, method, result)
                 VALUES ($1, $2, $3, $4, $5)`,
                [tokenId, studentId, sessionId, method, result]
            );
        } catch (error) {
            console.error('Log attempt error (non-fatal):', error);
        }
        return { valid: result === 'VALID', reason: result };
    }

    emitToFaculty(sessionId, event, data) {
        if (this.io) {
            this.io.to(`faculty-${sessionId}`).emit(event, data);
        }
    }
}

module.exports = new QrService();
