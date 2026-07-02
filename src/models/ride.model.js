const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({

    rideId: {
        type: String,
        unique: true
    },

    driverId: {
        type: String,
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

    currentLatitude: Number,

    currentLongitude: Number,

    locations: [

        {
            latitude: Number,
            longitude: Number,
            timestamp: Date
        }

    ]

}, {
    timestamps: true
});

module.exports = mongoose.model(
    'Ride',
    rideSchema
);