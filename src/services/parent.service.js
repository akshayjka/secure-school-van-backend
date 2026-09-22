
const mongoose = require('mongoose');
const Parent = require('../models/parent.model');
const Driver = require('../models/driver.model');
const Ride = require('../models/ride.model');
const Attendance = require('../models/attendance.model');

// const Parent = require('../models/parent.model');


// =====================================================
// ADD PARENT
// =====================================================

const addParent = async (data) => {

  // ===================================================
  // DRIVER
  // ===================================================

  if (!data.driverId) {
    throw new Error(
      'Driver Id is required'
    );
  }

  // ===================================================
  // PICKUP LOCATION
  // ===================================================

  const pickupLatitude =
    Number(
      data?.pickupLocation?.latitude
    );

  const pickupLongitude =
    Number(
      data?.pickupLocation?.longitude
    );

  if (
    !Number.isFinite(pickupLatitude) ||
    !Number.isFinite(pickupLongitude)
  ) {

    throw new Error(
      'Valid pickup location coordinates are required'
    );
  }

  // ===================================================
  // SCHOOL LOCATION
  // ===================================================

  const schoolLatitude =
    Number(
      data?.schoolLocation?.latitude
    );

  const schoolLongitude =
    Number(
      data?.schoolLocation?.longitude
    );

  if (
    !Number.isFinite(schoolLatitude) ||
    !Number.isFinite(schoolLongitude)
  ) {

    throw new Error(
      'Valid school location coordinates are required'
    );
  }

  // ===================================================
  // MOBILE DUPLICATE
  // ===================================================

  const existingParent =
    await Parent.findOne({
      mobileNumber:
        data.mobileNumber
    });

  if (existingParent) {

    throw new Error(
      'Parent already registered'
    );
  }

  // ===================================================
  // CREATE ID
  // ===================================================

  const parentId =
    `PAR${Date.now()}`;

  // ===================================================
  // CREATE PARENT
  // ===================================================

  const parent =
    await Parent.create({

      ...data,

      parentId,

      role: 'parent',

      pickupLocation: {
        latitude:
          pickupLatitude,

        longitude:
          pickupLongitude
      },

      schoolLocation: {
        latitude:
          schoolLatitude,

        longitude:
          schoolLongitude
      },

      attendance: false,

      morningStatus:
        'waiting',

      eveningStatus:
        'waiting_school_finish'
    });

  return parent;
};


module.exports = {
  addParent
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
 * =====================================================
 * Generic Student Status Update
 * =====================================================
 *
 * Frontend contract:
 *
 * MORNING
 * picked_up
 * dropped_at_school
 *
 * EVENING
 * picked_up
 * dropped_at_home
 *
 * Backend mapping:
 *
 * evening + picked_up
 *      ->
 * eveningStatus = picked_from_school
 *
 * =====================================================
 */
const updateStudentStatus = async (
  parentId,
  rideType,
  status
) => {

  if (!parentId) {
    throw new Error(
      'parentId is required'
    );
  }

  if (
    !['morning', 'evening']
      .includes(rideType)
  ) {
    throw new Error(
      'Invalid rideType'
    );
  }

  if (!status) {
    throw new Error(
      'status is required'
    );
  }

  const parent =
    await Parent.findOne({
      parentId
    });

  if (!parent) {
    throw new Error(
      'Parent not found'
    );
  }

  if (
    parent.attendance !== true
  ) {
    throw new Error(
      'Absent students cannot be picked up'
    );
  }

  const eventTime =
    new Date();

  const update = {};

  // =====================================================
  // MORNING
  // =====================================================

  if (rideType === 'morning') {

    if (status === 'picked_up') {

      if (
        parent.morningStatus ===
        'picked_up'
      ) {
        throw new Error(
          'Student is already picked up'
        );
      }

      if (
        parent.morningStatus ===
        'dropped_at_school'
      ) {
        throw new Error(
          'Student has already been dropped at school'
        );
      }

      update.morningStatus =
        'picked_up';

      update.morningPickedUpAt =
        eventTime;

    }

    else if (
      status === 'dropped_at_school'
    ) {

      if (
        parent.morningStatus !==
        'picked_up'
      ) {
        throw new Error(
          'Student must be picked up before school drop'
        );
      }

      update.morningStatus =
        'dropped_at_school';

      update.morningDroppedAtSchoolAt =
        eventTime;

    }

    else {

      throw new Error(
        `Invalid morning status: ${status}`
      );

    }

  }

  // =====================================================
  // EVENING
  // =====================================================

  else {

    if (status === 'picked_up') {

      if (
        parent.eveningStatus ===
        'picked_from_school'
      ) {
        throw new Error(
          'Student is already picked from school'
        );
      }

      if (
        parent.eveningStatus ===
        'dropped_at_home'
      ) {
        throw new Error(
          'Student has already been dropped at home'
        );
      }

      if (
        parent.eveningStatus !==
        'waiting_school_finish'
      ) {
        throw new Error(
          `Student cannot be picked from school. Current status: ${parent.eveningStatus}`
        );
      }

      update.eveningStatus =
        'picked_from_school';

      update.eveningPickedFromSchoolAt =
        eventTime;

      update.eveningDroppedAtHomeAt =
        null;

    }

    else if (
      status === 'dropped_at_home'
    ) {

      if (
        parent.eveningStatus !==
        'picked_from_school'
      ) {
        throw new Error(
          'Student must be picked from school before home drop'
        );
      }

      update.eveningStatus =
        'dropped_at_home';

      update.eveningDroppedAtHomeAt =
        eventTime;

    }

    else {

      throw new Error(
        `Invalid evening status: ${status}`
      );

    }

  }

  // =====================================================
  // UPDATE CORRECT STATE
  // =====================================================

  const updatedParent =
    await Parent.findOneAndUpdate(
      {
        parentId
      },
      {
        $set: update
      },
      {
        new: true,
        runValidators: true
      }
    );

  if (!updatedParent) {

    throw new Error(
      'Parent not found'
    );

  }

  // =====================================================
  // DAILY JOURNEY
  // =====================================================

  const journey =
    await getOrCreateStudentJourney(
      updatedParent,
      eventTime
    );

  if (
    rideType === 'morning'
  ) {

    if (
      status === 'picked_up'
    ) {

      journey.morning.pickedUpAt =
        eventTime;

    }

    else {

      journey.morning.droppedAtSchoolAt =
        eventTime;

    }

  }

  else {

    if (
      status === 'picked_up'
    ) {

      journey.evening.pickedFromSchoolAt =
        eventTime;

      journey.evening.droppedAtHomeAt =
        null;

    }

    else {

      journey.evening.droppedAtHomeAt =
        eventTime;

    }

  }

  await journey.save();

  return {

    parent:
      updatedParent,

    eventTime

  };

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
