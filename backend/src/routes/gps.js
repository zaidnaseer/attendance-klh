const express = require('express');
const rateLimit = require('express-rate-limit');
const gpsService = require('../services/gpsService');

const router = express.Router();

const gpsRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute
    message: { error: 'Too many requests, please try again later.' },
});

router.post('/validate', gpsRateLimiter, async (req, res) => {
    try {
        const { studentId, sessionId, latitude, longitude, accuracy } = req.body || {};

        if (!studentId || !sessionId) {
            return res.status(400).json({ error: 'Missing required parameters.' });
        }
        if (!gpsService.isValidLatitude(latitude) || !gpsService.isValidLongitude(longitude)) {
            return res.status(400).json({ valid: false, reason: 'INVALID_COORDINATES' });
        }

        const validation = await gpsService.validateLocation({
            studentId,
            sessionId,
            latitude,
            longitude,
            accuracy: Number(accuracy),
        });

        return res.json(validation);
    } catch (error) {
        console.error('GPS validation error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/stats/:sessionId', async (req, res) => {
    try {
        const count = await gpsService.getPassedCount(req.params.sessionId);
        return res.json({ count });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
