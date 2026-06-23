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
});

module.exports = mongoose.model('Parent', parentSchema);