const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema(
  {
    driverId: {
      type: String,
      unique: true,
      index: true,
      trim: true
    },

    role: {
      type: String,
      default: 'driver',
      enum: ['driver']
    },

    name: {
      type: String,
      required: true,
      trim: true
    },

    mobileNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },

    password: {
      type: String,
      default: null,

    },

    vehicleNumber: {
      type: String,
      default: 'Pending',
      trim: true
    },

    routeArea: {
      type: String,
      default: 'Pending',
      trim: true
    },

    isVerified: {
      type: Boolean,
      default: false
    },

    registrationSource: {
      type: String,
      enum: [
        'driver',
        'parent_onboarding',
        'admin'
      ],
      default: 'driver'
    },

    referralCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },

    referredByCode: {
      type: String,
      default: null,
      trim: true
    },

    referredByDriverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
      default: null
    },

    referralCount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

module.exports =
  mongoose.model('Driver', driverSchema);
