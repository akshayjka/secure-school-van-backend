
const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  _id: false
});

const locationPointSchema = new mongoose.Schema({
  name: {
    type: String,
    default: ''
  },
  latitude: {
    type: Number,
    default: null
  },
  longitude: {
    type: Number,
    default: null
  }
}, {
  _id: false
});

const rideSchema = new mongoose.Schema({
  rideId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  driverId: {
    type: String,
    required: true,
    index: true
  },
  rideType: {
    type: String,
    enum: ['morning', 'evening'],
    required: true,
    index: true
  },
  rideDate: {
    type: String,
    match: /^\d{4}-\d{2}-\d{2}$/,
    default: undefined
  },
  cycleNumber: {
    type: Number,
    min: 1,
    default: 1,
    required: true
  },
  status: {
    type: String,
    enum: ['started', 'ended'],
    default: 'started',
    required: true,
    index: true
  },
  startTime: {
    type: Date,
    default: null,
    index: true
  },
  endTime: {
    type: Date,
    default: null
  },
  startLocation: {
    type: locationPointSchema,
    default: () => ({})
  },
  endLocation: {
    type: locationPointSchema,
    default: () => ({})
  },
  currentLatitude: {
    type: Number,
    default: null
  },
  currentLongitude: {
    type: Number,
    default: null
  },
  locations: {
    type: [locationSchema],
    default: []
  }
}, {
  timestamps: true
});

rideSchema.index({
  driverId: 1,
  rideType: 1,
  status: 1,
  startTime: -1
});

rideSchema.index({
  driverId: 1,
  rideType: 1,
  rideDate: 1,
  cycleNumber: 1
}, {
  unique: true,
  name: 'uniq_driver_ride_type_date_cycle'
});

rideSchema.index({
  driverId: 1,
  createdAt: -1
});

module.exports = mongoose.model('Ride', rideSchema);
