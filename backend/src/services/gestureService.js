const crypto = require('crypto');
const { pool } = require('../db/client');

/*
 * Gesture-based liveness (optional per course, like QR and GPS).
 *
 * Flow:  issueChallenge()  -> server picks a random ordered list of gestures
 *        client performs them while MediaPipe Face Landmarker runs on-device
 *        submitTrace()     -> client uploads a compact per-frame feature trace;
 *                             the server re-runs the same state machine over it,
 *                             logs the attempt and sets attendance_records.gesture_passed.
 *
 * The thresholds below are the single source of truth: they are sent to the client
 * with every challenge, so both sides apply identical values. validateTrace() is pure
 * so the same code can replay logged traces under different thresholds (evaluation).
 *
 * Per-frame features (all unitless):
 *   blink  mean(eyeBlinkLeft, eyeBlinkRight)        0..1
 *   smile  mean(mouthSmileLeft, mouthSmileRight)    0..1
 *   jaw    jawOpen                                  0..1
 *   turn   2 * ((noseX - cheekL) / (cheekR - cheekL) - 0.5)   -1..1, positive = user's LEFT
 *          (landmarks 1, 234, 454 of the raw, un-mirrored camera frame)
 */

const GESTURES = {
    blink: {
        label: 'Blink twice',
        signal: 'blink', direction: 1, activeAt: 0.35, neutralAt: 0.25, minActiveMs: 0, reps: 2,
    },
    smile: {
        label: 'Smile',
        signal: 'smile', direction: 1, activeAt: 0.5, neutralAt: 0.25, minActiveMs: 300, reps: 1,
    },
    mouth_open: {
        label: 'Open your mouth',
        signal: 'jaw', direction: 1, activeAt: 0.5, neutralAt: 0.2, minActiveMs: 300, reps: 1,
    },
    turn_left: {
        label: 'Turn your head to your left',
        signal: 'turn', direction: 1, activeAt: 0.3, neutralAt: 0.15, minActiveMs: 300, reps: 1,
    },
    turn_right: {
        label: 'Turn your head to your right',
        signal: 'turn', direction: -1, activeAt: 0.3, neutralAt: 0.15, minActiveMs: 300, reps: 1,
    },
};

const GESTURE_IDS = Object.keys(GESTURES);

const MAX_FRAMES = 1500;
const MIN_FRAMES = 10;
const MIN_SPAN_MS = 500;
const MAX_MEDIAN_FRAME_GAP_MS = 250;
const MIN_SINGLE_FACE_RATIO = 0.8;
const MAX_MULTI_FACE_RATIO = 0.05;
const CLOCK_TOLERANCE_MS = 2000;
const START_GRACE_MS = 20000; // camera start-up + reading the prompt
const SUBMIT_GRACE_MS = 5000;

function envNumber(name, fallback, { min = 0, max = Infinity, integer = false } = {}) {
    const parsed = Number(process.env[name]);
    if (!Number.isFinite(parsed) || parsed < min || parsed > max) return fallback;
    return integer ? Math.floor(parsed) : parsed;
}

function getConfig() {
    return {
        count: envNumber('GESTURE_COUNT', 2, { min: 1, max: GESTURE_IDS.length, integer: true }),
        timeLimitMs: envNumber('GESTURE_TIME_LIMIT_MS', 8000, { min: 2000, max: 30000, integer: true }),
    };
}

function thresholdsFor(ids) {
    const out = {};
    for (const id of ids) {
        const { signal, direction, activeAt, neutralAt, minActiveMs, reps } = GESTURES[id];
        out[id] = { signal, direction, activeAt, neutralAt, minActiveMs, reps };
    }
    return out;
}

function pickGestures(count) {
    const pool_ = [...GESTURE_IDS];
    const picked = [];
    while (picked.length < count && pool_.length > 0) {
        picked.push(pool_.splice(crypto.randomInt(pool_.length), 1)[0]);
    }
    return picked;
}

function isGestureRequired(session) {
    return Boolean(session && session.gesture_required);
}

// ---------------------------------------------------------------------------
// Pure validation
// ---------------------------------------------------------------------------

function clamp(value, lo, hi) {
    return Math.min(hi, Math.max(lo, value));
}

function sanitizeTrace(raw) {
    if (!Array.isArray(raw) || raw.length < MIN_FRAMES || raw.length > MAX_FRAMES) {
        return null;
    }
    const frames = [];
    let previousT = -Infinity;
    for (const item of raw) {
        if (!item || typeof item !== 'object') return null;
        const { t, faces, blink, smile, jaw, turn } = item;
        if (![t, faces, blink, smile, jaw, turn].every((v) => typeof v === 'number' && Number.isFinite(v))) {
            return null;
        }
        if (t < previousT || t < 0) return null;
        previousT = t;
        frames.push({
            t,
            faces: clamp(Math.round(faces), 0, 10),
            blink: clamp(blink, 0, 1),
            smile: clamp(smile, 0, 1),
            jaw: clamp(jaw, 0, 1),
            turn: clamp(turn, -1, 1),
        });
    }
    return frames;
}

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Looks for `reps` neutral -> active(held >= minActiveMs) -> neutral cycles of one gesture,
 * beginning at frames[startIdx] and finishing no later than startT + timeLimitMs.
 * Starting from a neutral frame is required, so a pose already held at the start of the
 * window does not count. A frame without exactly one face breaks the current cycle.
 */
function scanGesture(frames, startIdx, startT, rule, timeLimitMs) {
    let armed = false;
    let runStartT = null;
    let lastActiveT = null;
    let cycles = 0;

    for (let i = startIdx; i < frames.length; i += 1) {
        const frame = frames[i];
        if (frame.t - startT > timeLimitMs) break;

        if (frame.faces !== 1) {
            armed = false;
            runStartT = null;
            continue;
        }

        const value = frame[rule.signal] * rule.direction;
        if (value <= rule.neutralAt) {
            if (runStartT !== null && lastActiveT - runStartT >= rule.minActiveMs) {
                cycles += 1;
                if (cycles >= rule.reps) {
                    return { done: true, endIdx: i + 1, endT: frame.t };
                }
            }
            runStartT = null;
            armed = true;
        } else if (value >= rule.activeAt) {
            if (runStartT === null && armed) {
                runStartT = frame.t;
            }
            if (runStartT !== null) {
                lastActiveT = frame.t;
            }
        }
        // between neutralAt and activeAt: hysteresis zone, state unchanged
    }
    return { done: false };
}

/**
 * @param {Array} rawTrace   [{t, faces, blink, smile, jaw, turn}], t in ms from challenge start
 * @param {string[]} gestures ordered challenge
 * @param {{timeLimitMs:number}} config
 * @param {{elapsedMs?:number}} [context] server-side elapsed time since issuing (optional)
 */
function validateTrace(rawTrace, gestures, config, context = {}) {
    const frames = sanitizeTrace(rawTrace);
    if (!frames) return { valid: false, reason: 'INVALID_TRACE' };

    const span = frames[frames.length - 1].t - frames[0].t;
    if (span < MIN_SPAN_MS) return { valid: false, reason: 'TRACE_TOO_SHORT' };

    if (Number.isFinite(context.elapsedMs) && span > context.elapsedMs + CLOCK_TOLERANCE_MS) {
        return { valid: false, reason: 'TRACE_TIMING_MISMATCH' };
    }

    const gaps = [];
    for (let i = 1; i < frames.length; i += 1) gaps.push(frames[i].t - frames[i - 1].t);
    if (median(gaps) > MAX_MEDIAN_FRAME_GAP_MS) return { valid: false, reason: 'FRAME_RATE_TOO_LOW' };

    const multi = frames.filter((f) => f.faces > 1).length / frames.length;
    if (multi > MAX_MULTI_FACE_RATIO) return { valid: false, reason: 'MULTIPLE_FACES' };
    const single = frames.filter((f) => f.faces === 1).length / frames.length;
    if (single < MIN_SINGLE_FACE_RATIO) return { valid: false, reason: 'FACE_LOST' };

    const timings = [];
    let idx = 0;
    let startT = frames[0].t;
    for (let g = 0; g < gestures.length; g += 1) {
        const rule = GESTURES[gestures[g]];
        if (!rule) return { valid: false, reason: 'INVALID_CHALLENGE' };
        const outcome = scanGesture(frames, idx, startT, rule, config.timeLimitMs);
        if (!outcome.done) {
            return { valid: false, reason: 'GESTURE_NOT_PERFORMED', failedIndex: g, failedGesture: gestures[g], timings };
        }
        timings.push({ gesture: gestures[g], completedAtMs: Math.round(outcome.endT - frames[0].t) });
        idx = outcome.endIdx;
        startT = outcome.endT;
    }

    return { valid: true, reason: 'VALID', timings, frameCount: frames.length, spanMs: Math.round(span) };
}

// ---------------------------------------------------------------------------
// Challenge lifecycle
// ---------------------------------------------------------------------------

function sanitizeClientInfo(info) {
    if (!info || typeof info !== 'object') return null;
    const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : null);
    return {
        userAgent: typeof info.userAgent === 'string' ? info.userAgent.slice(0, 300) : null,
        videoWidth: num(info.videoWidth),
        videoHeight: num(info.videoHeight),
        avgFps: num(info.avgFps),
    };
}

async function loadSession(sessionId) {
    const result = await pool.query(
        'SELECT id, course_id, is_active, gesture_required FROM attendance_sessions WHERE id = $1',
        [sessionId],
    );
    return result.rows[0] || null;
}

async function checkEligibility(studentId, sessionId) {
    const session = await loadSession(sessionId);
    if (!session || !session.is_active) return { error: 'SESSION_NOT_ACTIVE' };
    if (!isGestureRequired(session)) return { error: 'GESTURE_NOT_REQUIRED' };

    const enrolled = await pool.query(
        'SELECT id FROM course_students WHERE course_id = $1 AND student_id = $2',
        [session.course_id, studentId],
    );
    if (enrolled.rowCount === 0) return { error: 'NOT_ENROLLED' };

    return { session };
}

async function issueChallenge({ studentId, sessionId }) {
    const eligibility = await checkEligibility(studentId, sessionId);
    if (eligibility.error) return { ok: false, reason: eligibility.error };

    // Every attempt starts fresh: a pass from an earlier, abandoned attempt (e.g. the student
    // cancelled before marking attendance) must not carry over, so clear it before issuing.
    await pool.query(
        'UPDATE attendance_records SET gesture_passed = false WHERE session_id = $1 AND student_id = $2',
        [sessionId, studentId],
    );

    const config = getConfig();
    const gestures = pickGestures(config.count);
    const expiresAt = new Date(Date.now() + START_GRACE_MS + config.count * config.timeLimitMs + SUBMIT_GRACE_MS);
    const thresholds = thresholdsFor(gestures);

    const inserted = await pool.query(
        `INSERT INTO gesture_challenges (student_id, session_id, gestures, config, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, issued_at`,
        [studentId, sessionId, gestures, JSON.stringify({ ...config, thresholds }), expiresAt],
    );

    return {
        ok: true,
        challenge: {
            challengeId: inserted.rows[0].id,
            expiresAt,
            timeLimitMs: config.timeLimitMs,
            gestures: gestures.map((id) => ({ id, label: GESTURES[id].label, ...thresholds[id] })),
        },
    };
}

async function submitTrace({ studentId, sessionId, challengeId, trace, clientInfo }) {
    const eligibility = await checkEligibility(studentId, sessionId);
    if (eligibility.error) return { valid: false, reason: eligibility.error };

    const found = await pool.query(
        `SELECT id, gestures, config, issued_at, expires_at, result
         FROM gesture_challenges
         WHERE id = $1 AND student_id = $2 AND session_id = $3`,
        [challengeId, studentId, sessionId],
    );
    const challenge = found.rows[0];
    if (!challenge) return { valid: false, reason: 'CHALLENGE_NOT_FOUND' };
    if (challenge.result) return { valid: false, reason: 'CHALLENGE_ALREADY_USED' };

    const now = Date.now();
    const expired = now > new Date(challenge.expires_at).getTime();
    const outcome = expired
        ? { valid: false, reason: 'CHALLENGE_EXPIRED' }
        : validateTrace(trace, challenge.gestures, challenge.config, {
            elapsedMs: now - new Date(challenge.issued_at).getTime(),
        });

    // Single use: only the first submission may claim the challenge.
    const claimed = await pool.query(
        `UPDATE gesture_challenges
         SET submitted_at = NOW(), result = $2, gesture_timings = $3, frame_count = $4, trace = $5, client_info = $6
         WHERE id = $1 AND result IS NULL
         RETURNING id`,
        [
            challengeId,
            outcome.reason,
            outcome.timings ? JSON.stringify(outcome.timings) : null,
            Array.isArray(trace) ? trace.length : null,
            Array.isArray(trace) && trace.length <= MAX_FRAMES ? JSON.stringify(trace) : null,
            JSON.stringify(sanitizeClientInfo(clientInfo)),
        ],
    );
    if (claimed.rowCount === 0) return { valid: false, reason: 'CHALLENGE_ALREADY_USED' };

    if (!outcome.valid) {
        return {
            valid: false,
            reason: outcome.reason,
            failedGesture: outcome.failedGesture,
        };
    }

    await pool.query(
        `INSERT INTO attendance_records (session_id, student_id, status, gesture_passed)
         VALUES ($1, $2, 'gesture_verified', true)
         ON CONFLICT (session_id, student_id) DO UPDATE SET gesture_passed = true`,
        [sessionId, studentId],
    );

    return { valid: true, reason: 'VALID', timings: outcome.timings };
}

module.exports = {
    GESTURES,
    isGestureRequired,
    getConfig,
    validateTrace,
    issueChallenge,
    submitTrace,
};
