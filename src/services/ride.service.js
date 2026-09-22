const Ride = require('../models/ride.model');
const Parent = require('../models/parent.model');
const StudentJourney =
  require('../models/studentjourney.model');

/**
 * =====================================================
 * TODAY RANGE
 * =====================================================
 */

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


const getOrCreateStudentJourney = async (
  parent,
  date
) => {

  const journeyDate =
    getJourneyDate(date);

  return StudentJourney.findOneAndUpdate(
    {
      parentId: parent.parentId,
      date: journeyDate
    },
    {
      $setOnInsert: {
        parentId: parent.parentId,
        driverId: parent.driverId,
        studentName: parent.studentName,
        date: journeyDate
      }
    },
    {
      new: true,
      upsert: true
    }
  );

};


// =====================================================
// GENERIC STUDENT STATUS UPDATE
// =====================================================

const updateStudentStatus = async (
  parentId,
  rideType,
  status
) => {

  // ---------------------------------------------------
  // VALIDATION
  // ---------------------------------------------------

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

  // ---------------------------------------------------
  // FIND PARENT
  // ---------------------------------------------------

  const parent =
    await Parent.findOne({
      parentId
    });

  if (!parent) {
    throw new Error(
      'Parent not found'
    );
  }

  // ---------------------------------------------------
  // ATTENDANCE
  // ---------------------------------------------------

  if (
    parent.attendance !== true
  ) {

    throw new Error(
      'Absent students cannot be picked up'
    );

  }

  // ---------------------------------------------------
  // EVENT TIME
  // ---------------------------------------------------

  const eventTime =
    new Date();

  const update = {};

  // ===================================================
  // MORNING
  // ===================================================

  if (
    rideType === 'morning'
  ) {

    // -------------------------------------------------
    // MORNING PICKUP
    // -------------------------------------------------

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

    // -------------------------------------------------
    // MORNING SCHOOL DROP
    // -------------------------------------------------

    else if (
      status ===
      'dropped_at_school'
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

  // ===================================================
  // EVENING
  // ===================================================

  else {

    // -------------------------------------------------
    // EVENING SCHOOL PICKUP
    // -------------------------------------------------

    if (
      status === 'picked_up'
    ) {

      if (
        parent.eveningStatus ===
        'picked_from_school'
      ) {

        throw new Error(
          'Student is already picked up from school'
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

      update.eveningStatus =
        'picked_from_school';

      update.eveningPickedFromSchoolAt =
        eventTime;

    }

    // -------------------------------------------------
    // EVENING HOME DROP
    // -------------------------------------------------

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

  // ===================================================
  // UPDATE PARENT
  // ===================================================

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

  // ===================================================
  // UPDATE DAILY JOURNEY
  // ===================================================

  const journey =
    await getOrCreateStudentJourney(
      updatedParent,
      eventTime
    );

  // ---------------------------------------------------
  // MORNING HISTORY
  // ---------------------------------------------------

  if (
    rideType === 'morning'
  ) {

    if (
      status === 'picked_up'
    ) {

      journey.morning.pickedUpAt =
        eventTime;

    }

    else if (
      status ===
      'dropped_at_school'
    ) {

      journey.morning.droppedAtSchoolAt =
        eventTime;

    }

  }

  // ---------------------------------------------------
  // EVENING HISTORY
  // ---------------------------------------------------

  else {

    if (
      status === 'picked_up'
    ) {

      journey.evening.pickedFromSchoolAt =
        eventTime;

    }

    else if (
      status === 'dropped_at_home'
    ) {

      journey.evening.droppedAtHomeAt =
        eventTime;

    }

  }

  // ---------------------------------------------------
  // SAVE HISTORY
  // ---------------------------------------------------

  await journey.save();

  // ===================================================
  // RESPONSE
  // ===================================================

  return {

    parent:
      updatedParent,

    eventTime

  };

};

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

/**
 * =====================================================
 * START RIDE
 * =====================================================
 *
 * Morning:
 *   waiting
 *      ↓
 *   picked_up
 *      ↓
 *   dropped_at_school
 *
 * Evening:
 *   waiting_at_school
 *      ↓
 *   picked_from_school
 *      ↓
 *   dropped_at_home
 *
 * The Parent status belongs to the current ride/day.
 * When a new ride starts, stale status from an older
 * ride must never block the new ride.
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
  // CHECK ACTIVE RIDE
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
  // EXISTING ACTIVE RIDE
  // =====================================================

  if (activeRide) {

    console.log(
      `Resuming active ${rideType} ride: ${activeRide.rideId}`
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

  const now =
    new Date();

  const ride =
    await Ride.create({

      rideId:
        `RIDE${String(
          rideCount + 1
        ).padStart(6, '0')}`,

      driverId,

      rideType,

      status: 'started',

      startTime: now,

      locations: []

    });

  console.log(
    `New ${rideType} ride started: ${ride.rideId}`
  );

  // =====================================================
  // RESET STUDENT STATE FOR NEW RIDE
  // =====================================================

  if (rideType === 'morning') {

    await Parent.updateMany(
      {
        driverId,
        attendance: true
      },
      {
        $set: {

          morningStatus:
            'waiting',

          morningPickedUpAt:
            null,

          morningDroppedAtSchoolAt:
            null

        }
      }
    );

  }

  else if (rideType === 'evening') {

    await Parent.updateMany(
      {
        driverId,
        attendance: true
      },
      {
        $set: {

          eveningStatus:
            'waiting_school_finish',

          eveningPickedFromSchoolAt:
            null,

          eveningDroppedAtHomeAt:
            null

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

  let journeyTimes = {

    morningPickedUpAt:
      null,

    morningDroppedAtSchoolAt:
      null,

    eveningPickedFromSchoolAt:
      null,

    eveningDroppedAtHomeAt:
      null

  };

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

      journeyTimes = {

        morningPickedUpAt:
          parent.morningPickedUpAt || null,

        morningDroppedAtSchoolAt:
          parent.morningDroppedAtSchoolAt || null,

        eveningPickedFromSchoolAt:
          parent.eveningPickedFromSchoolAt || null,

        eveningDroppedAtHomeAt:
          parent.eveningDroppedAtHomeAt || null

      };

      trackingAvailable =
        rideType === 'morning'
          ? Boolean(ride) &&
            parent.attendance === true &&
            studentStatus === 'picked_up'

          : Boolean(ride) &&
            parent.attendance === true &&
            studentStatus === 'picked_from_school';

    }

  }

  return {

    rideStarted:
      Boolean(ride),

    rideType:
      ride?.rideType || null,

    status:
      ride?.status || 'ended',

    rideId:
      ride?.rideId || null,

    studentStatus,

    trackingAvailable,

    journeyTimes

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

// =====================================================
// MORNING PICKUP
// =====================================================

// =====================================================
// MORNING PICKUP
// Home → School
// =====================================================

exports.pickStudentMorning = async (
  driverId,
  parentId
) => {

  // ---------------------------------------------------
  // Make sure morning ride is active
  // ---------------------------------------------------

  await ensureActiveRide(
    driverId,
    'morning'
  );

  // ---------------------------------------------------
  // Current server timestamp
  // ---------------------------------------------------

  const now = new Date();

  // ---------------------------------------------------
  // Update Parent
  // ---------------------------------------------------

  const parent =
    await Parent.findOneAndUpdate(
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
        new: true
      }
    );

  // ---------------------------------------------------
  // Student not found
  // ---------------------------------------------------

  if (!parent) {

    throw new Error(
      'Present parent/student not found or student is already picked up'
    );

  }

  // ---------------------------------------------------
  // CREATE / GET DAILY JOURNEY
  // ---------------------------------------------------

  const journey =
    await getOrCreateStudentJourney(
      parent,
      now
    );

  // ---------------------------------------------------
  // SAVE MORNING PICKUP TIME
  // ---------------------------------------------------

  journey.morning.pickedUpAt =
    now;

  await journey.save();

  // ---------------------------------------------------
  // RESPONSE
  // ---------------------------------------------------

  return {

    parent,

    timestamp:
      now

  };

};



// =====================================================
// MORNING DROP AT SCHOOL
// Home → School
// =====================================================

exports.dropStudentSchool = async (
  driverId,
  parentId
) => {

  // ---------------------------------------------------
  // Make sure morning ride is active
  // ---------------------------------------------------

  await ensureActiveRide(
    driverId,
    'morning'
  );

  // ---------------------------------------------------
  // Current server timestamp
  // ---------------------------------------------------

  const now = new Date();

  // ---------------------------------------------------
  // Update Parent
  // ---------------------------------------------------

  const parent =
    await Parent.findOneAndUpdate(
      {
        parentId,
        driverId,
        morningStatus: 'picked_up'
      },
      {
        $set: {

          morningStatus:
            'dropped_at_school',

          morningDroppedAtSchoolAt:
            now

        }
      },
      {
        new: true
      }
    );

  // ---------------------------------------------------
  // Validation
  // ---------------------------------------------------

  if (!parent) {

    throw new Error(
      'Student must be picked up before school drop'
    );

  }

  // ---------------------------------------------------
  // CREATE / GET DAILY JOURNEY
  // ---------------------------------------------------

  const journey =
    await getOrCreateStudentJourney(
      parent,
      now
    );

  // ---------------------------------------------------
  // SAVE SCHOOL DROP TIME
  // ---------------------------------------------------

  journey.morning.droppedAtSchoolAt =
    now;

  await journey.save();

  // ---------------------------------------------------
  // RESPONSE
  // ---------------------------------------------------

  return {

    parent,

    timestamp:
      now

  };

};

exports.pickStudentFromSchool = async (
  driverId,
  parentId
) => {

  // =====================================================
  // 1. ACTIVE EVENING RIDE REQUIRED
  // =====================================================

  const ride =
    await ensureActiveRide(
      driverId,
      'evening'
    );

  // =====================================================
  // 2. CURRENT SERVER TIME
  // =====================================================

  const now =
    new Date();

  // =====================================================
  // 3. ATOMIC PICKUP
  // =====================================================

  const parent =
    await Parent.findOneAndUpdate(
      {
        parentId,
        driverId,

        attendance: true,

        eveningStatus:
          'waiting_school_finish'
      },

      {
        $set: {

          eveningStatus:
            'picked_from_school',

          eveningPickedFromSchoolAt:
            now,

          eveningDroppedAtHomeAt:
            null

        }
      },

      {
        new: true,
        runValidators: true
      }
    );

  // =====================================================
  // 4. VALIDATION
  // =====================================================

  if (!parent) {

    const currentParent =
      await Parent.findOne({
        parentId,
        driverId
      });

    if (!currentParent) {

      throw new Error(
        'Student is not assigned to this driver'
      );

    }

    if (
      currentParent.attendance !== true
    ) {

      throw new Error(
        'Absent student cannot be picked from school'
      );

    }

    if (
      currentParent.eveningStatus ===
      'picked_from_school'
    ) {

      throw new Error(
        'Student has already been picked from school'
      );

    }

    if (
      currentParent.eveningStatus ===
      'dropped_at_home'
    ) {

      throw new Error(
        'Student has already been dropped at home'
      );

    }

    throw new Error(
      `Student is not waiting at school. Current status: ${
        currentParent.eveningStatus || 'unknown'
      }`
    );

  }

  // =====================================================
  // 5. DAILY JOURNEY
  // =====================================================

  const journey =
    await getOrCreateStudentJourney(
      parent,
      now
    );

  journey.evening.pickedFromSchoolAt =
    now;

  journey.evening.droppedAtHomeAt =
    null;

  await journey.save();

  // =====================================================
  // 6. RESPONSE
  // =====================================================

  return {

    parent,

    timestamp:
      now,

    rideId:
      ride.rideId

  };

};


exports.dropStudentHome = async (
  driverId,
  parentId
) => {

  // =====================================================
  // ACTIVE EVENING RIDE REQUIRED
  // =====================================================

  const ride =
    await ensureActiveRide(
      driverId,
      'evening'
    );

  const now =
    new Date();

  // =====================================================
  // ONLY PICKED STUDENTS CAN BE DROPPED
  // =====================================================

  const parent =
    await Parent.findOneAndUpdate(
      {
        parentId,
        driverId,

        attendance: true,

        eveningStatus:
          'picked_from_school'
      },

      {
        $set: {

          eveningStatus:
            'dropped_at_home',

          eveningDroppedAtHomeAt:
            now

        }
      },

      {
        new: true,
        runValidators: true
      }
    );

  // =====================================================
  // VALIDATION
  // =====================================================

  if (!parent) {

    const currentParent =
      await Parent.findOne({
        parentId,
        driverId
      });

    if (!currentParent) {

      throw new Error(
        'Student is not assigned to this driver'
      );

    }

    if (
      currentParent.eveningStatus ===
      'waiting_school_finish'
    ) {

      throw new Error(
        'Student must be picked from school before dropping at home'
      );

    }

    if (
      currentParent.eveningStatus ===
      'dropped_at_home'
    ) {

      throw new Error(
        'Student has already been dropped at home'
      );

    }

    throw new Error(
      'Student is not currently on the return van'
    );

  }

  // =====================================================
  // DAILY JOURNEY
  // =====================================================

  const journey =
    await getOrCreateStudentJourney(
      parent,
      now
    );

  journey.evening.droppedAtHomeAt =
    now;

  await journey.save();

  return {

    parent,

    timestamp:
      now,

    rideId:
      ride.rideId

  };

};

exports.getStudentJourneyReport =
  async (
    parentId,
    date
  ) => {

    // -------------------------------------------------
    // VALIDATION
    // -------------------------------------------------

    if (!parentId) {

      throw new Error(
        'parentId is required'
      );

    }

    if (!date) {

      throw new Error(
        'date is required'
      );

    }

    // -------------------------------------------------
    // Validate date format
    // Expected:
    // YYYY-MM-DD
    // -------------------------------------------------

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {

      throw new Error(
        'Invalid date format. Expected YYYY-MM-DD'
      );

    }

    // -------------------------------------------------
    // Find parent
    // -------------------------------------------------

    const parent =
      await Parent.findOne({
        parentId
      });

    if (!parent) {

      throw new Error(
        'Parent not found'
      );

    }

    // -------------------------------------------------
    // Find that exact day's journey
    // -------------------------------------------------

    const journey =
      await StudentJourney.findOne({

        parentId,

        date

      });

    // -------------------------------------------------
    // Return report
    // -------------------------------------------------

    return {

      date,

      studentName:
        parent.studentName,

      schoolName:
        parent.schoolName,

      morning: {

        direction:
          'Home → School',

        pickedUpAt:
          journey?.morning?.pickedUpAt ||
          null,

        droppedAtSchoolAt:
          journey?.morning?.droppedAtSchoolAt ||
          null

      },

      evening: {

        direction:
          'School → Home',

        pickedFromSchoolAt:
          journey?.evening?.pickedFromSchoolAt ||
          null,

        droppedAtHomeAt:
          journey?.evening?.droppedAtHomeAt ||
          null

      }

    };

  };