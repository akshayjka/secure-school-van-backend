const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema(
{
  driverId: {
    type: String,
    unique: true
  },

  name: {
    type: String,
    required: true,
    trim: true
  },

  mobileNumber: {
    type: String,
    required: true,
    unique: true
  },

  vehicleNumber: {
    type: String,
    required: true
  },

  routeArea: {
    type: String,
    required: true
  },

  isVerified: {
    type: Boolean,
    default: false
  }
},
{
  timestamps: true
});

module.exports = mongoose.model('Driver', driverSchema);