const mongoose = require('mongoose');

const parentSchema = new mongoose.Schema(

  {

    parentId: {
      type: String,
      unique: true
    },

    role: {
      type: String,
      default: 'parent'
    },

    driverId: {
      type: String,
      required: true
    },

    fcmToken: {
      type: String,
      default: ''
    },

    attendance: {
      type: Boolean,
      default: false
    },

    // -------------------------
    // Morning Ride
    // -------------------------

    morningStatus: {

      type: String,

      enum: [
        'waiting',
        'picked_up',
        'dropped_at_school'
      ],

      default: 'waiting'

    },

    // -------------------------
    // Evening Ride
    // -------------------------

    eveningStatus: {

      type: String,

      enum: [
        'waiting_school_finish',
        'picked_from_school',
        'dropped_at_home'
      ],

      default: 'waiting_school_finish'

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

    password: {
      type: String
    },

    studentName: {

      type: String,

      required: true

    },

    schoolName: {

      type: String,

      required: true

    },

    pickupArea: {

      type: String,

      required: true

    },

    dropArea: {

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
  }

);

module.exports = mongoose.model(
  'Parent',
  parentSchema
);