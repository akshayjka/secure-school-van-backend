const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema(

{

  driverId: {

    type: String,

    unique: true

  },

  role: {

    type: String,

    default: 'driver'

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

  type: String,

  default: null

},

  vehicleNumber: {

    type: String,

    required: true

  },

  routeArea: {

    type: String,

    required: true

  },

  isVerified: {

    type: Boolean,

    default: false

  },

  referralCode: {
  type: String,
  unique: true
},

referredByCode: {
  type: String,
  default: null
},

referredByDriverId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Driver',
  default: null
},

referralCount: {
  type: Number,
  default: 0
}

},

{

  timestamps: true

});

module.exports = mongoose.model(

  'Driver',

  driverSchema

);