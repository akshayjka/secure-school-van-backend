const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema(
  {

    rideId: {
      type: String,
      unique: true
    },

    driverId: {
      type: String,
      required: true
    },

    // NEW
    rideType: {
      type: String,
      enum: ['morning', 'evening'],
      required: true
    },

    status: {
      type: String,
      enum: ['started', 'ended'],
      default: 'started'
    },

    startTime: {
      type: Date
    },

    endTime: {
      type: Date
    },

    startLocation: {

      name: String,

      latitude: Number,

      longitude: Number

    },

    endLocation: {

      name: String,

      latitude: Number,

      longitude: Number

    },

    currentLatitude: Number,

    currentLongitude: Number,

    locations: [
      {

        latitude: Number,

        longitude: Number,

        timestamp: {
          type: Date,
          default: Date.now
        }

      }
    ]

  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  'Ride',
  rideSchema
);