-- Migration 004: Gesture-based liveness check (optional, independent of qr/gps mode)

-- Faculty toggle per course, snapshotted onto the session when it starts
ALTER TABLE courses ADD COLUMN IF NOT EXISTS gesture_required BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS gesture_required BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS gesture_passed BOOLEAN DEFAULT false;

-- One row per issued challenge. Doubles as the attempt log used for offline evaluation:
-- the raw per-frame feature trace is kept so the validator can be replayed against other thresholds.
CREATE TABLE IF NOT EXISTS gesture_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    gestures TEXT[] NOT NULL,                 -- ordered challenge, e.g. {blink,turn_left}
    config JSONB NOT NULL,                    -- thresholds / time limits in force when issued
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE,
    result VARCHAR(50),                       -- VALID | GESTURE_NOT_PERFORMED | CHALLENGE_EXPIRED | ... (NULL = pending)
    gesture_timings JSONB,                    -- per-gesture completion times (ms) when passed
    frame_count INTEGER,
    trace JSONB,                              -- [{t,faces,blink,smile,jaw,turn}, ...]
    client_info JSONB                         -- user agent, camera resolution, detector fps
);

CREATE INDEX IF NOT EXISTS idx_gesture_challenges_session_student ON gesture_challenges(session_id, student_id);
