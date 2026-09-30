const Driver = require('../models/driver.model');
const Parent = require('../models/parent.model');
const Ride = require('../models/ride.model');

/**
 * =========================================================
 * DATE HELPERS
 * =========================================================
 */

const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
};

/**
 * =========================================================
 * DRIVER REGISTRATION / CRUD
 * =========================================================
 */

const registerDriver = async (data = {}) => {
  const mobileNumber = String(data.mobileNumber || '').trim();

  if (!mobileNumber) {
    throw new Error('Mobile number is required');
  }

  const existingDriver = await Driver.findOne({ mobileNumber });

  if (existingDriver) {
    return {
      success: false,
      message: 'Driver already registered',
      data: existingDriver
    };
  }

  const count = await Driver.countDocuments();
  const driverId = `DRV${String(count + 1).padStart(6, '0')}`;
  const referralCode = `DRV${1000 + count + 1}`;

  let referredByDriver = null;

  if (data.referredByCode) {
    referredByDriver = await Driver.findOne({
      referralCode: String(data.referredByCode).trim()
    });

    if (!referredByDriver) {
      throw new Error('Invalid referral code');
    }
  }

  const driver = await Driver.create({
    ...data,
    driverId,
    referralCode,
    referredByCode: referredByDriver?.referralCode || null,
    referredByDriverId: referredByDriver?._id || null,
    role: 'driver',
    password: null
  });

  if (referredByDriver) {
    await Driver.findByIdAndUpdate(referredByDriver._id, {
      $inc: { referralCount: 1 }
    });
  }

  return {
    success: true,
    message: 'Driver registered successfully',
    data: driver
  };
};

const getAllDrivers = async () => {
  return Driver.find(
    {},
    {
      _id: 1,
      driverId: 1,
      role: 1,
      name: 1,
      mobileNumber: 1,
      vehicleNumber: 1,
      routeArea: 1,
      isVerified: 1,
      referralCode: 1,
      referralCount: 1,
      referredByCode: 1,
      createdAt: 1
    }
  ).sort({ createdAt: -1 });
};

const addDriver = async (data = {}) => {
  const mobileNumber = String(data.mobileNumber || '').trim();

  if (!mobileNumber) {
    throw new Error('Mobile number is required');
  }

  const existingDriver = await Driver.findOne({ mobileNumber });

  if (existingDriver) {
    throw new Error('Driver already exists');
  }

  const count = await Driver.countDocuments();
  const driverId = `DRV${String(count + 1).padStart(6, '0')}`;
  const referralCode = `DRV${1000 + count + 1}`;

  return Driver.create({
    ...data,
    driverId,
    referralCode,
    role: 'driver',
    password: null
  });
};

const getDriver = async (id) => {
  return Driver.findById(id).select('-password');
};

const updateDriver = async (id, data) => {
  return Driver.findByIdAndUpdate(
    id,
    data,
    {
      new: true,
      runValidators: true
    }
  ).select('-password');
};

const deleteDriver = async (id) => {
  return Driver.findByIdAndDelete(id);
};

const getReferralDetails = async (driverId) => {
  const driver = await Driver.findOne(
    { driverId },
    {
      driverId: 1,
      name: 1,
      referralCode: 1,
      referralCount: 1,
      referredByCode: 1
    }
  );

  if (!driver) {
    throw new Error('Driver not found');
  }

  return driver;
};

const getReferredDrivers = async (driverId) => {
  const driver = await Driver.findOne({ driverId });

  if (!driver) {
    throw new Error('Driver not found');
  }

  return Driver.find(
    { referredByCode: driver.referralCode },
    {
      driverId: 1,
      name: 1,
      mobileNumber: 1,
      vehicleNumber: 1,
      createdAt: 1
    }
  ).sort({ createdAt: -1 });
};

/**
 * =========================================================
 * DRIVER DASHBOARD
 * =========================================================
 *
 * MongoDB is the only source of truth.
 *
 * The dashboard MUST return the Parent journey states because
 * the Ionic dashboard uses these states to render:
 *
 * morning:
 *   waiting -> picked_up -> dropped_at_school
 *
 * evening:
 *   waiting_school_finish -> picked_from_school -> dropped_at_home
 *
 * The workflow stage is calculated from the same data.
 */

const getDashboard = async (driverId) => {
  const normalizedDriverId = String(driverId || '').trim();

  if (!normalizedDriverId) {
    throw new Error('Driver ID is required');
  }

  const driver = await Driver.findOne({
    driverId: normalizedDriverId
  }).select('-password');

  if (!driver) {
    throw new Error('Driver not found');
  }

  const { start, end } = getTodayRange();

  const students = await Parent.find({
    driverId: normalizedDriverId
  })
    .select({
      _id: 0,
      parentId: 1,
      name: 1,
      mobileNumber: 1,
      studentName: 1,
      studentClass: 1,
      studentSection: 1,
      schoolName: 1,
      pickupArea: 1,
      pickupAddress: 1,
      pickupLocation: 1,
      dropArea: 1,
      schoolAddress: 1,
      schoolLocation: 1,
      attendance: 1,
      morningStatus: 1,
      morningPickedUpAt: 1,
      morningDroppedAtSchoolAt: 1,
      eveningStatus: 1,
      eveningPickedFromSchoolAt: 1,
      eveningDroppedAtHomeAt: 1,
      createdAt: 1
    })
    .sort({ studentName: 1 });

  const presentStudents = students.filter(
    student => student.attendance === true
  );

  const absentStudents = students.filter(
    student => student.attendance !== true
  );

  const [activeRide, morningRide, eveningRide] = await Promise.all([
    Ride.findOne({
      driverId: normalizedDriverId,
      status: 'started',
      startTime: { $gte: start, $lt: end }
    }).sort({ startTime: -1 }),

    Ride.findOne({
      driverId: normalizedDriverId,
      rideType: 'morning',
      startTime: { $gte: start, $lt: end }
    }).sort({ startTime: -1 }),

    Ride.findOne({
      driverId: normalizedDriverId,
      rideType: 'evening',
      startTime: { $gte: start, $lt: end }
    }).sort({ startTime: -1 })
  ]);

  const morningPickedCount = presentStudents.filter(
    student => student.morningStatus === 'picked_up'
  ).length;

  const morningDroppedCount = presentStudents.filter(
    student => student.morningStatus === 'dropped_at_school'
  ).length;

  const returnWaitingCount = presentStudents.filter(
    student => student.eveningStatus === 'waiting_school_finish'
  ).length;

  const returnOnboardCount = presentStudents.filter(
    student => student.eveningStatus === 'picked_from_school'
  ).length;

  const returnDroppedCount = presentStudents.filter(
    student => student.eveningStatus === 'dropped_at_home'
  ).length;

  const hasPresentStudents = presentStudents.length > 0;

  const allMorningDropped =
    hasPresentStudents &&
    morningDroppedCount === presentStudents.length;

  const allReturnDropped =
    hasPresentStudents &&
    returnDroppedCount === presentStudents.length;

  const morningRideCompleted = Boolean(
    morningRide?.status === 'ended' &&
    allMorningDropped
  );

  const eveningRideCompleted = Boolean(
    eveningRide?.status === 'ended' &&
    allReturnDropped
  );

  let stage = 'morning-ready';
  let nextRideType = null;

  /*
   * The order below is intentional.
   * Active MongoDB ride always wins over derived UI state.
   */
  if (activeRide?.rideType === 'morning') {
    if (allMorningDropped) {
      stage = 'morning-complete';
    } else if (morningPickedCount > 0) {
      stage = 'morning-school-drop';
    } else {
      stage = 'morning-pickup';
    }
  } else if (activeRide?.rideType === 'evening') {
    if (allReturnDropped) {
      stage = 'return-complete';
    } else if (returnOnboardCount > 0) {
      stage = 'return-home-drop';
    } else {
      stage = 'return-boarding';
    }
  } else if (eveningRideCompleted) {
    stage = 'day-complete';
  } else if (morningRideCompleted) {
    stage = 'return-ready';
    nextRideType = 'evening';
  } else if (morningRide?.status === 'ended') {
    /*
     * Defensive recovery for legacy/inconsistent data.
     * The new backend prevents this state from being created.
     */
    if (morningPickedCount > 0 && !allMorningDropped) {
      stage = 'morning-school-drop';
    } else {
      stage = 'morning-ready';
      nextRideType = 'morning';
    }
  } else {
    stage = 'morning-ready';
    nextRideType = 'morning';
  }

  if (!activeRide && stage === 'return-ready') {
    nextRideType = 'evening';
  }

  if (!activeRide && stage === 'day-complete') {
    nextRideType = null;
  }

  const workflow = {
    stage,
    activeRideType: activeRide?.rideType || null,
    activeRideStatus: activeRide?.status || null,
    activeRideId: activeRide?.rideId || null,
    activeRideStartTime: activeRide?.startTime || null,
    activeRideEndTime: activeRide?.endTime || null,
    nextRideType,
    morningRideId: morningRide?.rideId || null,
    morningRideStatus: morningRide?.status || null,
    morningRideCompleted,
    eveningRideId: eveningRide?.rideId || null,
    eveningRideStatus: eveningRide?.status || null,
    eveningRideCompleted,
    counts: {
      total: students.length,
      present: presentStudents.length,
      absent: absentStudents.length,
      morningPicked: morningPickedCount,
      morningDropped: morningDroppedCount,
      returnWaiting: returnWaitingCount,
      returnOnboard: returnOnboardCount,
      returnDropped: returnDroppedCount
    }
  };

  return {
    success: true,
    driver: {
      driverId: driver.driverId,
      name: driver.name,
      mobileNumber: driver.mobileNumber,
      vehicleNumber: driver.vehicleNumber,
      routeArea: driver.routeArea,
      referralCode: driver.referralCode || '',
      referralCount: driver.referralCount || 0,
      referredByCode: driver.referredByCode || ''
    },
    students: students.map(student => ({
      ...student.toObject(),
      morningStatus: student.morningStatus || 'waiting',
      eveningStatus: student.eveningStatus || 'waiting_school_finish',
      morningPickedUpAt: student.morningPickedUpAt || null,
      morningDroppedAtSchoolAt: student.morningDroppedAtSchoolAt || null,
      eveningPickedFromSchoolAt: student.eveningPickedFromSchoolAt || null,
      eveningDroppedAtHomeAt: student.eveningDroppedAtHomeAt || null
    })),
    todayStats: {
      present: presentStudents.length,
      absent: absentStudents.length,
      total: students.length
    },
    workflow
  };
};

module.exports = {
  registerDriver,
  getAllDrivers,
  addDriver,
  getDashboard,
  getDriver,
  updateDriver,
  deleteDriver,
  getReferralDetails,
  getReferredDrivers
};
