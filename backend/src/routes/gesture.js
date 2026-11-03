const express = require('express');
const rateLimit = require('express-rate-limit');
const gestureService = require('../services/gestureService');

const router = express.Router();

const gestureRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: 'Too many requests, please try again later.' },
});

router.post('/challenge', gestureRateLimiter, async (req, res) => {
    try {
        const { studentId, sessionId } = req.body || {};
        if (!studentId || !sessionId) {
            return res.status(400).json({ error: 'Missing required parameters.' });
        }

        const issued = await gestureService.issueChallenge({ studentId, sessionId });
        if (!issued.ok) {
            return res.status(409).json({ reason: issued.reason });
        }
        return res.status(201).json(issued.challenge);
    } catch (error) {
        console.error('Gesture challenge error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/verify', gestureRateLimiter, async (req, res) => {
    try {
        const { studentId, sessionId, challengeId, trace, clientInfo } = req.body || {};
        if (!studentId || !sessionId || !challengeId) {
            return res.status(400).json({ error: 'Missing required parameters.' });
        }

        const result = await gestureService.submitTrace({ studentId, sessionId, challengeId, trace, clientInfo });
        return res.json(result);
    } catch (error) {
        console.error('Gesture verification error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
