const { pool } = require('../db/client');
const qrService = require('./qrService');

const VERIFICATION_MODES = ['qr', 'gps', 'both'];
const EARTH_RADIUS_M = 6371000;
const DEFAULT_MAX_ACCURACY_M = 150;

function requiresQr(mode) {
    return mode === 'qr' || mode === 'both';
}

function requiresGps(mode) {
    return mode === 'gps' || mode === 'both';
}

function isValidMode(mode) {
    return VERIFICATION_MODES.includes(mode);
}

function isValidLatitude(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLongitude(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= -180 && value <= 180;
}

function getMaxAccuracy() {
    const parsed = Number(process.env.GPS_MAX_ACCURACY_M);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_MAX_ACCURACY_M;
    }
    return parsed;
}

// Great-circle distance in meters between two lat/lng points
function haversineDistance(lat1, lng1, lat2, lng2) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

async function getInstitution(db = pool) {
    const result = await db.query(
        'SELECT name, latitude, longitude, radius_meters, updated_at FROM institution_settings WHERE id = 1',
    );
    return result.rows[0] || null;
}

async function logAttemptAndReturn(studentId, sessionId, position, distance, result, extra = {}) {
    try {
        await pool.query(
            `INSERT INTO gps_attempts (student_id, session_id, latitude, longitude, accuracy_m, distance_m, result)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [studentId, sessionId, position.latitude, position.longitude, position.accuracy, distance, result],
        );
    } catch (error) {
        console.error('GPS log attempt error (non-fatal):', error);
    }
    return { valid: result === 'VALID' || result === 'ALREADY_PASSED', reason: result, ...extra };
}

async function validateLocation({ studentId, sessionId, latitude, longitude, accuracy }) {
    const position = { latitude, longitude, accuracy: Number.isFinite(accuracy) ? accuracy : null };

    const sessionResult = await pool.query(
        'SELECT id, course_id, is_active, verification_mode FROM attendance_sessions WHERE id = $1',
        [sessionId],
    );
    const session = sessionResult.rows[0];

    if (!session || !session.is_active) {
        return { valid: false, reason: 'SESSION_NOT_ACTIVE' };
    }
    if (!requiresGps(session.verification_mode)) {
        return { valid: false, reason: 'GPS_NOT_REQUIRED' };
    }

    const enrollResult = await pool.query(
        'SELECT id FROM course_students WHERE course_id = $1 AND student_id = $2',
        [session.course_id, studentId],
    );
    if (enrollResult.rowCount === 0) {
        return logAttemptAndReturn(studentId, sessionId, position, null, 'NOT_ENROLLED');
    }

    const existing = await pool.query(
        'SELECT id, gps_passed FROM attendance_records WHERE session_id = $1 AND student_id = $2',
        [sessionId, studentId],
    );
    if (existing.rows[0]?.gps_passed) {
        return { valid: true, reason: 'ALREADY_PASSED' };
    }

    const institution = await getInstitution();
    if (!institution) {
        return { valid: false, reason: 'GPS_NOT_CONFIGURED' };
    }

    const radius = institution.radius_meters;
    const distance = haversineDistance(latitude, longitude, institution.latitude, institution.longitude);
    const roundedDistance = Math.round(distance);

    const maxAccuracy = getMaxAccuracy();
    if (position.accuracy !== null && position.accuracy > maxAccuracy) {
        return logAttemptAndReturn(studentId, sessionId, position, distance, 'LOW_ACCURACY', {
            accuracy: Math.round(position.accuracy),
            maxAccuracy,
        });
    }

    if (distance > radius) {
        return logAttemptAndReturn(studentId, sessionId, position, distance, 'OUT_OF_RANGE', {
            distance: roundedDistance,
            radius,
        });
    }

    await pool.query(
        `INSERT INTO attendance_records (session_id, student_id, status, gps_passed, gps_distance_m)
         VALUES ($1, $2, 'gps_verified', true, $3)
         ON CONFLICT (session_id, student_id) DO UPDATE SET gps_passed = true, gps_distance_m = EXCLUDED.gps_distance_m`,
        [sessionId, studentId, distance],
    );

    const result = await logAttemptAndReturn(studentId, sessionId, position, distance, 'VALID', {
        distance: roundedDistance,
        radius,
    });

    const count = await getPassedCount(sessionId);
    qrService.emitToFaculty(sessionId, 'gps-stats', { count });

    return result;
}

async function getPassedCount(sessionId) {
    const result = await pool.query(
        'SELECT COUNT(*)::int AS count FROM attendance_records WHERE session_id = $1 AND gps_passed = true',
        [sessionId],
    );
    return result.rows[0].count;
}

module.exports = {
    VERIFICATION_MODES,
    requiresQr,
    requiresGps,
    isValidMode,
    isValidLatitude,
    isValidLongitude,
    haversineDistance,
    getInstitution,
    validateLocation,
    getPassedCount,
};
