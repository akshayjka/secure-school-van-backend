
const mongoose = require('mongoose');
const Parent = require('../models/parent.model');
const Driver = require('../models/driver.model');
const Ride = require('../models/ride.model');
const Attendance = require('../models/attendance.model');


/**
 * Add Parent
 */
const addParent = async (data) => {

  if (!data.driverId) {
    throw new Error('Driver Id is required');
  }

  const existingParent = await Parent.findOne({
    mobileNumber: data.mobileNumber
  });

  if (existingParent) {
    throw new Error('Parent already exists');
  }

  const parentId = `PAR${Date.now()}`;

  const parent = await Parent.create({

    ...data,

    parentId,

    role: 'parent',

    attendance: false,

    morningStatus: 'waiting',

    eveningStatus: 'waiting_school_finish'

  });

  return parent;

};

/**
 * CRUD
 */

const getAllParents = async () => {
  return Parent.find().sort({ createdAt: -1 });
};

const getParent = async (id) => {

  let parent = null;

  // Try MongoDB _id only when it is a valid ObjectId
  if (mongoose.Types.ObjectId.isValid(id)) {

    parent = await Parent.findById(id);

  }

  // If not found, try application parentId
  if (!parent) {

    parent = await Parent.findOne({
      parentId: id
    });

  }

  if (!parent) {

    throw new Error(
      `Parent not found: ${id}`
    );

  }

  return parent;
};

const updateParent = async (id, data) => {
  return Parent.findByIdAndUpdate(
    id,
    data,
    { new: true }
  );
};

const deleteParent = async (id) => {
  return Parent.findByIdAndDelete(id);
};

/**
 * Parent Dashboard
 */
const getStartOfToday = () => {

  const now = new Date();

  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );

};

const getEndOfToday = () => {

  const start = getStartOfToday();

  const end = new Date(start);

  end.setDate(
    end.getDate() + 1
  );

  return end;

};

const getDashboard = async (parentId) => {

  const parent =
    await Parent.findOne({
      parentId
    });

  if (!parent) {
    throw new Error('Parent not found');
  }

  const driver =
    await Driver.findOne({
      driverId: parent.driverId
    });

  // =====================================================
  // TODAY'S ATTENDANCE
  // =====================================================

  const todayStart =
    getStartOfToday();

  const todayEnd =
    getEndOfToday();

  const todayAttendance =
    await Attendance.findOne({

      parentId: parent.parentId,

      date: {
        $gte: todayStart,
        $lt: todayEnd
      }

    }).sort({
      date: -1
    });

  const todayAttendanceStatus =
    todayAttendance?.status ||
    'not_marked';

  const isPresent =
    todayAttendanceStatus === 'present';

  // =====================================================
  // ACTIVE RIDES
  // =====================================================

  const morningRide =
    await Ride.findOne({

      driverId: parent.driverId,

      rideType: 'morning',

      status: 'started'

    }).sort({
      createdAt: -1
    });

  const eveningRide =
    await Ride.findOne({

      driverId: parent.driverId,

      rideType: 'evening',

      status: 'started'

    }).sort({
      createdAt: -1
    });

  let activeRide = null;

  if (morningRide) {

    activeRide = morningRide;

  } else if (eveningRide) {

    activeRide = eveningRide;

  }

  const rideStarted =
    !!activeRide;

  const rideType =
    activeRide?.rideType || null;

  // =====================================================
  // STUDENT STATUS
  // =====================================================

  let studentStatus = 'waiting';

  if (rideType === 'morning') {

    studentStatus =
      parent.morningStatus || 'waiting';

  }

  else if (rideType === 'evening') {

    studentStatus =
      parent.eveningStatus ||
      'waiting_school_finish';

  }

  // =====================================================
  // TRACKING ACCESS
  //
  // ONLY WHILE STUDENT IS INSIDE VAN
  // =====================================================

  let trackingAvailable = false;

  if (
    rideType === 'morning' &&
    studentStatus === 'picked_up'
  ) {

    trackingAvailable = true;

  }

  if (
    rideType === 'evening' &&
    studentStatus ===
      'picked_from_school'
  ) {

    trackingAvailable = true;

  }

  // =====================================================
  // RIDE MESSAGE
  // =====================================================

  let rideDirection = null;

  let rideMessageTitle =
    'No Active Ride';

  let rideMessage =
    'The school van is not currently on a trip.';

  if (rideType === 'morning') {

    rideDirection =
      'to_school';

    rideMessageTitle =
      'School Trip Started';

    rideMessage =
      'The van is taking students to school.';

  }

  else if (rideType === 'evening') {

    rideDirection =
      'to_home';

    rideMessageTitle =
      'Return Trip Started';

    rideMessage =
      'The van is bringing students home.';

  }

  return {

    studentName:
      parent.studentName,

    schoolName:
      parent.schoolName,

    pickupArea:
      parent.pickupArea,

    dropArea:
      parent.dropArea,

    // =================================================
    // ATTENDANCE
    // =================================================

    attendance:
      isPresent,

    todayAttendanceStatus,

    todayAttendanceDate:
      todayAttendance?.date || null,

    // =================================================
    // STUDENT RIDE STATUS
    // =================================================

    morningStatus:
      parent.morningStatus,

    eveningStatus:
      parent.eveningStatus,

    studentStatus,

    // =================================================
    // RIDE
    // =================================================

    rideStarted,

    rideType,

    rideDirection,

    rideMessageTitle,

    rideMessage,

    // =================================================
    // TRACKING
    // =================================================

    trackingAvailable,

    // =================================================
    // DRIVER
    // =================================================

    driver: driver
      ? {

          driverId:
            driver.driverId,

          name:
            driver.name,

          mobileNumber:
            driver.mobileNumber

        }
      : null

  };

};

/**
 * Attendance
 */

const updateAttendance = async (

  parentId,

  attendance

) => {

  const parent =
    await Parent.findOneAndUpdate(

      {
        parentId
      },

      {
        attendance
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
 * Morning Pickup
 */

const pickStudentMorning = async (parentId) => {

  return Parent.findOneAndUpdate(

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

};

/**
 * Morning Drop
 */

const dropStudentSchool = async (parentId) => {

  return Parent.findOneAndUpdate(

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

};

/**
 * Evening Pickup
 */

const pickStudentFromSchool = async (parentId) => {

  return Parent.findOneAndUpdate(

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

};

/**
 * Evening Drop
 */

const dropStudentHome = async (parentId) => {

  return Parent.findOneAndUpdate(

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

};

/**
 * Generic Status Update
 */

const updateStudentStatus = async (

  parentId,

  rideType,

  status

) => {

  const update = {};

  if (rideType === 'morning') {

    update.morningStatus = status;

  }

  else {

    update.eveningStatus = status;

  }

  const parent =
    await Parent.findOneAndUpdate(

      {
        parentId
      },

      update,

      {
        new: true
      }

    );

  if (!parent) {
    throw new Error('Parent not found');
  }

  return parent;

};

const saveMonthlyAttendance = async (
  parentId,
  year,
  month,
  records
) => {

  // ==========================================
  // FIND PARENT
  // ==========================================

  let parent = null;

  if (
    mongoose.Types.ObjectId.isValid(parentId)
  ) {
    parent = await Parent.findById(parentId);
  }

  if (!parent) {
    parent = await Parent.findOne({
      parentId
    });
  }

  if (!parent) {
    throw new Error(
      `Parent not found: ${parentId}`
    );
  }

  // ==========================================
  // MONTH RANGE
  // ==========================================

  const startDate = new Date(
    Number(year),
    Number(month) - 1,
    1
  );

  const endDate = new Date(
    Number(year),
    Number(month),
    1
  );

  // ==========================================
  // REMOVE EXISTING MONTH RECORDS
  //
  // This makes Reset Month work.
  // ==========================================

  await Attendance.deleteMany({
    parentId: parent.parentId,
    date: {
      $gte: startDate,
      $lt: endDate
    }
  });

  // ==========================================
  // SAVE NEW RECORDS
  // ==========================================

  if (records.length > 0) {

    const documents = records.map(record => {

      const attendanceDate =
        new Date(record.date);

      if (
        isNaN(
          attendanceDate.getTime()
        )
      ) {
        throw new Error(
          `Invalid date: ${record.date}`
        );
      }

      return {
        parentId: parent.parentId,
        date: attendanceDate,
        status: record.status
      };

    });

    await Attendance.insertMany(
      documents
    );

  }

  // ==========================================
  // RETURN COMPLETE MONTH
  // ==========================================

  const savedRecords =
    await Attendance.find({
      parentId: parent.parentId,
      date: {
        $gte: startDate,
        $lt: endDate
      }
    }).sort({
      date: 1
    });

  return {

    parent,

    parentId: parent.parentId,

    year: Number(year),

    month: Number(month),

    records: savedRecords

  };

};

module.exports = {

  addParent,

  getAllParents,

  getParent,

  updateParent,

  deleteParent,

  getDashboard,

  updateAttendance,

  pickStudentMorning,

  dropStudentSchool,

  pickStudentFromSchool,

  dropStudentHome,

  updateStudentStatus,
  saveMonthlyAttendance

};