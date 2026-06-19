require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const connectDB = require('./src/config/database');

const driverRoutes = require('./src/routes/driver.routes');

const app = express();

connectDB();

app.use(cors());

app.use(helmet());

app.use(morgan('dev'));

app.use(express.json());

app.use('/api/drivers', driverRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});