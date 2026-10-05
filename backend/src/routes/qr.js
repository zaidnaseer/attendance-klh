const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const qrService = require('../services/qrService');
const { pool } = require('../db/client');

const qrRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute
    message: { error: 'Too many requests, please try again later.' }
});

router.post('/validate', qrRateLimiter, async (req, res) => {
    try {
        const { token, studentId, sessionId } = req.body;
        
        if (!token || !studentId || !sessionId) {
            return res.status(400).json({ error: 'Missing required parameters.' });
        }

        const validation = await qrService.validateToken(token, studentId, sessionId);
        
        res.json({
            valid: validation.valid,
            reason: validation.reason,
            nextGate: validation.valid ? 'anti-spoof' : null
        });
    } catch (error) {
        console.error('Validation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/current/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const currentData = await qrService.getCurrentState(sessionId);
        
        if (!currentData) {
            return res.status(404).json({ error: 'Active session not found or not rotating QR.' });
        }
        
        res.json(currentData);
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/stats/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { rows } = await pool.query(
            'SELECT COUNT(*)::int AS verified FROM attendance_records WHERE session_id = $1 AND ble_passed = true',
            [sessionId],
        );
        res.json({ verified: rows[0].verified });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
