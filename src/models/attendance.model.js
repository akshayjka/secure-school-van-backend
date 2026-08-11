const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    parentId: {
      type: String,
      required: true,
      index: true
    },

    date: {
      type: Date,
      required: true
    },

    status: {
      type: String,
      enum: ['present', 'absent'],
      required: true
    }
  },
  {
    timestamps: true
  }
);

attendanceSchema.index(
  {
    parentId: 1,
    date: 1
  },
  {
    unique: true
  }
);

module.exports =
  mongoose.model('Attendance', attendanceSchema);