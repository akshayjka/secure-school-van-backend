const Ride = require('../models/ride.model');

const Parent = require('../models/parent.model');

const StudentJourney = require('../models/studentjourney.model');
const crypto = require('crypto');


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




const getTodayRide = async (
  driverId,
  rideType,
  status,
  cycleNumber
) => {
  const { start, end } = getTodayRange();

  const query = {
    driverId,
    rideType,
    startTime: { $gte: start, $lt: end }
  };

  if (status) {
    query.status = status;
  }

  if (cycleNumber != null) {
    query.cycleNumber = cycleNumber;
  }

  return Ride.findOne(query).sort({ startTime: -1 });
};



const getLatestTodayRide = async driverId => {
  const { start, end } = getTodayRange();

  return Ride.findOne({
    driverId,
    startTime: { $gte: start, $lt: end }
  }).sort({ startTime: -1 });
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


const getOrCreateStudentJourney = async (
  parent,
  date,
  cycleNumber
) => {
  const journeyDate = getJourneyDate(date);
  const normalizedCycle = Number(cycleNumber || 1);

  return StudentJourney.findOneAndUpdate(
    {
      parentId: parent.parentId,
      date: journeyDate,
      cycleNumber: normalizedCycle
    },
    {
      $setOnInsert: {
        parentId: parent.parentId,
        driverId: parent.driverId,
        studentName: parent.studentName,
        date: journeyDate,
        cycleNumber: normalizedCycle
      }
    },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    }
  );
};


const assertMorningCompletedBeforeReturn = async (
  driverId,
  cycleNumber
) => {
  const morningRide = await getTodayRide(
    driverId,
    'morning',
    undefined,
    cycleNumber
  );

  if (!morningRide || morningRide.status !== 'ended') {
    throw new Error(
      'Morning ride must be completed before starting the return ride'
    );
  }

  const students = await getTodayPresentStudents(driverId);

  if (students.length === 0) {
    throw new Error(
      'No present students are available for the return ride'
    );
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


// const crypto = require('crypto');

exports.startRide = async (driverId, rideType) => {
  if (!driverId) {
    throw new Error('driverId is required');
  }

  validateRideType(rideType);

  const { start, end } = getTodayRange();

  // Never allow overlapping active rides.
  const activeRide = await Ride.findOne({
    driverId,
    status: 'started',
    startTime: { $gte: start, $lt: end }
  }).sort({ startTime: -1 });

  if (activeRide) {
    if (activeRide.rideType === rideType) {
      return {
        ride: activeRide,
        alreadyStarted: true
      };
    }

    throw new Error(
      `Cannot start ${rideType} ride while ${activeRide.rideType} ride is active`
    );
  }

  const latestRide = await getLatestTodayRide(driverId);
  let cycleNumber = 1;

  if (!latestRide) {
    if (rideType !== 'morning') {
      throw new Error(
        'Start the morning ride before the return ride'
      );
    }
  } else {
    const previousCycle = latestRide.cycleNumber || 1;

    if (latestRide.rideType === 'morning') {
      if (latestRide.status !== 'ended') {
        throw new Error('Complete the morning ride first');
      }

      if (rideType !== 'evening') {
        throw new Error(
          'Complete the return ride before starting another cycle'
        );
      }

      cycleNumber = previousCycle;

      await assertMorningCompletedBeforeReturn(
        driverId,
        cycleNumber
      );
    } else {
      if (latestRide.status !== 'ended') {
        throw new Error('Complete the return ride first');
      }

      if (rideType !== 'morning') {
        throw new Error(
          'Start the next cycle with the morning ride'
        );
      }


      // Reset only for a genuinely new ride.
await resetStudentStatusesForRide(driverId, rideType);

// Create the new ride.
const ride = await Ride.create({
  rideId: `RIDE-${crypto.randomUUID()}`,
  driverId,
  rideType,
  rideDate: now,
  cycleNumber,
  status: 'started',
  startTime: now,
  locations: []
});

      await assertAllReturnStudentsDropped(driverId);

      cycleNumber = previousCycle + 1;
    }
  }

  const students = await getTodayPresentStudents(driverId);

  if (students.length === 0) {
    throw new Error('No present students available for this ride');
  }

  const now = new Date();
  const rideDate = getBusinessDate(now);

  // Reset live Parent status only for a new morning cycle.
  // Historical Ride and StudentJourney records remain untouched.
  if (rideType === 'morning' && cycleNumber > 1) {
    await Parent.updateMany(
      { driverId, attendance: true },
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
  }

  let ride;

  try {
    ride = await Ride.create({
      rideId: `RIDE-${crypto.randomUUID()}`,
      driverId,
      rideType,
      rideDate,
      cycleNumber,
      status: 'started',
      startTime: now,
      locations: []
    });
  } catch (error) {
    if (error?.code === 11000) {
      const concurrentRide = await Ride.findOne({
        driverId,
        rideType,
        rideDate,
        cycleNumber
      }).sort({ startTime: -1 });

      if (concurrentRide?.status === 'started') {
        return {
          ride: concurrentRide,
          alreadyStarted: true
        };
      }
    }

    throw error;
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

exports.getRideStatus = async (driverId, rideType, parentId = null) => {
  if (!driverId) throw new Error('driverId is required');
  if (rideType) validateRideType(rideType);

  const query = { driverId, status: 'started' };
  if (rideType) query.rideType = rideType;

  const activeRide = rideType
    ? await getTodayRide(driverId, rideType, 'started')
    : await Ride.findOne(query).sort({ startTime: -1 });

  const parent = parentId
    ? await Parent.findOne({ parentId, driverId })
    : null;

  const actualRideType = activeRide?.rideType || rideType || null;

  const studentStatus = parent
    ? actualRideType === 'morning'
      ? parent.morningStatus
      : actualRideType === 'evening'
        ? parent.eveningStatus
        : null
    : null;

  let etaStage = 'waiting';
  let etaDestination = null;

  if (actualRideType === 'morning') {
    if (studentStatus === 'waiting') {
      etaStage = activeRide ? 'to_pickup' : 'waiting';
      etaDestination = 'home';
    } else if (studentStatus === 'picked_up') {
      etaStage = 'home_to_school';
      etaDestination = 'school';
    } else if (studentStatus === 'dropped_at_school') {
      etaStage = 'completed';
    }
  } else if (actualRideType === 'evening') {
    if (studentStatus === 'waiting_school_finish') {
      etaStage = activeRide ? 'to_pickup' : 'waiting';
      etaDestination = 'school';
    } else if (studentStatus === 'picked_from_school') {
      etaStage = 'school_to_home';
      etaDestination = 'home';
    } else if (studentStatus === 'dropped_at_home') {
      etaStage = 'completed';
    }
  }

  const trackingAvailable = Boolean(
    activeRide &&
    parent &&
    parent.attendance === true &&
    etaStage !== 'completed'
  );

  return {
    rideStarted: Boolean(activeRide),
    status: activeRide?.status || 'ended',
    rideId: activeRide?.rideId || null,
    rideType: actualRideType,
    startTime: activeRide?.startTime || null,
    endTime: activeRide?.endTime || null,
    currentLatitude: activeRide?.currentLatitude ?? null,
    currentLongitude: activeRide?.currentLongitude ?? null,
    updatedAt: activeRide?.updatedAt || null,
    studentStatus,
    trackingAvailable,
    etaStage,
    etaDestination,
    route: {
      homeLocation: parent?.pickupLocation?.latitude != null && parent?.pickupLocation?.longitude != null
        ? { latitude: Number(parent.pickupLocation.latitude), longitude: Number(parent.pickupLocation.longitude) }
        : null,
      schoolLocation: parent?.schoolLocation?.latitude != null && parent?.schoolLocation?.longitude != null
        ? { latitude: Number(parent.schoolLocation.latitude), longitude: Number(parent.schoolLocation.longitude) }
        : null,
      schoolName: parent?.schoolName || parent?.school?.name || '',
      schoolAddress: parent?.schoolAddress || parent?.school?.address || '',
      homeAddress: parent?.pickupAddress || ''
    },
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



  const journey = await getOrCreateStudentJourney(
    parent,
    now,
    ride.cycleNumber || 1
  );

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


const journey = await getOrCreateStudentJourney(
  parent,
  now,
  ride.cycleNumber || 1
);

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


async function resetStudentStatusesForRide(driverId, rideType) {
  const filter = {
    driverId,
    attendance: true
  };

  if (rideType === 'morning') {
    // New morning journey: reset both directions for this cycle.
    await Parent.updateMany(filter, {
      $set: {
        morningStatus: 'waiting',
        morningPickedUpAt: null,
        morningDroppedAtSchoolAt: null,

        eveningStatus: 'waiting_school_finish',
        eveningPickedFromSchoolAt: null,
        eveningDroppedAtHomeAt: null
      }
    });

    return;
  }

  if (rideType === 'evening') {
    // Preserve morning completion; reset only the return journey.
    await Parent.updateMany(filter, {
      $set: {
        eveningStatus: 'waiting_school_finish',
        eveningPickedFromSchoolAt: null,
        eveningDroppedAtHomeAt: null
      }
    });
  }
}
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


const journeys = await StudentJourney.find({
  parentId,
  date
}).sort({
  cycleNumber: -1
});

const journey = journeys[0] || null;



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

  const latestRide = await getLatestTodayRide(driverId);

  if (
    !latestRide ||
    latestRide.rideType !== 'evening' ||
    latestRide.status !== 'ended'
  ) {
    throw new Error(
      'Complete the morning and evening rides before starting another cycle'
    );
  }

  await assertAllReturnStudentsDropped(driverId);

  const parents = await Parent.find(
    { driverId },
    { parentId: 1, _id: 0 }
  ).lean();

  // Keep all Ride and StudentJourney history.
  // Reset only the current operational status.
  await Parent.updateMany(
    { driverId, attendance: true },
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
    date: getBusinessDate(),
    reset: true,
    nextRide: 'morning',
    nextCycleNumber: (latestRide.cycleNumber || 1) + 1,
    parentIds: parents
      .map(parent => parent.parentId)
      .filter(Boolean)
  };
};