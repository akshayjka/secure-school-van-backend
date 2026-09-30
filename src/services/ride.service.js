const Ride = require('../models/ride.model');
const Parent = require('../models/parent.model');
const StudentJourney = require('../models/studentjourney.model');

/**
 * =========================================================
 * DATE HELPERS
 * =========================================================
 * The application currently uses the Node server's local
 * timezone. For production, set the server timezone explicitly
 * to the school's business timezone (for example Asia/Kolkata).
 */
const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  return { start, end };
};

const getBusinessDate = (date = new Date()) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const getJourneyDate = (date = new Date()) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const validateRideType = rideType => {
  if (!['morning', 'evening'].includes(rideType)) {
    throw new Error('Invalid rideType');
  }
};

const getTodayRide = async (driverId, rideType, status) => {
  const { start, end } = getTodayRange();
  const query = {
    driverId,
    rideType,
    startTime: { $gte: start, $lt: end }
  };

  if (status) query.status = status;

  return Ride.findOne(query).sort({ startTime: -1 });
};

const getTodayPresentStudents = async driverId => {
  return Parent.find({
    driverId,
    attendance: true
  });
};

const ensureActiveRide = async (driverId, rideType) => {
  if (!driverId) throw new Error('driverId is required');
  validateRideType(rideType);

  const ride = await getTodayRide(driverId, rideType, 'started');

  if (!ride) {
    throw new Error(`${rideType === 'morning' ? 'Morning' : 'Return'} ride must be started before this action`);
  }

  return ride;
};

const getOrCreateStudentJourney = async (parent, date) => {
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

const assertMorningCompletedBeforeReturn = async driverId => {
  const morningRide = await getTodayRide(driverId, 'morning');

  if (!morningRide || morningRide.status !== 'ended') {
    throw new Error('Morning ride must be completed before starting the return ride');
  }

  const students = await getTodayPresentStudents(driverId);

  if (students.length === 0) {
    throw new Error('No present students are available for the return ride');
  }

  const incomplete = students.filter(
    student => student.morningStatus !== 'dropped_at_school'
  );

  if (incomplete.length > 0) {
    throw new Error(
      `Complete school drop-off for all present students before starting the return ride. ${incomplete.length} student(s) remaining.`
    );
  }

  return { morningRide, students };
};

const assertAllMorningStudentsDropped = async driverId => {
  const students = await getTodayPresentStudents(driverId);

  if (students.length === 0) {
    throw new Error('No present students are available for the morning ride');
  }

  const incomplete = students.filter(
    student => student.morningStatus !== 'dropped_at_school'
  );

  if (incomplete.length > 0) {
    throw new Error(
      `Cannot end morning ride. ${incomplete.length} present student(s) are not dropped at school.`
    );
  }
};

const assertAllReturnStudentsDropped = async driverId => {
  const students = await getTodayPresentStudents(driverId);

  if (students.length === 0) {
    throw new Error('No present students are available for the return ride');
  }

  const incomplete = students.filter(
    student => student.eveningStatus !== 'dropped_at_home'
  );

  if (incomplete.length > 0) {
    throw new Error(
      `Cannot end return ride. ${incomplete.length} present student(s) are not dropped at home.`
    );
  }
};

/**
 * =========================================================
 * START RIDE
 * =========================================================
 */
exports.startRide = async (driverId, rideType) => {
  if (!driverId) throw new Error('driverId is required');
  validateRideType(rideType);

  // Never allow a second ride of the same type on the same day.
  const existingRide = await getTodayRide(driverId, rideType);

  if (existingRide) {
    if (existingRide.status === 'started') {
      return {
        ride: existingRide,
        alreadyStarted: true
      };
    }

    throw new Error(
      `${rideType === 'morning' ? 'Morning' : 'Return'} ride has already been completed today`
    );
  }

  // Only one ride can be active at a time.
  const activeRide = await Ride.findOne({
    driverId,
    status: 'started'
  }).sort({ startTime: -1 });

  if (activeRide) {
    throw new Error(
      `Cannot start ${rideType} ride while ${activeRide.rideType} ride ${activeRide.rideId} is active`
    );
  }

  const students = await getTodayPresentStudents(driverId);

  if (students.length === 0) {
    throw new Error('No present students available for this ride');
  }

  if (rideType === 'evening') {
    await assertMorningCompletedBeforeReturn(driverId);
  }

  const rideCount = await Ride.countDocuments();
  const now = new Date();
  const rideDate = getBusinessDate(now);

  let ride;

  try {
    ride = await Ride.create({
      rideId: `RIDE${String(rideCount + 1).padStart(6, '0')}`,
      driverId,
      rideType,
      rideDate,
      status: 'started',
      startTime: now,
      locations: []
    });
  } catch (error) {
    // Concurrent start requests can race the application-level check.
    // The sparse unique index is the final guard.
    if (error?.code === 11000 && error?.keyPattern?.rideDate) {
      const concurrentRide = await Ride.findOne({
        driverId,
        rideType,
        rideDate
      }).sort({ startTime: -1 });

      if (concurrentRide?.status === 'started') {
        return { ride: concurrentRide, alreadyStarted: true };
      }
    }

    throw error;
  }

  // A status reset is allowed ONLY when creating the first ride
  // of the day. Since duplicate rides are blocked above, this
  // cannot overwrite a completed journey.
  if (rideType === 'morning') {
    await Parent.updateMany(
      { driverId, attendance: true },
      {
        $set: {
          morningStatus: 'waiting',
          morningPickedUpAt: null,
          morningDroppedAtSchoolAt: null
        }
      }
    );
  } else {
    await Parent.updateMany(
      { driverId, attendance: true },
      {
        $set: {
          eveningStatus: 'waiting_school_finish',
          eveningPickedFromSchoolAt: null,
          eveningDroppedAtHomeAt: null
        }
      }
    );
  }

  return {
    ride,
    alreadyStarted: false
  };
};

/**
 * =========================================================
 * END RIDE
 * =========================================================
 */
exports.endRide = async (driverId, rideType) => {
  const ride = await ensureActiveRide(driverId, rideType);

  if (rideType === 'morning') {
    await assertAllMorningStudentsDropped(driverId);
  } else {
    await assertAllReturnStudentsDropped(driverId);
  }

  ride.status = 'ended';
  ride.endTime = new Date();
  await ride.save();

  return ride;
};

/**
 * =========================================================
 * LOCATION
 * =========================================================
 */
exports.updateLocation = async (
  driverId,
  rideType,
  latitude,
  longitude
) => {
  const ride = await ensureActiveRide(driverId, rideType);

  const lat = Number(latitude);
  const lng = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Valid latitude and longitude are required');
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new Error('Invalid GPS coordinates');
  }

  ride.currentLatitude = lat;
  ride.currentLongitude = lng;

  if (!Array.isArray(ride.locations)) ride.locations = [];

  ride.locations.push({
    latitude: lat,
    longitude: lng,
    timestamp: new Date()
  });

  if (ride.locations.length > 5000) {
    ride.locations = ride.locations.slice(-5000);
  }

  await ride.save();
  return ride;
};

/**
 * =========================================================
 * RIDE STATUS
 * =========================================================
 */
exports.getRideStatus = async (
  driverId,
  rideType,
  parentId = null
) => {
  if (!driverId) throw new Error('driverId is required');
  if (rideType) validateRideType(rideType);

  const query = {
    driverId,
    status: 'started'
  };

  if (rideType) query.rideType = rideType;

  const activeRide = rideType
    ? await getTodayRide(driverId, rideType, 'started')
    : await Ride.findOne(query).sort({ startTime: -1 });

  let parent = null;

  if (parentId) {
    parent = await Parent.findOne({ parentId, driverId });
  }

  const actualRideType = activeRide?.rideType || rideType || null;

  const studentStatus = parent
    ? actualRideType === 'morning'
      ? parent.morningStatus
      : actualRideType === 'evening'
        ? parent.eveningStatus
        : null
    : null;

  const trackingAvailable = Boolean(
    activeRide &&
    parent &&
    parent.attendance === true &&
    (
      (actualRideType === 'morning' && parent.morningStatus === 'picked_up') ||
      (actualRideType === 'evening' && parent.eveningStatus === 'picked_from_school')
    )
  );

  return {
    rideStarted: Boolean(activeRide),
    status: activeRide?.status || 'ended',
    rideId: activeRide?.rideId || null,
    rideType: activeRide?.rideType || null,
    startTime: activeRide?.startTime || null,
    endTime: activeRide?.endTime || null,
    currentLatitude: activeRide?.currentLatitude ?? null,
    currentLongitude: activeRide?.currentLongitude ?? null,
    updatedAt: activeRide?.updatedAt || null,
    studentStatus,
    trackingAvailable,
    journeyTimes: {
      morningPickedUpAt: parent?.morningPickedUpAt || null,
      morningDroppedAtSchoolAt: parent?.morningDroppedAtSchoolAt || null,
      eveningPickedFromSchoolAt: parent?.eveningPickedFromSchoolAt || null,
      eveningDroppedAtHomeAt: parent?.eveningDroppedAtHomeAt || null
    }
  };
};

/**
 * =========================================================
 * MORNING PICKUP
 * =========================================================
 */
exports.pickStudentMorning = async (driverId, parentId) => {
  const ride = await ensureActiveRide(driverId, 'morning');
  const now = new Date();

  const parent = await Parent.findOneAndUpdate(
    {
      parentId,
      driverId,
      attendance: true,
      morningStatus: 'waiting'
    },
    {
      $set: {
        morningStatus: 'picked_up',
        morningPickedUpAt: now
      }
    },
    {
      new: true,
      runValidators: true
    }
  );

  if (!parent) {
    throw new Error('Student is not waiting for morning pickup');
  }

  const journey = await getOrCreateStudentJourney(parent, now);
  journey.morning.pickedUpAt = now;
  await journey.save();

  return { parent, timestamp: now, rideId: ride.rideId };
};

/**
 * =========================================================
 * MORNING SCHOOL DROP
 * =========================================================
 */
exports.dropStudentSchool = async (driverId, parentId) => {
  const ride = await ensureActiveRide(driverId, 'morning');
  const now = new Date();

  const parent = await Parent.findOneAndUpdate(
    {
      parentId,
      driverId,
      attendance: true,
      morningStatus: 'picked_up'
    },
    {
      $set: {
        morningStatus: 'dropped_at_school',
        morningDroppedAtSchoolAt: now
      }
    },
    {
      new: true,
      runValidators: true
    }
  );

  if (!parent) {
    throw new Error('Student must be picked up before school drop');
  }

  const journey = await getOrCreateStudentJourney(parent, now);
  journey.morning.droppedAtSchoolAt = now;
  await journey.save();

  return { parent, timestamp: now, rideId: ride.rideId };
};

/**
 * =========================================================
 * EVENING PICKUP FROM SCHOOL
 * =========================================================
 */
exports.pickStudentFromSchool = async (driverId, parentId) => {
  const ride = await ensureActiveRide(driverId, 'evening');
  const now = new Date();

  const parent = await Parent.findOneAndUpdate(
    {
      parentId,
      driverId,
      attendance: true,
      eveningStatus: 'waiting_school_finish'
    },
    {
      $set: {
        eveningStatus: 'picked_from_school',
        eveningPickedFromSchoolAt: now,
        eveningDroppedAtHomeAt: null
      }
    },
    {
      new: true,
      runValidators: true
    }
  );

  if (!parent) {
    throw new Error('Student is not waiting for school pickup');
  }

  const journey = await getOrCreateStudentJourney(parent, now);
  journey.evening.pickedFromSchoolAt = now;
  journey.evening.droppedAtHomeAt = null;
  await journey.save();

  return { parent, timestamp: now, rideId: ride.rideId };
};

/**
 * =========================================================
 * EVENING DROP AT HOME
 * =========================================================
 */
exports.dropStudentHome = async (driverId, parentId) => {
  const ride = await ensureActiveRide(driverId, 'evening');
  const now = new Date();

  const parent = await Parent.findOneAndUpdate(
    {
      parentId,
      driverId,
      attendance: true,
      eveningStatus: 'picked_from_school'
    },
    {
      $set: {
        eveningStatus: 'dropped_at_home',
        eveningDroppedAtHomeAt: now
      }
    },
    {
      new: true,
      runValidators: true
    }
  );

  if (!parent) {
    throw new Error('Student is not currently on the return van');
  }

  const journey = await getOrCreateStudentJourney(parent, now);
  journey.evening.droppedAtHomeAt = now;
  await journey.save();

  return { parent, timestamp: now, rideId: ride.rideId };
};

/**
 * =========================================================
 * JOURNEY REPORT
 * =========================================================
 */
exports.getStudentJourneyReport = async (parentId, date) => {
  if (!parentId) throw new Error('parentId is required');
  if (!date) throw new Error('date is required');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Invalid date format. Expected YYYY-MM-DD');
  }

  const parent = await Parent.findOne({ parentId });
  if (!parent) throw new Error('Parent not found');

  const journey = await StudentJourney.findOne({ parentId, date });

  return {
    date,
    studentName: parent.studentName,
    schoolName: parent.schoolName,
    morning: {
      direction: 'Home → School',
      pickedUpAt: journey?.morning?.pickedUpAt || null,
      droppedAtSchoolAt: journey?.morning?.droppedAtSchoolAt || null
    },
    evening: {
      direction: 'School → Home',
      pickedFromSchoolAt: journey?.evening?.pickedFromSchoolAt || null,
      droppedAtHomeAt: journey?.evening?.droppedAtHomeAt || null
    }
  };
};

module.exports.getTodayRange = getTodayRange;


/**
 * =========================================================
 * TEST-ONLY FULL DAY RESET
 * =========================================================
 *
 * Development/testing helper.
 * It removes today's morning/evening Ride documents and
 * today's StudentJourney documents, then puts today's
 * student journey states back to the initial state.
 *
 * Attendance is intentionally NOT deleted. A student who is
 * marked present remains present, so the driver can immediately
 * test another Home -> School -> Home cycle.
 *
 * This method must only be exposed through the test-reset
 * controller endpoint, which is disabled in production.
 */
exports.resetTestCycle = async driverId => {
  if (!driverId) {
    throw new Error('driverId is required');
  }

  const { start, end } = getTodayRange();

  // TEST MODE ONLY.
  // This endpoint intentionally recovers stale/inconsistent test state.
  // It must never be enabled in production.

  const ridesToday = await Ride.find({
    driverId,
    startTime: { $gte: start, $lt: end }
  }).select({
    rideId: 1,
    rideType: 1,
    status: 1
  });

  const parents = await Parent.find({
    driverId
  }).select({
    parentId: 1
  });

  const parentIds = parents
    .map(parent => parent.parentId)
    .filter(Boolean);

  // IMPORTANT: do NOT reject an active/stale ride here.
  // The purpose of this testing endpoint is to clean up exactly that case.
  const rideDeleteResult = await Ride.deleteMany({
    driverId,
    startTime: { $gte: start, $lt: end }
  });

  const journeyDeleteResult = await StudentJourney.deleteMany({
    driverId,
    date: getJourneyDate(new Date())
  });

  // Attendance is preserved. Only today's journey state is reset.
  const parentResetResult = await Parent.updateMany(
    { driverId },
    {
      $set: {
        morningStatus: 'waiting',
        morningPickedUpAt: null,
        morningDroppedAtSchoolAt: null,
        eveningStatus: 'waiting_school_finish',
        eveningPickedFromSchoolAt: null,
        eveningDroppedAtHomeAt: null
      }
    }
  );

  return {
    driverId,
    date: getBusinessDate(new Date()),
    reset: true,
    forceReset: true,
    parentIds,
    previousRides: ridesToday.map(ride => ({
      rideId: ride.rideId,
      rideType: ride.rideType,
      status: ride.status
    })),
    studentsReset:
      parentResetResult.modifiedCount ??
      parentResetResult.nModified ??
      0,
    ridesDeleted:
      rideDeleteResult.deletedCount ??
      0,
    journeysDeleted:
      journeyDeleteResult.deletedCount ??
      0,
    nextRide: 'morning'
  };
};
