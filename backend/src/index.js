require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const studentsRouter = require('./routes/students');
const enrollRouter = require('./routes/enroll');
const verifyRouter = require('./routes/verify');
const adminRouter = require('./routes/admin');
const facultyRouter = require('./routes/faculty');
const studentDashboardRouter = require('./routes/studentDashboard');
const qrRouter = require('./routes/qr');
const qrService = require('./services/qrService');
const { migrate } = require('./db/migrate');

const app = express();
const server = http.createServer(app);

const allowedOrigin = process.env.FRONTEND_URL || 'http://10.232.2.237:3000';      
const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST']
  }
});
qrService.setSocketIo(io);

io.on('connection', (socket) => {
  socket.on('join-faculty', (sessionId) => {
    socket.join(`faculty-${sessionId}`);
  });
  socket.on('join-session', (sessionId) => {
    socket.join(`session-${sessionId}`);
  });
});

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

app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '1mb' }));

app.use('/api/enroll', enrollLimiter, enrollRouter);
app.use('/api/verify', verifyLimiter, verifyRouter);
app.use('/api/students', studentsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/faculty', facultyRouter);
app.use('/api/student', studentDashboardRouter);
app.use('/api/qr', qrRouter);

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
const { pool } = require('./db/client');

async function bootstrap() {
  await migrate();
  
  // Resume QR rotation for active sessions
  const activeSessions = await pool.query('SELECT id FROM attendance_sessions WHERE is_active = TRUE');
  for (const session of activeSessions.rows) {
    qrService.startSessionRotation(session.id);
  }

  server.listen(port, () => {
    console.log(`Backend listening on ${port}`);
  });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
