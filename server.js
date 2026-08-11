require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const http = require('http');
const { Server } = require('socket.io');

const connectDB = require('./src/config/database');

const authRoutes = require('./src/routes/auth.route');
const driverRoutes = require('./src/routes/driver.routes');
const parentRoutes = require('./src/routes/parent.routes');
const adminRoutes = require('./src/routes/admin.route');
const rideRoutes = require('./src/routes/ride.routes');
const app = express();
const server = http.createServer(app);
/**
 * ==========================================================
 * SOCKET.IO
 * ==========================================================
 */
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});
/**
 * Make io available everywhere
 */
app.set('io', io);
/**
 * ==========================================================
 * SOCKET CONNECTION
 * ==========================================================
 */
io.on('connection', (socket) => {
  console.log(`✅ Socket Connected : ${socket.id}`);
  /**
   * ======================================================
   * PARENT ROOM
   *
   * Room:
   * PAR123456
   *
   * Used for
   * Parent specific events
   * ======================================================
   */

socket.on(
  'joinParentAttendanceRoom',
  (parentId) => {

    if (!parentId) {
      return;
    }

    const room =
      `parent_attendance_${parentId}`;

    socket.join(room);

    console.log(
      `📅 Parent Attendance Room Joined: ${room}`
    );

  }
);
  socket.on('joinParentRoom', (parentId) => {
    if (!parentId) {
      return;
    }
    socket.join(parentId);
    console.log(`👨 Parent Joined Room : ${parentId}`);
  });

  /**
   * ======================================================
   * DRIVER ROOM
   *
   * Room:
   * DRV000001
   *
   * Used for
   * Driver specific events
   * ======================================================
   */
  socket.on('joinDriverRoom', (driverId) => {
    if (!driverId) {
      return;
    }
    socket.join(driverId);
    console.log(`🚌 Driver Joined Room : ${driverId}`);
  });

  
  socket.on('joinDriverChannel', (driverId) => {
    if (!driverId) {
      return;
    }
    const room = `driver_${driverId}`;
    socket.join(room);
    console.log(`🚍 Joined Driver Channel : ${room}`);
  });

  /**
   * ======================================================
   * PARENT CHANNEL
   *
   * Parent joins Driver Channel
   *
   * This allows parent to instantly receive
   * ride events
   * attendance updates
   * dashboard updates
   * ======================================================
   */
  socket.on('joinParentChannel', (driverId) => {
    if (!driverId) {
      return;
    }
    const room = `driver_${driverId}`;
    socket.join(room);
    console.log(`👨‍👩‍👧 Parent Joined Driver Channel : ${room}`);
  });
  /**
   * ======================================================
   * ADMIN ROOM
   * ======================================================
   */
  socket.on('joinAdminRoom', () => {
    socket.join('admins');
    console.log('👨‍💼 Admin Joined');
  });

  /**
   * ======================================================
   * DEBUG
   * ======================================================
   */

  socket.onAny((event) => {
    console.log(`📡 Socket Event : ${event}`);
  });

  /**
   * ======================================================
   * DISCONNECT
   * ======================================================
   */
  socket.on('disconnect', (reason) => {
    console.log(`❌ Socket Disconnected : ${socket.id}`);
    console.log(`Reason : ${reason}`);
  });

});

/**
 * ==========================================================
 * DATABASE
 * ==========================================================
 */

connectDB();

/**
 * ==========================================================
 * MIDDLEWARE
 * ==========================================================
 */

app.use(cors());

app.use(helmet());

app.use(morgan('dev'));

app.use(express.json());

/**
 * ==========================================================
 * ROUTES
 * ==========================================================
 */

app.use('/api/auth', authRoutes);

app.use('/api/drivers', driverRoutes);

app.use('/api/parents', parentRoutes);

app.use('/api/admin', adminRoutes);

app.use('/api/rides', rideRoutes);

/**
 * ==========================================================
 * HEALTH
 * ==========================================================
 */

app.get('/', (req, res) => {

  res.status(200).json({

    success: true,

    message: 'Secure School Van API is running'

  });

});

/**
 * ==========================================================
 * START SERVER
 * ==========================================================
 */

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {

  console.log(`🚀 Server running on port ${PORT}`);

});