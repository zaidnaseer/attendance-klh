// Client side of the gesture liveness check.
//
// Thresholds are NOT defined here: the server sends them with every challenge
// (see backend/src/services/gestureService.js) so client and server always agree.
// GestureTracker is an incremental version of the server's scanGesture(); keep the
// two in sync. The server remains authoritative -- it re-validates the uploaded trace.

const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));
const round3 = (value) => Math.round(value * 1000) / 1000;

function scoreOf(blendshapes, name) {
    const category = blendshapes?.categories?.find((c) => c.categoryName === name);
    return category ? category.score : 0;
}

// MediaPipe FaceLandmarker result -> compact per-frame features (see server for definitions)
export function extractFeatures(result) {
    const faces = result?.faceLandmarks?.length || 0;
    if (faces === 0) {
        return { faces: 0, blink: 0, smile: 0, jaw: 0, turn: 0 };
    }

    const shapes = result.faceBlendshapes?.[0];
    const landmarks = result.faceLandmarks[0];

    // Landmarks 1 (nose tip), 234 / 454 (cheek edges) are in the raw, un-mirrored camera frame.
    // Positive turn = the user turned toward THEIR left (which is image-right in the raw frame).
    const width = landmarks[454].x - landmarks[234].x;
    const turn = width > 1e-4 ? clamp(2 * ((landmarks[1].x - landmarks[234].x) / width - 0.5), -1, 1) : 0;

    return {
        faces,
        blink: round3((scoreOf(shapes, 'eyeBlinkLeft') + scoreOf(shapes, 'eyeBlinkRight')) / 2),
        smile: round3((scoreOf(shapes, 'mouthSmileLeft') + scoreOf(shapes, 'mouthSmileRight')) / 2),
        jaw: round3(scoreOf(shapes, 'jawOpen')),
        turn: round3(turn),
    };
}

/**
 * Feeds frames through the ordered challenge. `gestures` is the array from the server
 * challenge: [{ id, label, signal, direction, activeAt, neutralAt, minActiveMs, reps }].
 */
export class GestureTracker {
    constructor(gestures, timeLimitMs) {
        this.gestures = gestures;
        this.timeLimitMs = timeLimitMs;
        this.index = 0;
        this.startT = null;
        this.resetCycle();
        this.status = 'running'; // running | done | timeout
    }

    resetCycle() {
        this.armed = false;
        this.runStartT = null;
        this.lastActiveT = null;
        this.cycles = 0;
    }

    get current() {
        return this.gestures[this.index] || null;
    }

    // Returns true when anything the UI shows (current gesture / cycle count / status) changed.
    push(frame) {
        if (this.status !== 'running') return false;
        if (this.startT === null) this.startT = frame.t;

        if (frame.t - this.startT > this.timeLimitMs) {
            this.status = 'timeout';
            return true;
        }

        const rule = this.current;
        if (frame.faces !== 1) {
            this.armed = false;
            this.runStartT = null;
            return false;
        }

        const value = frame[rule.signal] * rule.direction;
        if (value <= rule.neutralAt) {
            let changed = false;
            if (this.runStartT !== null && this.lastActiveT - this.runStartT >= rule.minActiveMs) {
                this.cycles += 1;
                changed = true;
                if (this.cycles >= rule.reps) {
                    this.index += 1;
                    this.startT = frame.t;
                    this.resetCycle();
                    if (this.index >= this.gestures.length) this.status = 'done';
                    return true;
                }
            }
            this.runStartT = null;
            this.armed = true;
            return changed;
        }
        if (value >= rule.activeAt) {
            if (this.runStartT === null && this.armed) this.runStartT = frame.t;
            if (this.runStartT !== null) this.lastActiveT = frame.t;
        }
        return false;
    }
}
