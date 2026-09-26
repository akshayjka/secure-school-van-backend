const mongoose = require('mongoose');

const Parent = require('../models/parent.model');
const Driver = require('../models/driver.model');
const Ride = require('../models/ride.model');
const Attendance = require('../models/attendance.model');
const StudentJourney = require('../models/studentjourney.model');

/**
 * =========================================================
 * DATE HELPERS
 * =========================================================
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

  end.setDate(end.getDate() + 1);

  return end;
};

const getTomorrowRange = () => {
  const start = getStartOfToday();

  const tomorrowStart = new Date(start);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  const tomorrowEnd = new Date(tomorrowStart);
  tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

  return {
    start: tomorrowStart,
    end: tomorrowEnd
  };
};

const getTodayRange = () => ({
  start: getStartOfToday(),
  end: getEndOfToday()
});

const getJourneyDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(
    date.getMonth() + 1
  ).padStart(2, '0');

  const day = String(
    date.getDate()
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
};


/**
 * =========================================================
 * JOURNEY
 * =========================================================
 */

const getOrCreateStudentJourney = async (
  parent,
  date
) => {

  return StudentJourney.findOneAndUpdate(
    {
      parentId: parent.parentId,
      date: getJourneyDate(date)
    },
    {
      $setOnInsert: {
        parentId: parent.parentId,
        driverId: parent.driverId,
        studentName: parent.studentName,
        date: getJourneyDate(date)
      }
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    }
  );
};


/**
 * =========================================================
 * DRIVER RESOLUTION
 * =========================================================
 */

const createDriverId = async () => {

  for (
    let attempt = 0;
    attempt < 10;
    attempt += 1
  ) {

    const candidate =
      `DRV${Date.now()}${Math.floor(
        100 + Math.random() * 900
      )}`;

    const exists =
      await Driver.exists({
        driverId: candidate
      });

    if (!exists) {
      return candidate;
    }
  }

  throw new Error(
    'Unable to generate a unique Driver ID'
  );
};


const resolveOrCreateDriver = async (data) => {

  const suppliedDriverId =
    String(data?.driverId || '').trim();

  const driverMobile =
    String(
      data?.driverMobile ||
      data?.mobileNumber ||
      ''
    ).replace(/\D/g, '');

  const driverName =
    String(
      data?.driverName || ''
    ).trim();

  if (!driverMobile) {
    throw new Error(
      'Driver mobile number is required when registering a new parent'
    );
  }

  if (!/^[6-9][0-9]{9}$/.test(driverMobile)) {
    throw new Error(
      'Valid driver mobile number is required'
    );
  }

  if (suppliedDriverId) {

    const byId =
      await Driver.findOne({
        driverId: suppliedDriverId
      });

    if (byId) {
      return byId;
    }
  }

  const byMobile =
    await Driver.findOne({
      mobileNumber: driverMobile
    });

  if (byMobile) {
    return byMobile;
  }

  const generatedDriverId =
    await createDriverId();

  return Driver.create({

    driverId: generatedDriverId,

    role: 'driver',

    name:
      driverName ||
      'Pending Driver',

    mobileNumber:
      driverMobile,

    password: null,

    vehicleNumber:
      String(
        data?.driverVehicleNumber || ''
      ).trim() ||
      'Pending',

    routeArea:
      String(
        data?.driverRouteArea || ''
      ).trim() ||
      'Pending',

    isVerified: false,

    registrationSource:
      'parent_onboarding'
  });
};


/**
 * =========================================================
 * ADD PARENT
 * =========================================================
 */

const addParent = async (data) => {

  const existingDriverId =
    String(
      data?.driverId || ''
    ).trim();

  const driverMobile =
    String(
      data?.driverMobile || ''
    ).replace(/\D/g, '');

  const existingDriver =
    existingDriverId
      ? await Driver.findOne({
          driverId: existingDriverId
        })
      : await Driver.findOne({
          mobileNumber: driverMobile
        });

  const driver =
    existingDriver ||
    await resolveOrCreateDriver(data);

  const driverWasCreatedForParent =
    !existingDriver &&
    driver?.registrationSource ===
      'parent_onboarding';

  if (!driver?.driverId) {
    throw new Error(
      'Unable to resolve or create driver'
    );
  }

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

  const existingParent =
    await Parent.findOne({
      mobileNumber: data.mobileNumber
    });

  if (existingParent) {
    throw new Error(
      'Parent already registered'
    );
  }

  const parentId =
    `PAR${Date.now()}`;

  const parentData = {

    ...data,

    driverId:
      driver.driverId,

    driverMobile:
      driver.mobileNumber,

    driverName:
      driver.name,

    driverVehicleNumber:
      driver.vehicleNumber,

    driverRouteArea:
      driver.routeArea,

    parentId,

    role: 'parent',

    pickupLocation: {
      latitude: pickupLatitude,
      longitude: pickupLongitude
    },

    schoolLocation: {
      latitude: schoolLatitude,
      longitude: schoolLongitude
    },

    attendance: false,

    morningStatus: 'waiting',

    eveningStatus:
      'waiting_school_finish'
  };

  try {

    return await Parent.create(
      parentData
    );

  } catch (error) {

    if (
      driverWasCreatedForParent &&
      driver?._id
    ) {

      try {

        await Driver.deleteOne({
          _id: driver._id
        });

      } catch (cleanupError) {

        console.error(
          'Failed to rollback pending driver:',
          cleanupError
        );
      }
    }

    throw error;
  }
};


/**
 * =========================================================
 * CRUD
 * =========================================================
 */

const getAllParents = async () => {

  return Parent.find()
    .sort({
      createdAt: -1
    });
};


const getParent = async (id) => {

  let parent = null;

  if (
    mongoose.Types.ObjectId.isValid(id)
  ) {

    parent =
      await Parent.findById(id);
  }

  if (!parent) {

    parent =
      await Parent.findOne({
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


const updateParent = async (
  id,
  data
) => {

  return Parent.findByIdAndUpdate(
    id,
    data,
    {
      new: true,
      runValidators: true
    }
  );
};


const deleteParent = async (
  id
) => {

  return Parent.findByIdAndDelete(id);
};


/**
 * =========================================================
 * ACTIVE RIDE
 * =========================================================
 */

const getActiveRideForDriver = async (
  driverId
) => {

  if (!driverId) {
    return null;
  }

  const {
    start,
    end
  } = getTodayRange();

  return Ride.findOne({

    driverId,

    status: 'started',

    createdAt: {
      $gte: start,
      $lt: end
    }

  }).sort({
    createdAt: -1
  });
};


/**
 * =========================================================
 * LATEST RIDE
 *
 * Used for completed/after-ride screen.
 * =========================================================
 */

const getLatestRideForDriver = async (
  driverId,
  rideType = null
) => {

  if (!driverId) {
    return null;
  }

  const {
    start,
    end
  } = getTodayRange();

  const query = {

    driverId,

    createdAt: {
      $gte: start,
      $lt: end
    }
  };

  if (rideType) {
    query.rideType = rideType;
  }

  return Ride.findOne(query)
    .sort({
      createdAt: -1
    });
};


/**
 * =========================================================
 * DURATION
 * =========================================================
 */

const calculateDurationMinutes = (
  start,
  end
) => {

  if (!start || !end) {
    return null;
  }

  const startDate =
    new Date(start);

  const endDate =
    new Date(end);

  if (
    Number.isNaN(
      startDate.getTime()
    ) ||
    Number.isNaN(
      endDate.getTime()
    )
  ) {
    return null;
  }

  const difference =
    endDate.getTime() -
    startDate.getTime();

  if (difference < 0) {
    return null;
  }

  return Math.round(
    difference / 60000
  );
};


/**
 * =========================================================
 * PARENT DASHBOARD
 * =========================================================
 */

const getDashboard = async (parentId) => {
  const parent = await Parent.findOne({ parentId });

  if (!parent) {
    throw new Error('Parent not found');
  }

  const driver = await Driver.findOne({
    driverId: parent.driverId
  });

  const {
    start: todayStart,
    end: todayEnd
  } = getTodayRange();

  // ---------------------------------------------------------
  // TODAY ATTENDANCE
  // ---------------------------------------------------------
  const todayAttendance = await Attendance.findOne({
    parentId: parent.parentId,
    date: {
      $gte: todayStart,
      $lt: todayEnd
    }
  }).sort({
    date: -1
  });

  const todayAttendanceStatus =
    todayAttendance?.status || 'not_marked';

  const isPresent =
    todayAttendanceStatus === 'present';

  // ---------------------------------------------------------
  // TOMORROW ATTENDANCE
  // ---------------------------------------------------------
  const {
    start: tomorrowStart,
    end: tomorrowEnd
  } = getTomorrowRange();

  const tomorrowAttendance = await Attendance.findOne({
    parentId: parent.parentId,
    date: {
      $gte: tomorrowStart,
      $lt: tomorrowEnd
    }
  }).sort({
    date: -1
  });

  const tomorrowAttendanceStatus =
    tomorrowAttendance?.status || 'not_marked';

  // ---------------------------------------------------------
  // ACTIVE RIDE - SOURCE OF TRUTH
  // ---------------------------------------------------------
  const activeRide =
    await getActiveRideForDriver(parent.driverId);

  const rideStarted =
    Boolean(activeRide);

  const rideStatus =
    activeRide?.status || null;

  const rideId =
    activeRide?.rideId || null;

  const rideStartTime =
    activeRide?.startTime || null;

  const rideEndTime =
    activeRide?.endTime || null;

  /*
   * IMPORTANT:
   *
   * rideType is ONLY the active ride type.
   *
   * If the driver has not started the evening ride,
   * rideType MUST be null.
   */
  const rideType =
    activeRide?.rideType || null;

  // ---------------------------------------------------------
  // TODAY'S LATEST MORNING / EVENING RIDES
  // ---------------------------------------------------------
  const morningRide =
    await getLatestRideForDriver(
      parent.driverId,
      'morning'
    );

  const eveningRide =
    await getLatestRideForDriver(
      parent.driverId,
      'evening'
    );

  // ---------------------------------------------------------
  // EXPLICIT COMPLETION CONTEXT
  // ---------------------------------------------------------
  //
  // A student status such as dropped_at_home is not enough.
  // We also require a TODAY ended Ride of the matching type.
  //
  const morningRideCompleted =
    Boolean(
      morningRide &&
      morningRide.status === 'ended' &&
      parent.morningStatus === 'dropped_at_school'
    );

  const eveningRideCompleted =
    Boolean(
      eveningRide &&
      eveningRide.status === 'ended' &&
      parent.eveningStatus === 'dropped_at_home'
    );

  let completedRideType = null;

  if (eveningRideCompleted) {
    completedRideType = 'evening';
  } else if (morningRideCompleted) {
    completedRideType = 'morning';
  }

  /*
   * The next ride is useful when the current active ride is null.
   *
   * After the morning journey has completed, the next journey
   * is the return journey.
   */
  let nextRideType = null;

  if (
    !rideStarted &&
    !eveningRideCompleted &&
    parent.morningStatus === 'dropped_at_school' &&
    parent.eveningStatus !== 'dropped_at_home'
  ) {
    nextRideType = 'evening';
  } else if (
    !rideStarted &&
    !morningRideCompleted &&
    parent.morningStatus !== 'dropped_at_school'
  ) {
    nextRideType = 'morning';
  }

  // ---------------------------------------------------------
  // STUDENT STATUS
  // ---------------------------------------------------------
  //
  // ACTIVE RIDE:
  //   use the status belonging to that active ride.
  //
  // NO ACTIVE RIDE:
  //   return a completed status ONLY when today's matching
  //   ride has actually ended.
  //
  //   otherwise return the next/current pending state.
  //
  let studentStatus = 'waiting';

  if (rideStarted && rideType === 'morning') {
    studentStatus =
      parent.morningStatus || 'waiting';
  } else if (rideStarted && rideType === 'evening') {
    studentStatus =
      parent.eveningStatus || 'waiting_school_finish';
  } else if (eveningRideCompleted) {
    studentStatus = 'dropped_at_home';
  } else if (morningRideCompleted) {
    studentStatus = 'dropped_at_school';
  } else if (
    nextRideType === 'evening'
  ) {
    /*
     * This is the exact state shown in the driver screenshot:
     *
     * Return Journey -> READY
     * Start Return has not been pressed.
     */
    studentStatus = 'waiting_school_finish';
  } else {
    studentStatus = 'waiting';
  }

  // ---------------------------------------------------------
  // TRACKING
  // ---------------------------------------------------------
  let trackingAvailable = false;

  if (
    rideStarted &&
    parent.attendance === true
  ) {
    if (
      rideType === 'morning' &&
      parent.morningStatus === 'picked_up'
    ) {
      trackingAvailable = true;
    }

    if (
      rideType === 'evening' &&
      parent.eveningStatus === 'picked_from_school'
    ) {
      trackingAvailable = true;
    }
  }

  // ---------------------------------------------------------
  // CURRENT RIDE MESSAGE
  // ---------------------------------------------------------
  let rideDirection = null;

  let rideMessageTitle =
    'No Active Ride';

  let rideMessage =
    'The school van is not currently on a trip.';

  if (
    rideStarted &&
    rideType === 'morning'
  ) {
    rideDirection =
      'Home → School';

    rideMessageTitle =
      'Morning Ride Started';

    rideMessage =
      'The van is heading to pick up your student.';
  } else if (
    rideStarted &&
    rideType === 'evening'
  ) {
    rideDirection =
      'School → Home';

    rideMessageTitle =
      'Return Trip Started';

    rideMessage =
      'The van is heading to school to pick up your student.';
  } else if (
    nextRideType === 'evening'
  ) {
    rideDirection =
      'School → Home';

    rideMessageTitle =
      'Return Ride Pending';

    rideMessage =
      'The driver has not started the return ride from school yet.';
  } else if (
    nextRideType === 'morning'
  ) {
    rideDirection =
      'Home → School';

    rideMessageTitle =
      'Morning Ride Pending';

    rideMessage =
      'The driver has not started the morning ride yet.';
  } else if (
    completedRideType === 'evening'
  ) {
    rideDirection =
      'School → Home';

    rideMessageTitle =
      'Arrived Home';

    rideMessage =
      parent.eveningDroppedAtHomeAt
        ? `Your student reached home at ${parent.eveningDroppedAtHomeAt}.`
        : 'Your student has reached home safely.';
  } else if (
    completedRideType === 'morning'
  ) {
    rideDirection =
      'Home → School';

    rideMessageTitle =
      'Arrived at School';

    rideMessage =
      parent.morningDroppedAtSchoolAt
        ? `Your student reached school at ${parent.morningDroppedAtSchoolAt}.`
        : 'Your student has reached school safely.';
  }

  // ---------------------------------------------------------
  // JOURNEY DURATIONS
  // ---------------------------------------------------------
  const morningJourneyDuration =
    calculateDurationMinutes(
      parent.morningPickedUpAt,
      parent.morningDroppedAtSchoolAt
    );

  const eveningJourneyDuration =
    calculateDurationMinutes(
      parent.eveningPickedFromSchoolAt,
      parent.eveningDroppedAtHomeAt
    );

  // ---------------------------------------------------------
  // RETURN
  // ---------------------------------------------------------
  return {
    studentName:
      parent.studentName,

    schoolName:
      parent.schoolName,

    pickupArea:
      parent.pickupArea,

    dropArea:
      parent.dropArea,

    // TODAY ATTENDANCE
    attendance:
      isPresent,

    todayAttendanceStatus,

    todayAttendanceDate:
      todayAttendance?.date || null,

    // TOMORROW ATTENDANCE
    tomorrowAttendanceStatus,

    tomorrowAttendanceDate:
      tomorrowAttendance?.date || null,

    // RAW STUDENT STATUS FIELDS
    morningStatus:
      parent.morningStatus,

    eveningStatus:
      parent.eveningStatus,

    /*
     * IMPORTANT:
     * studentStatus above is now ride-aware.
     */
    studentStatus,

    // AUTHORITATIVE CURRENT RIDE
    rideStarted,

    rideStatus,

    rideId,

    rideStartTime,

    rideEndTime,

    rideType,

    rideDirection,

    rideMessageTitle,

    rideMessage,

    trackingAvailable,

    // COMPLETION / NEXT-RIDE CONTEXT
    completedRideType,

    lastCompletedRideType:
      completedRideType,

    lastCompletedRideId:
      completedRideType === 'evening'
        ? eveningRide?.rideId || null
        : completedRideType === 'morning'
          ? morningRide?.rideId || null
          : null,

    lastCompletedRideEndTime:
      completedRideType === 'evening'
        ? eveningRide?.endTime || null
        : completedRideType === 'morning'
          ? morningRide?.endTime || null
          : null,

    nextRideType,

    // JOURNEY
    journeyTimes: {
      morningPickedUpAt:
        parent.morningPickedUpAt || null,

      morningDroppedAtSchoolAt:
        parent.morningDroppedAtSchoolAt || null,

      eveningPickedFromSchoolAt:
        parent.eveningPickedFromSchoolAt || null,

      eveningDroppedAtHomeAt:
        parent.eveningDroppedAtHomeAt || null,

      morningJourneyDurationMinutes:
        morningJourneyDuration,

      eveningJourneyDurationMinutes:
        eveningJourneyDuration
    },

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
 * =========================================================
 * TODAY ATTENDANCE
 * =========================================================
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
        $set: {
          attendance
        }
      },

      {
        new: true,
        runValidators: true
      }
    );

  if (!parent) {
    throw new Error(
      'Parent not found'
    );
  }

  return parent;
};


/**
 * =========================================================
 * TOMORROW ATTENDANCE
 * =========================================================
 */

const updateTomorrowAttendance = async (
  parentId,
  status
) => {

  if (
    !['present', 'absent']
      .includes(status)
  ) {

    throw new Error(
      'Tomorrow attendance must be present or absent'
    );
  }


  let parent = null;


  if (
    mongoose.Types.ObjectId.isValid(
      parentId
    )
  ) {

    parent =
      await Parent.findById(
        parentId
      );
  }


  if (!parent) {

    parent =
      await Parent.findOne({
        parentId
      });
  }


  if (!parent) {

    throw new Error(
      'Parent not found'
    );
  }


  const {
    start,
    end
  } = getTomorrowRange();


  const tomorrowDate =
    new Date(start);


  const record =
    await Attendance.findOneAndUpdate(

      {
        parentId:
          parent.parentId,

        date: {
          $gte: start,
          $lt: end
        }
      },

      {
        $set: {
          parentId:
            parent.parentId,

          date:
            tomorrowDate,

          status
        }
      },

      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );


  return {
    parent,
    record,
    status,
    date: tomorrowDate
  };
};


/**
 * =========================================================
 * STUDENT STATUS
 * =========================================================
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


  if (parent.attendance !== true) {

    throw new Error(
      'Absent students cannot be picked up'
    );
  }


  const activeRide =
    await getActiveRideForDriver(
      parent.driverId
    );


  if (!activeRide) {

    throw new Error(
      'Ride must be started before updating student status'
    );
  }


  if (
    activeRide.rideType !== rideType
  ) {

    throw new Error(
      `The active ride is ${activeRide.rideType}; ${rideType} student update is not allowed`
    );
  }


  const eventTime =
    new Date();

  const update = {};


  /**
   * MORNING
   */

  if (
    rideType === 'morning'
  ) {

    if (
      status === 'picked_up'
    ) {

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


  /**
   * EVENING
   */

  else {

    if (
      status === 'picked_up'
    ) {

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

    } else {

      journey.morning
        .droppedAtSchoolAt =
        eventTime;
    }

  } else {

    if (
      status === 'picked_up'
    ) {

      journey.evening
        .pickedFromSchoolAt =
        eventTime;

      journey.evening
        .droppedAtHomeAt =
        null;

    } else {

      journey.evening
        .droppedAtHomeAt =
        eventTime;
    }
  }


  await journey.save();


  return {

    parent:
      updatedParent,

    eventTime,

    rideId:
      activeRide.rideId,

    rideType:
      activeRide.rideType
  };
};


/**
 * =========================================================
 * BACKWARD COMPATIBILITY
 * =========================================================
 */

const pickStudentMorning =
  async (parentId) => {

    return updateStudentStatus(
      parentId,
      'morning',
      'picked_up'
    );
  };


const dropStudentSchool =
  async (parentId) => {

    return updateStudentStatus(
      parentId,
      'morning',
      'dropped_at_school'
    );
  };


const pickStudentFromSchool =
  async (parentId) => {

    return updateStudentStatus(
      parentId,
      'evening',
      'picked_up'
    );
  };


const dropStudentHome =
  async (parentId) => {

    return updateStudentStatus(
      parentId,
      'evening',
      'dropped_at_home'
    );
  };


/**
 * =========================================================
 * MONTHLY ATTENDANCE
 * =========================================================
 */

const saveMonthlyAttendance = async (
  parentId,
  year,
  month,
  records
) => {

  let parent = null;

  if (
    mongoose.Types.ObjectId.isValid(
      parentId
    )
  ) {

    parent =
      await Parent.findById(
        parentId
      );
  }


  if (!parent) {

    parent =
      await Parent.findOne({
        parentId
      });
  }


  if (!parent) {

    throw new Error(
      `Parent not found: ${parentId}`
    );
  }


  const startDate =
    new Date(
      Number(year),
      Number(month) - 1,
      1
    );


  const endDate =
    new Date(
      Number(year),
      Number(month),
      1
    );


  await Attendance.deleteMany({

    parentId:
      parent.parentId,

    date: {
      $gte: startDate,
      $lt: endDate
    }
  });


  if (
    Array.isArray(records) &&
    records.length > 0
  ) {

    const documents =
      records.map(record => {

        const attendanceDate =
          new Date(record.date);


        if (
          Number.isNaN(
            attendanceDate.getTime()
          )
        ) {

          throw new Error(
            `Invalid date: ${record.date}`
          );
        }


        return {

          parentId:
            parent.parentId,

          date:
            attendanceDate,

          status:
            record.status
        };
      });


    await Attendance.insertMany(
      documents
    );
  }


  const savedRecords =
    await Attendance.find({

      parentId:
        parent.parentId,

      date: {
        $gte: startDate,
        $lt: endDate
      }

    }).sort({
      date: 1
    });


  return {

    parent,

    parentId:
      parent.parentId,

    year:
      Number(year),

    month:
      Number(month),

    records:
      savedRecords
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

  updateTomorrowAttendance,

  pickStudentMorning,

  dropStudentSchool,

  pickStudentFromSchool,

  dropStudentHome,

  updateStudentStatus,

  saveMonthlyAttendance
};