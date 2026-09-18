const mongoose = require('mongoose');

const studentJourneySchema = new mongoose.Schema(
  {
    parentId: {
      type: String,
      required: true,
      index: true
    },

    driverId: {
      type: String,
      required: true,
      index: true
    },

    studentName: {
      type: String,
      required: true
    },

    // YYYY-MM-DD
    date: {
      type: String,
      required: true,
      index: true
    },

    morning: {
      pickedUpAt: {
        type: Date,
        default: null
      },

      droppedAtSchoolAt: {
        type: Date,
        default: null
      }
    },

    evening: {
      pickedFromSchoolAt: {
        type: Date,
        default: null
      },

      droppedAtHomeAt: {
        type: Date,
        default: null
      }
    }
  },
  {
    timestamps: true
  }
);

// One student can have only one daily report.
studentJourneySchema.index(
  {
    parentId: 1,
    date: 1
  },
  {
    unique: true
  }
);

module.exports = mongoose.model(
  'StudentJourney',
  studentJourneySchema
);