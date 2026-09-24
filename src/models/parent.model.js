const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema(
  {
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180
    }
  },
  { _id: false }
);

const parentSchema = new mongoose.Schema(
  {
    // =====================================================
    // IDENTITY
    // =====================================================

    parentId: {
      type: String,
      unique: true,
      index: true,
      trim: true
    },

    role: {
      type: String,
      default: 'parent',
      enum: ['parent']
    },

    driverId: {
      type: String,
      required: true,
      index: true,
      trim: true
    },

    driverMobile: {
      type: String,
      trim: true,
      default: ''
    },

    driverName: {
      type: String,
      trim: true,
      default: ''
    },

    fcmToken: {
      type: String,
      default: ''
    },

    isVerified: {
      type: Boolean,
      default: false
    },

    // =====================================================
    // PARENT DETAILS
    // =====================================================

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

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null
    },

    emergencyContact: {
      type: String,
      trim: true,
      default: null
    },

    // =====================================================
    // STUDENT
    // =====================================================

    studentName: {
      type: String,
      required: true,
      trim: true
    },

    studentClass: {
      type: String,
      trim: true,
      default: ''
    },

    studentSection: {
      type: String,
      trim: true,
      default: ''
    },

    schoolName: {
      type: String,
      required: true,
      trim: true
    },

    // =====================================================
    // PICKUP / HOME
    // =====================================================

    pickupArea: {
      type: String,
      required: true,
      trim: true
    },

    pickupAddress: {
      type: String,
      trim: true,
      default: ''
    },

    pickupLocation: {
      type: locationSchema,
      required: true
    },

    // =====================================================
    // SCHOOL
    // =====================================================

    dropArea: {
      type: String,
      required: true,
      trim: true
    },

    schoolAddress: {
      type: String,
      trim: true,
      default: ''
    },

    schoolLocation: {
      type: locationSchema,
      required: true
    },

    // =====================================================
    // SCHOOL METADATA
    // =====================================================

    school: {
      name: {
        type: String,
        trim: true,
        default: ''
      },

      address: {
        type: String,
        trim: true,
        default: ''
      },

      latitude: {
        type: Number,
        default: null
      },

      longitude: {
        type: Number,
        default: null
      },

      placeId: {
        type: String,
        default: null
      },

      city: {
        type: String,
        default: null
      },

      state: {
        type: String,
        default: null
      },

      postcode: {
        type: String,
        default: null
      }
    },

    // =====================================================
    // ATTENDANCE
    // =====================================================

    attendance: {
      type: Boolean,
      default: false
    },

    // =====================================================
    // MORNING JOURNEY
    // =====================================================

    morningPickedUpAt: {
      type: Date,
      default: null
    },

    morningDroppedAtSchoolAt: {
      type: Date,
      default: null
    },

    morningStatus: {
      type: String,
      enum: [
        'waiting',
        'picked_up',
        'dropped_at_school'
      ],
      default: 'waiting'
    },

    // =====================================================
    // EVENING JOURNEY
    // =====================================================

    eveningPickedFromSchoolAt: {
      type: Date,
      default: null
    },

    eveningDroppedAtHomeAt: {
      type: Date,
      default: null
    },

    eveningStatus: {
      type: String,
      enum: [
        'waiting_school_finish',
        'picked_from_school',
        'dropped_at_home'
      ],
      default: 'waiting_school_finish'
    }
  },
  {
    timestamps: true,
    strict: true
  }
);

// =====================================================
// INDEXES
// =====================================================

parentSchema.index({
  driverId: 1,
  attendance: 1
});

parentSchema.index({
  mobileNumber: 1
});

module.exports =
  mongoose.model('Parent', parentSchema);
