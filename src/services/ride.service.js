const Ride = require('../models/ride.model');
const Parent = require('../models/parent.model');

/**
 * =====================================================
 * TODAY RANGE
 * =====================================================
 */

const getTodayRange = () => {

  const start = new Date();

  start.setHours(0, 0, 0, 0);

  const end = new Date(start);

  end.setDate(end.getDate() + 1);

  return {
    start,
    end
  };

};

  const ensureActiveRide = async (
  driverId,
  rideType
) => {

  const {
    start,
    end
  } = getTodayRange();

  const ride =
    await Ride.findOne({

      driverId,

      rideType,

      status: 'started',

      createdAt: {
        $gte: start,
        $lt: end
      }

    });

  if (!ride) {

    throw new Error(
      'Ride must be started before picking up students'
    );

  }

  return ride;

};

/**
 * =====================================================
 * START RIDE
 * =====================================================
 *
 * IMPORTANT:
 *
 * Ride is created ONLY when the driver explicitly
 * presses START RIDE.
 *
 * =====================================================
 */

exports.startRide = async (
  driverId,
  rideType
) => {

  const {
    start,
    end
  } = getTodayRange();

  // =====================================================
  // CHECK TODAY'S ACTIVE RIDE
  // =====================================================

  const activeRide =
    await Ride.findOne({

      driverId,

      rideType,

      status: 'started',

      createdAt: {
        $gte: start,
        $lt: end
      }

    }).sort({
      createdAt: -1
    });

  // =====================================================
  // ALREADY STARTED
  // =====================================================

  if (activeRide) {

    console.log(
      `Ride already active: ${activeRide.rideId}`
    );

    return {
      ride: activeRide,
      alreadyStarted: true
    };

  }

  // =====================================================
  // CREATE NEW RIDE
  // =====================================================

  const rideCount =
    await Ride.countDocuments();

  const ride =
    await Ride.create({

      rideId:
        `RIDE${String(
          rideCount + 1
        ).padStart(6, '0')}`,

      driverId,

      rideType,

      // IMPORTANT:
      // This is the ONLY place where a ride
      // becomes started.
      status: 'started',

      startTime: new Date(),

      locations: []

    });

  // =====================================================
  // RESET STUDENT WORKFLOW
  // =====================================================

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

  return {
    ride,
    alreadyStarted: false
  };

};

/**
 * =====================================================
 * END RIDE
 * =====================================================
 */

exports.endRide = async (
  driverId,
  rideType
) => {

  const {
    start,
    end
  } = getTodayRange();

  const ride =
    await Ride.findOne({

      driverId,

      rideType,

      status: 'started',

      createdAt: {
        $gte: start,
        $lt: end
      }

    });

  if (!ride) {
    throw new Error(
      'No active ride found for today'
    );
  }

  ride.status = 'ended';

  ride.endTime = new Date();

  await ride.save();

  return ride;

};

/**
 * =====================================================
 * GET RIDE STATUS
 * =====================================================
 */

exports.getRideStatus = async (
  driverId,
  rideType,
  parentId = null
) => {

  const {
    start,
    end
  } = getTodayRange();

  const ride =
    await Ride.findOne({

      driverId,

      rideType,

      status: 'started',

      createdAt: {
        $gte: start,
        $lt: end
      }

    }).sort({
      createdAt: -1
    });

  let studentStatus = null;

  let trackingAvailable = false;

  if (parentId) {

    const parent =
      await Parent.findOne({
        parentId,
        driverId
      });

    if (parent) {

      studentStatus =
        rideType === 'morning'
          ? parent.morningStatus
          : parent.eveningStatus;

      trackingAvailable =
        rideType === 'morning'
          ? studentStatus === 'picked_up'
          : studentStatus === 'picked_from_school';

    }

  }

  return {

    rideStarted: !!ride,

    rideType:
      ride?.rideType || null,

    status:
      ride?.status || 'ended',

    rideId:
      ride?.rideId || null,

    studentStatus,

    trackingAvailable

  };

};

/**
 * =====================================================
 * UPDATE LOCATION
 * =====================================================
 */

exports.updateLocation = async (
  driverId,
  rideType,
  latitude,
  longitude
) => {

  const {
    start,
    end
  } = getTodayRange();

  const ride =
    await Ride.findOne({

      driverId,

      rideType,

      status: 'started',

      createdAt: {
        $gte: start,
        $lt: end
      }

    });

  if (!ride) {
    throw new Error(
      'No active ride found'
    );
  }

  ride.currentLatitude =
    latitude;

  ride.currentLongitude =
    longitude;

  ride.locations.push({

    latitude,

    longitude,

    timestamp: new Date()

  });

  await ride.save();

  return ride;

};

/**
 * =====================================================
 * STUDENT ACTIONS
 * =====================================================
 */

exports.pickStudentMorning = async (
  driverId,
  parentId
) => {

  await ensureActiveRide(
    driverId,
    'morning'
  );

  const parent =
    await Parent.findOneAndUpdate(

      {
        parentId,
        driverId
      },

      {
        morningStatus: 'picked_up'
      },

      {
        new: true
      }

    );

  if (!parent) {
    throw new Error(
      'Parent not found'
    );
  }

  return parent;

};



exports.dropStudentSchool = async (
  driverId,
  parentId
) => {

  await ensureActiveRide(
    driverId,
    'morning'
  );

  const parent =
    await Parent.findOneAndUpdate(

      {
        parentId,
        driverId
      },

      {
        morningStatus:
          'dropped_at_school'
      },

      {
        new: true
      }

    );

  if (!parent) {
    throw new Error(
      'Parent not found'
    );
  }

  return parent;

};

exports.pickStudentFromSchool =
  async (driverId,parentId) => {


     await ensureActiveRide(
      driverId,
      'evening'
    );

    const parent =
      await Parent.findOneAndUpdate(

        {
          parentId,
          driverId
        },

        {
          eveningStatus:
            'picked_from_school'
        },

        {
          new: true
        }

      );

    if (!parent) {
      throw new Error(
        'Parent not found'
      );
    }

    return parent;

  };

exports.dropStudentHome =
  async (parentId) => {

    const parent =
      await Parent.findOneAndUpdate(

        {
          parentId
        },

        {
          eveningStatus:
            'dropped_at_home'
        },

        {
          new: true
        }

      );

    if (!parent) {
      throw new Error(
        'Parent not found'
      );
    }

    return parent;

  };