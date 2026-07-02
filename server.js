require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const connectDB = require('./src/config/database');

const driverRoutes = require('./src/routes/driver.routes');
const parentRoutes = require('./src/routes/parent.routes');
const authRoutes = require('./src/routes/auth.route');
const adminRoutes = require('./src/routes/admin.route');
const rideRoutes = require('./src/routes/ride.routes');

const app = express();

connectDB();

app.use(cors());

app.use(helmet());

app.use(morgan('dev'));

app.use(express.json());

// Routes

app.use('/api/auth', authRoutes);

app.use('/api/drivers', driverRoutes);

app.use('/api/parents', parentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/rides',rideRoutes);


const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});