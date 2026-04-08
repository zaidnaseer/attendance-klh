-- Migration 002: QR Location Verification System

CREATE TABLE IF NOT EXISTS qr_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_id VARCHAR(255) UNIQUE NOT NULL,
    session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    shortcode VARCHAR(6) NOT NULL,
    round INTEGER NOT NULL,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    used_by UUID REFERENCES students(id) ON DELETE SET NULL,
    used_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS qr_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_id VARCHAR(255) REFERENCES qr_tokens(token_id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    result VARCHAR(50) NOT NULL, -- VALID | INVALID_TOKEN | TOKEN_EXPIRED | TOKEN_ALREADY_USED | NOT_ENROLLED
    method VARCHAR(50) NOT NULL  -- qr_scan | shortcode
);

CREATE INDEX IF NOT EXISTS idx_qr_tokens_session_shortcode ON qr_tokens(session_id, shortcode);
CREATE INDEX IF NOT EXISTS idx_qr_attempts_session_student ON qr_attempts(session_id, student_id);

ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS ble_passed BOOLEAN DEFAULT false;
ALTER TABLE attendance_records ADD COLUMN IF NOT EXISTS ble_method VARCHAR(50);
