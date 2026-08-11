
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
const getDashboard = async (parentId) => {

  const parent = await Parent.findOne({ parentId });

  if (!parent) {
    throw new Error('Parent not found');
  }

  const driver = await Driver.findOne({
    driverId: parent.driverId
  });

  /**
   * Active Morning Ride
   */
  const morningRide = await Ride.findOne({

    driverId: parent.driverId,

    rideType: 'morning',

    status: 'started'

  });

  /**
   * Active Evening Ride
   */

  const eveningRide = await Ride.findOne({

    driverId: parent.driverId,

    rideType: 'evening',

    status: 'started'

  });

  let rideStarted = false;

  let rideType = null;

  /**
   * Parent Tracking Logic
   */

  if (morningRide) {

    rideType = 'morning';

    rideStarted = !!morningRide;
  }

  else if (eveningRide) {

    rideType = 'evening';

    rideStarted = !!eveningRide;

  }

  return {

    studentName: parent.studentName,

    schoolName: parent.schoolName,

    pickupArea: parent.pickupArea,

    dropArea: parent.dropArea,

    attendance: parent.attendance,

    morningStatus: parent.morningStatus,

    eveningStatus: parent.eveningStatus,

    rideStarted,

    rideType,

    driver: driver
      ? {

        driverId: driver.driverId,

        name: driver.name,

        mobileNumber: driver.mobileNumber

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