const Ride = require('../models/ride.model');
const Parent = require('../models/parent.model');

/**
 * Start Ride
 * rideType = morning | evening
 */
exports.startRide = async (driverId, rideType) => {

  // Only one active ride of same type
  const activeRide = await Ride.findOne({
    driverId,
    rideType,
    status: 'started'
  });

  if (activeRide) {
    throw new Error(`${rideType} ride already started`);
  }

  const rideCount = await Ride.countDocuments();

  const ride = await Ride.create({

    rideId: `RIDE${String(rideCount + 1).padStart(6, '0')}`,

    driverId,

    rideType,

    status: 'started',

    startTime: new Date(),

    locations: []

  });

  // Reset student status whenever a ride starts

  if (rideType === 'morning') {

    await Parent.updateMany(
      {
        driverId,
        attendance: true
      },
      {
        morningStatus: 'waiting'
      }
    );

  } else {

    await Parent.updateMany(
      {
        driverId,
        attendance: true
      },
      {
        eveningStatus: 'waiting_school_finish'
      }
    );

  }

  return ride;

};

/**
 * End Ride
 */
exports.endRide = async (driverId, rideType) => {

  const ride = await Ride.findOne({

    driverId,

    rideType,

    status: 'started'

  });

  if (!ride) {
    throw new Error('Ride not found');
  }

  ride.status = 'ended';

  ride.endTime = new Date();

  await ride.save();

  return ride;

};

/**
 * Driver picks student from home
 */
exports.pickStudentMorning = async (parentId) => {

  const parent = await Parent.findOneAndUpdate(

    {
      parentId
    },

    {
      morningStatus: 'picked_up'
    },

    {
      new: true
    }

  );

  if (!parent) {
    throw new Error('Parent not found');
  }

  return parent;

};

/**
 * Driver drops student at school
 */
exports.dropStudentSchool = async (parentId) => {

  const parent = await Parent.findOneAndUpdate(

    {
      parentId
    },

    {
      morningStatus: 'dropped_at_school'
    },

    {
      new: true
    }

  );

  if (!parent) {
    throw new Error('Parent not found');
  }

  return parent;

};

/**
 * Driver picks student from school
 */
exports.pickStudentFromSchool = async (parentId) => {

  const parent = await Parent.findOneAndUpdate(

    {
      parentId
    },

    {
      eveningStatus: 'picked_from_school'
    },

    {
      new: true
    }

  );

  if (!parent) {
    throw new Error('Parent not found');
  }

  return parent;

};

/**
 * Driver drops student at home
 */
exports.dropStudentHome = async (parentId) => {

  const parent = await Parent.findOneAndUpdate(

    {
      parentId
    },

    {
      eveningStatus: 'dropped_at_home'
    },

    {
      new: true
    }

  );

  if (!parent) {
    throw new Error('Parent not found');
  }

  return parent;

};

/**
 * Ride Status
 */
exports.getRideStatus = async (driverId, rideType) => {

  const ride = await Ride.findOne({

    driverId,

    rideType,

    status: 'started'

  });

  return {

    rideStarted: !!ride,

    rideType: ride?.rideType || null,

    status: ride?.status || 'ended'

  };

};

/**
 * Update Live Location
 */
exports.updateLocation = async (

  driverId,

  rideType,

  latitude,

  longitude

) => {

  const ride = await Ride.findOne({

    driverId,

    rideType,

    status: 'started'

  });

  if (!ride) {
    throw new Error('Ride not found');
  }

  ride.currentLatitude = latitude;

  ride.currentLongitude = longitude;

  ride.locations.push({

    latitude,

    longitude,

    timestamp: new Date()

  });

  await ride.save();

  return ride;

};