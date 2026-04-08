require('dotenv').config();

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const studentsRouter = require('./routes/students');
const enrollRouter = require('./routes/enroll');
const verifyRouter = require('./routes/verify');
const adminRouter = require('./routes/admin');
const facultyRouter = require('./routes/faculty');
const studentDashboardRouter = require('./routes/studentDashboard');
const { migrate } = require('./db/migrate');

const app = express();
const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';

app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '1mb' }));

const enrollLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/enroll', enrollLimiter, enrollRouter);
app.use('/api/verify', verifyLimiter, verifyRouter);
app.use('/api/students', studentsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/faculty', facultyRouter);
app.use('/api/student', studentDashboardRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use((error, _req, res, _next) => {
  if (error && error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ code: 'FILE_TOO_LARGE', message: 'File too large' });
  }
  if (error && error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({ code: 'INVALID_UPLOAD', message: 'Unexpected file field' });
  }
  if (error && error.message === 'INVALID_FILE_TYPE') {
    return res.status(400).json({ code: 'INVALID_FILE_TYPE', message: 'Only JPEG and PNG are allowed' });
  }
  console.error(error);
  return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Unexpected server error' });
});

const port = Number(process.env.PORT || 4000);

async function bootstrap() {
  await migrate();
  app.listen(port, () => {
    console.log(`Backend listening on ${port}`);
  });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
