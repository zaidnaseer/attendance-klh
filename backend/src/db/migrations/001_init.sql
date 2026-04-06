CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  student_code VARCHAR(100) UNIQUE NOT NULL,
  enrolled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS face_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  pose VARCHAR(20) NOT NULL,
  embedding vector(512) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Recognition query:
-- SELECT s.id, s.name, s.student_code,
--        1 - (fe.embedding <=> $1::vector) AS similarity
-- FROM face_embeddings fe JOIN students s ON s.id = fe.student_id
-- ORDER BY similarity DESC LIMIT 5;
