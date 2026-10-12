
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
    // School-local business date in YYYY-MM-DD format.
    date: {
      type: String,
      required: true,
      index: true
    },
    cycleNumber: {
      type: Number,
      required: true,
      default: 1,
      min: 1
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

studentJourneySchema.index(
  {
    parentId: 1,
    date: 1,
    cycleNumber: 1
  },
  {
    unique: true,
    name: 'uniq_parent_date_cycle'
  }
);

module.exports = mongoose.model(
  'StudentJourney',
  studentJourneySchema
);
