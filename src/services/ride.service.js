
const Ride = require('../models/ride.model');
const Parent = require('../models/parent.model');
const StudentJourney = require('../models/studentjourney.model');

/**
 * =========================================================
 * DATE / JOURNEY HELPERS
 * =========================================================
 */

const getTodayRange = () => {
  const start = new Date();

  start.setHours(
    0,
    0,
    0,
    0
  );

  const end = new Date(start);

  end.setDate(
    end.getDate() + 1
  );

  return {
    start,
    end
  };
};

const getJourneyDate = (
  date = new Date()
) => {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, '0');

  const day =
    String(
      date.getDate()
    ).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getOrCreateStudentJourney =
  async (
    parent,
    date
  ) => {
    return StudentJourney.findOneAndUpdate(
      {
        parentId:
          parent.parentId,

        date:
          getJourneyDate(date)
      },

      {
        $setOnInsert: {
          parentId:
            parent.parentId,

          driverId:
            parent.driverId,

          studentName:
            parent.studentName,

          date:
            getJourneyDate(date)
        }
      },

      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true
      }
    );
  };

const ensureActiveRide =
  async (
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
      }).sort({
        createdAt: -1
      });

    if (!ride) {
      throw new Error(
        'Ride must be started before this action'
      );
    }

    return ride;
  };

/**
 * =========================================================
 * START RIDE
 * =========================================================
 *
 * This is the ONLY service operation that creates an
 * active Ride document.
 *
 * A driver cannot have two active rides today.
 * =========================================================
 */

exports.startRide = async (
  driverId,
  rideType
) => {
  if (!driverId) {
    throw new Error(
      'driverId is required'
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

  const {
    start,
    end
  } = getTodayRange();

  /*
   * Prevent morning + evening rides from being active
   * simultaneously.
   */
  const anyActiveRide =
    await Ride.findOne({
      driverId,
      status: 'started',
      createdAt: {
        $gte: start,
        $lt: end
      }
    }).sort({
      createdAt: -1
    });

  if (anyActiveRide) {
    if (
      anyActiveRide.rideType ===
      rideType
    ) {
      return {
        ride: anyActiveRide,
        alreadyStarted: true
      };
    }

    throw new Error(
      `Cannot start ${rideType} ride while ${anyActiveRide.rideType} ride ${anyActiveRide.rideId} is still active`
    );
  }

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

      status: 'started',

      startTime:
        new Date(),

      locations: []
    });

  /*
   * Reset the workflow ONLY after the new ride has
   * been successfully created.
   */
  if (
    rideType === 'morning'
  ) {
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
  } else {
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
 * =========================================================
 * END RIDE
 * =========================================================
 */

exports.endRide = async (
  driverId,
  rideType
) => {
  const ride =
    await ensureActiveRide(
      driverId,
      rideType
    );

  ride.status =
    'ended';

  ride.endTime =
    new Date();

  await ride.save();

  return ride;
};

/**
 * =========================================================
 * GET RIDE STATUS
 * =========================================================
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

  const query = {
    driverId,
    status: 'started',
    createdAt: {
      $gte: start,
      $lt: end
    }
  };

  if (rideType) {
    query.rideType =
      rideType;
  }

  const ride =
    await Ride.findOne(query)
      .sort({
        createdAt: -1
      });

  let studentStatus = null;
  let trackingAvailable = false;
  let journeyTimes = {
    morningPickedUpAt: null,
    morningDroppedAtSchoolAt: null,
    eveningPickedFromSchoolAt: null,
    eveningDroppedAtHomeAt: null
  };

  if (parentId) {
    const parent =
      await Parent.findOne({
        parentId,
        driverId
      });

    if (parent) {
      studentStatus =
        ride?.rideType === 'morning'
          ? parent.morningStatus
          : ride?.rideType === 'evening'
            ? parent.eveningStatus
            : null;

      journeyTimes = {
        morningPickedUpAt:
          parent.morningPickedUpAt ||
          null,

        morningDroppedAtSchoolAt:
          parent.morningDroppedAtSchoolAt ||
          null,

        eveningPickedFromSchoolAt:
          parent.eveningPickedFromSchoolAt ||
          null,

        eveningDroppedAtHomeAt:
          parent.eveningDroppedAtHomeAt ||
          null
      };

      if (
        ride &&
        parent.attendance === true
      ) {
        if (
          ride.rideType === 'morning' &&
          parent.morningStatus ===
            'picked_up'
        ) {
          trackingAvailable = true;
        }

        if (
          ride.rideType === 'evening' &&
          parent.eveningStatus ===
            'picked_from_school'
        ) {
          trackingAvailable = true;
        }
      }
    }
  }

  return {
    rideStarted:
      Boolean(ride),

    status:
      ride?.status ||
      'ended',

    rideId:
      ride?.rideId ||
      null,

    rideType:
      ride?.rideType ||
      null,

    startTime:
      ride?.startTime ||
      null,

    endTime:
      ride?.endTime ||
      null,

    currentLatitude:
      ride?.currentLatitude ??
      null,

    currentLongitude:
      ride?.currentLongitude ??
      null,

    studentStatus,

    trackingAvailable,

    journeyTimes
  };
};

/**
 * =========================================================
 * UPDATE LOCATION
 * =========================================================
 */

exports.updateLocation = async (
  driverId,
  rideType,
  latitude,
  longitude
) => {
  const ride =
    await ensureActiveRide(
      driverId,
      rideType
    );

  const lat =
    Number(latitude);

  const lng =
    Number(longitude);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    throw new Error(
      'Valid latitude and longitude are required'
    );
  }

  if (
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    throw new Error(
      'Invalid GPS coordinates'
    );
  }

  ride.currentLatitude =
    lat;

  ride.currentLongitude =
    lng;

  if (
    !Array.isArray(
      ride.locations
    )
  ) {
    ride.locations = [];
  }

  ride.locations.push({
    latitude: lat,
    longitude: lng,
    timestamp: new Date()
  });

  /*
   * Prevent the locations array from growing without bound.
   * Keep the latest 5,000 points for the current ride.
   */
  if (
    ride.locations.length > 5000
  ) {
    ride.locations =
      ride.locations.slice(-5000);
  }

  await ride.save();

  return ride;
};

/**
 * =========================================================
 * STUDENT JOURNEY REPORT
 * =========================================================
 */

exports.getStudentJourneyReport =
  async (
    parentId,
    date
  ) => {
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

    if (
      !/^\d{4}-\d{2}-\d{2}$/
        .test(date)
    ) {
      throw new Error(
        'Invalid date format. Expected YYYY-MM-DD'
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

    const journey =
      await StudentJourney.findOne({
        parentId,
        date
      });

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

/**
 * =========================================================
 * BACKWARD-COMPATIBLE STUDENT ACTIONS
 * =========================================================
 */

exports.pickStudentMorning =
  async (
    driverId,
    parentId
  ) => {
    const ride =
      await ensureActiveRide(
        driverId,
        'morning'
      );

    const now =
      new Date();

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
            morningStatus:
              'picked_up',

            morningPickedUpAt:
              now
          }
        },
        {
          new: true,
          runValidators: true
        }
      );

    if (!parent) {
      throw new Error(
        'Student is not waiting for morning pickup'
      );
    }

    const journey =
      await getOrCreateStudentJourney(
        parent,
        now
      );

    journey.morning.pickedUpAt =
      now;

    await journey.save();

    return {
      parent,
      timestamp: now,
      rideId: ride.rideId
    };
  };

exports.dropStudentSchool =
  async (
    driverId,
    parentId
  ) => {
    const ride =
      await ensureActiveRide(
        driverId,
        'morning'
      );

    const now =
      new Date();

    const parent =
      await Parent.findOneAndUpdate(
        {
          parentId,
          driverId,
          attendance: true,
          morningStatus:
            'picked_up'
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
          new: true,
          runValidators: true
        }
      );

    if (!parent) {
      throw new Error(
        'Student must be picked up before school drop'
      );
    }

    const journey =
      await getOrCreateStudentJourney(
        parent,
        now
      );

    journey.morning.droppedAtSchoolAt =
      now;

    await journey.save();

    return {
      parent,
      timestamp: now,
      rideId: ride.rideId
    };
  };

exports.pickStudentFromSchool =
  async (
    driverId,
    parentId
  ) => {
    const ride =
      await ensureActiveRide(
        driverId,
        'evening'
      );

    const now =
      new Date();

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

    if (!parent) {
      throw new Error(
        'Student is not waiting for school pickup'
      );
    }

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

    return {
      parent,
      timestamp: now,
      rideId: ride.rideId
    };
  };

exports.dropStudentHome =
  async (
    driverId,
    parentId
  ) => {
    const ride =
      await ensureActiveRide(
        driverId,
        'evening'
      );

    const now =
      new Date();

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

    if (!parent) {
      throw new Error(
        'Student is not currently on the return van'
      );
    }

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
      timestamp: now,
      rideId: ride.rideId
    };
  };
