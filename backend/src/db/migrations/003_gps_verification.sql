-- Migration 003: GPS Location Verification

-- Single-row table holding the institution's location (id is always 1)
CREATE TABLE IF NOT EXISTS institution_settings (
    id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    name VARCHAR(255),
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    radius_meters INTEGER NOT NULL DEFAULT 200 CHECK (radius_meters > 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Faculty-selected verification method per course: qr | gps | both
ALTER TABLE courses ADD COLUMN IF NOT EXISTS verification_mode VARCHAR(10) NOT NULL DEFAULT 'qr'
    CHECK (verification_mode IN ('qr', 'gps', 'both'));

-- Snapshot of the course's method at the time the session was started
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS verification_mode VARCHAR(10) NOT NULL DEFAULT 'qr'
    CHECK (verification_mode IN ('qr', 'gps', 'both'));

ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS gps_passed BOOLEAN DEFAULT false;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS gps_distance_m DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS gps_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    accuracy_m DOUBLE PRECISION,
    distance_m DOUBLE PRECISION,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    result VARCHAR(50) NOT NULL -- VALID | OUT_OF_RANGE | LOW_ACCURACY | NOT_ENROLLED | ...
);

CREATE INDEX IF NOT EXISTS idx_gps_attempts_session_student ON gps_attempts(session_id, student_id);
