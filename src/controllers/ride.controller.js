const Ride = require('../models/ride.model');
const Parent = require('../models/parent.model');
const Driver = require('../models/driver.model');

const rideService = require('../services/ride.service');


/**
 * =====================================================
 * CONSTANTS
 * =====================================================
 */

const SCHOOL_LOCATION = {

  name: 'Lisieux Matriculation School',

  latitude: 11.0168,

  longitude: 76.9558

};

/**
 * =====================================================
 * SOCKET ROOM
 * =====================================================
 */

const getDriverRoom = (driverId) => {

  return `driver_${driverId}`;

};

// =====================================================
// GET DAILY STUDENT JOURNEY REPORT
// GET /api/rides/journey-report/:parentId?date=YYYY-MM-DD
// =====================================================

exports.getStudentJourneyReport =
  async (req, res) => {

    try {

      const {
        parentId
      } = req.params;

      const {
        date
      } = req.query;

      // -------------------------------------------------
      // VALIDATION
      // -------------------------------------------------

      if (!parentId) {

        return res.status(400).json({

          success: false,

          message:
            'parentId is required'

        });

      }

      if (!date) {

        return res.status(400).json({

          success: false,

          message:
            'date is required'

        });

      }

      // -------------------------------------------------
      // GET REPORT
      // -------------------------------------------------

      const data =
        await rideService
          .getStudentJourneyReport(
            parentId,
            date
          );

      // -------------------------------------------------
      // RESPONSE
      // -------------------------------------------------

      return res.status(200).json({

        success: true,

        data

      });

    }

    catch (error) {

      console.error(
        'GET JOURNEY REPORT ERROR:',
        error
      );

      return res.status(500).json({

        success: false,

        message:
          error.message ||
          'Unable to get journey report'

      });

    }

  };

/**
 * =====================================================
 * EMIT TO DRIVER CHANNEL
 *
 * Driver
 * +
 * All Parents of Driver
 * =====================================================
 */

const emitDriverChannel = (

  io,

  driverId,

  event,

  payload = {}

) => {

  if (!driverId) {
    return;
  }

  io.to(

    getDriverRoom(driverId)

  ).emit(

    event,

    payload

  );

};

/**
 * =====================================================
 * EMIT TO SINGLE PARENT
 * =====================================================
 */

const emitParent = (

  io,

  parentId,

  event,

  payload = {}

) => {

  if (!parentId) {
    return;
  }

  io.to(

    parentId

  ).emit(

    event,

    payload

  );

};

/**
 * =====================================================
 * NOTIFY ALL PARENTS OF DRIVER
 * =====================================================
 */

const notifyDriverParents = async (

  io,

  driverId,

  payload = {}

) => {

  const parents = await Parent.find(

    {

      driverId

    },

    {

      parentId: 1,

      _id: 0

    }

  );

  parents.forEach((parent) => {

    emitParent(

      io,

      parent.parentId,

      'dashboardUpdated',

      payload

    );

  });

};

/**
 * =====================================================
 * BROADCAST DASHBOARD UPDATE
 *
 * Driver
 * +
 * Parents
 * =====================================================
 */

const broadcastDashboardUpdate = (

  io,

  driverId,

  type

) => {

  emitDriverChannel(

    io,

    driverId,

    'dashboardUpdated',

    {

      type,

      driverId,

      timestamp: Date.now()

    }

  );

};

/**
 * =====================================================
 * BROADCAST RIDE EVENT
 * =====================================================
 */

const broadcastRideEvent = (

  io,

  driverId,

  rideType,

  event

) => {

  emitDriverChannel(

    io,

    driverId,

    event,

    {

      driverId,

      rideType,

      timestamp: Date.now()

    }

  );

};

/**
 * =====================================================
 * BROADCAST LOCATION
 * =====================================================
 */

const broadcastLocation = (

  io,

  driverId,

  rideType,

  latitude,

  longitude

) => {

  emitDriverChannel(

    io,

    driverId,

    'locationUpdated',

    {

      driverId,

      rideType,

      latitude,

      longitude,

      timestamp: Date.now()

    }

  );

};

/**
 * =====================================================
 * START RIDE
 * =====================================================
 */

exports.startRide = async (req, res) => {

  try {

    const {
      driverId,
      rideType
    } = req.body;

    // =====================================================
    // VALIDATION
    // =====================================================

    if (!driverId || !rideType) {

      return res.status(400).json({

        success: false,

        message:
          'driverId and rideType are required'

      });

    }

    if (
      rideType !== 'morning' &&
      rideType !== 'evening'
    ) {

      return res.status(400).json({

        success: false,

        message: 'Invalid rideType'

      });

    }

    // =====================================================
    // START / RESUME RIDE
    // =====================================================

    const result =
      await rideService.startRide(
        driverId,
        rideType
      );

    const ride =
      result.ride;

    const alreadyStarted =
      result.alreadyStarted;

    const io =
      req.app.get('io');

    // =====================================================
    // IMPORTANT
    //
    // If ride already existed, DON'T broadcast
    // rideStarted again.
    //
    // Otherwise parents/admin may receive duplicate
    // notifications whenever the driver reopens the app.
    // =====================================================

    if (!alreadyStarted) {

      /**
       * Driver + parents
       */
      broadcastRideEvent(
        io,
        driverId,
        rideType,
        'rideStarted'
      );

      /**
       * Dashboard refresh
       */
      broadcastDashboardUpdate(
        io,
        driverId,
        'ride_started'
      );

      /**
       * Parent dashboard
       */
      await notifyDriverParents(
        io,
        driverId,
        {
          type: 'ride_started',

          driverId,

          rideType,

          rideStarted: true,

          timestamp: Date.now()
        }
      );

    }

    // =====================================================
    // RESPONSE
    // =====================================================

    return res.status(
      alreadyStarted ? 200 : 201
    ).json({

      success: true,

      alreadyStarted,

      message:
        alreadyStarted
          ? `${rideType} ride already active. Resuming existing ride.`
          : `${rideType} ride started successfully`,

      data: ride

    });

  }

  catch (error) {

    console.error(
      'Start Ride Error',
      error
    );

    return res.status(500).json({

      success: false,

      message: error.message

    });

  }

};
/**
 * =====================================================
 * UPDATE LOCATION
 * =====================================================
 */

exports.updateLocation = async (req, res) => {

  try {

    const {

      driverId,

      rideType,

      latitude,

      longitude

    } = req.body;

    /**
     * Validation
     */

    if (

      !driverId ||

      !rideType ||

      latitude === undefined ||

      longitude === undefined

    ) {

      return res.status(400).json({

        success: false,

        message:
          'driverId, rideType, latitude and longitude are required'

      });

    }

    /**
     * Update Database
     */

    await rideService.updateLocation(

      driverId,

      rideType,

      latitude,

      longitude

    );

    const io = req.app.get('io');

    /**
     * =====================================================
     * Driver Channel
     *
     * Driver +
     * Assigned Parents
     * =====================================================
     */

    broadcastLocation(

      io,

      driverId,

      rideType,

      latitude,

      longitude

    );

    /**
     * Dashboard Sync
     */

    broadcastDashboardUpdate(

      io,

      driverId,

      'location_updated'

    );

    return res.status(200).json({

      success: true,

      message: 'Location updated successfully',

      data: {

        driverId,

        rideType,

        latitude,

        longitude

      }

    });

  }

  catch (error) {

    console.error(

      'Location Update Error',

      error

    );

    return res.status(500).json({

      success: false,

      message: error.message

    });

  }

};
/**
 * =====================================================
 * END RIDE
 * =====================================================
 */

exports.endRide = async (req, res) => {

  try {

    const {

      driverId,

      rideType

    } = req.body;

    /**
     * Validation
     */

    if (!driverId || !rideType) {

      return res.status(400).json({

        success: false,

        message: 'driverId and rideType are required'

      });

    }

    if (

      rideType !== 'morning' &&

      rideType !== 'evening'

    ) {

      return res.status(400).json({

        success: false,

        message: 'Invalid rideType'

      });

    }

    /**
     * End Ride
     */

    const ride = await rideService.endRide(

      driverId,

      rideType

    );

    const io = req.app.get('io');

    /**
     * =====================================================
     * Notify Driver + Parents
     * =====================================================
     */

    broadcastRideEvent(

      io,

      driverId,

      rideType,

      'rideEnded'

    );

    /**
     * Dashboard Refresh
     */

    broadcastDashboardUpdate(

      io,

      driverId,

      'ride_ended'

    );

    /**
     * Backward Compatibility
     */

    await notifyDriverParents(

      io,

      driverId,

      {

        type: 'ride_ended',

        driverId,

        rideType,

        rideStarted: false,

        timestamp: Date.now()

      }

    );

    return res.status(200).json({

      success: true,

      message: `${rideType} ride ended successfully`,

      data: ride

    });

  }

  catch (error) {

    console.error(

      'End Ride Error',

      error

    );

    return res.status(500).json({

      success: false,

      message: error.message

    });

  }

};
/**
 * =====================================================
 * LIVE LOCATION
 * =====================================================
 */

// ride.controller.js
// IMPORTANT FIX INSIDE getLiveLocation()

exports.getLiveLocation = async (req, res) => {

  try {

    const {
      driverId,
      rideType
    } = req.params;

    const {
      parentId
    } = req.query;


    if (
      !driverId ||
      !rideType ||
      !parentId
    ) {

      return res.status(400).json({

        success: false,

        message:
          'driverId, rideType and parentId are required'

      });

    }


    if (
      rideType !== 'morning' &&
      rideType !== 'evening'
    ) {

      return res.status(400).json({

        success: false,

        message: 'Invalid rideType'

      });

    }


    const parent =
      await Parent.findOne({

        parentId,

        driverId

      });


    if (!parent) {

      return res.status(403).json({

        success: false,

        message:
          'Parent is not assigned to this driver'

      });

    }


    /*
     * Find the currently running ride FIRST.
     *
     * Return ride tracking must not fail merely because
     * the student's individual boarding status has not
     * arrived yet.
     */
    const ride =
      await Ride.findOne({

        driverId,

        rideType,

        status: 'started'

      })
        .sort({
          createdAt: -1
        });


    if (!ride) {

      return res.status(404).json({

        success: false,

        trackingAvailable: false,

        message:
          'No active ride found'

      });

    }

// =====================================================
// TRACKING ACCESS RULE
// =====================================================

const studentStatus =
  rideType === 'morning'
    ? parent.morningStatus
    : parent.eveningStatus;


// -----------------------------------------------------
// MORNING
// -----------------------------------------------------
//
// Ride started + student present
// = tracking available immediately.
//
// -----------------------------------------------------

if (rideType === 'morning') {

  if (parent.attendance !== true) {

    return res.status(403).json({

      success: false,

      trackingAvailable: false,

      message:
        'Live tracking is unavailable because the student is absent'

    });

  }


  if (
    studentStatus === 'dropped_at_school' ||
    studentStatus === 'dropped'
  ) {

    return res.status(403).json({

      success: false,

      trackingAvailable: false,

      message:
        'Morning tracking ended because the student has reached school'

    });

  }

}


// -----------------------------------------------------
// EVENING
// -----------------------------------------------------
//
// Student must actually be picked from school.
// -----------------------------------------------------

if (rideType === 'evening') {

  if (parent.attendance !== true) {

    return res.status(403).json({

      success: false,

      trackingAvailable: false,

      message:
        'Live tracking is unavailable because the student is absent'

    });

  }


  if (
    studentStatus !== 'picked_from_school'
  ) {

    return res.status(403).json({

      success: false,

      trackingAvailable: false,

      message:
        'Live tracking is available after school pickup'

    });

  }

}


    return res.status(200).json({

      success: true,

      trackingAvailable: true,
data: {

  rideId:
    ride.rideId,

  driverId:
    ride.driverId,

  rideType:
    ride.rideType,

  latitude:
    ride.currentLatitude,

  longitude:
    ride.currentLongitude,

  startTime:
    ride.startTime,

  status:
    ride.status,

  updatedAt:
    ride.updatedAt,

  journeyTimes: {

    morningPickedUpAt:
      parent.morningPickedUpAt || null,

    morningDroppedAtSchoolAt:
      parent.morningDroppedAtSchoolAt || null,

    eveningPickedFromSchoolAt:
      parent.eveningPickedFromSchoolAt || null,

    eveningDroppedAtHomeAt:
      parent.eveningDroppedAtHomeAt || null

  }

}
    });

  }

  catch (error) {

    console.error(
      'Get Live Location Error:',
      error
    );

    return res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

};
/**
 * =====================================================
 * RIDE STATUS
 * =====================================================
 */

exports.getRideStatus = async (req, res) => {

  try {

    const {
      driverId,
      rideType
    } = req.params;

    const {
      parentId
    } = req.query;

    const data =
      await rideService.getRideStatus(
        driverId,
        rideType,
        parentId
      );

    return res.status(200).json({

      success: true,

      data: {

        driverId,

        rideType,

        rideStarted:
          data.rideStarted,

        status:
          data.status,

        rideId:
          data.rideId,

        studentStatus:
          data.studentStatus,

        trackingAvailable:
          data.trackingAvailable,
        journeyTimes:
          data.journeyTimes,

        timestamp:
          Date.now()

      }

    });

  }

  catch (error) {

    console.error(

      'Ride Status Error',

      error

    );

    return res.status(500).json({

      success: false,

      message: error.message

    });

  }

};
// =====================================================
// MORNING PICKUP
// =====================================================

exports.pickStudentMorning = async (req, res) => {

  try {

    const {
      driverId,
      parentId
    } = req.body;


    if (!driverId || !parentId) {

      return res.status(400).json({

        success: false,

        message:
          'driverId and parentId are required'

      });

    }


    const result =
      await rideService.pickStudentMorning(
        driverId,
        parentId
      );


    const parent =
      result.parent;

    const timestamp =
      result.timestamp;


    const io =
      req.app.get('io');


    const payload = {

      parentId:
        parent.parentId,

      driverId:
        parent.driverId,

      rideType:
        'morning',

      status:
        'picked_up',

      timestamp,

      pickupTime:
        timestamp

    };


    // Parent

    emitParent(

      io,

      parent.parentId,

      'studentStatusUpdated',

      payload

    );


    // Driver

    emitDriverChannel(

      io,

      parent.driverId,

      'studentStatusUpdated',

      payload

    );


    // Dashboard

    broadcastDashboardUpdate(

      io,

      parent.driverId,

      'student_picked'

    );


    return res.status(200).json({

      success: true,

      message:
        'Student picked successfully',

      data: {

        parent,

        timestamp

      }

    });

  }

  catch (error) {

    console.error(
      'Morning Pickup Error:',
      error
    );

    return res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

};
/**
 * =====================================================
 * MORNING DROP
 * =====================================================
 */
exports.dropStudentSchool = async (req, res) => {
  try {

    const {
      driverId,
      parentId
    } = req.body;

    console.log('========================================');
    console.log('DROP STUDENT AT SCHOOL');
    console.log('driverId:', driverId);
    console.log('parentId:', parentId);
    console.log('========================================');


    // =====================================================
    // VALIDATION
    // =====================================================

    if (!driverId || !parentId) {

      return res.status(400).json({
        success: false,
        message: 'driverId and parentId are required'
      });

    }


    // =====================================================
    // UPDATE DATABASE
    // =====================================================

    const result =
      await rideService.dropStudentSchool(
        driverId,
        parentId
      );


    const parent =
      result.parent;

    const timestamp =
      result.timestamp;


    // =====================================================
    // SOCKET
    // =====================================================

    const io =
      req.app.get('io');


    const payload = {

      parentId:
        parent.parentId,

      driverId:
        parent.driverId,

      studentName:
        parent.studentName,

      rideType:
        'morning',

      status:
        'dropped_at_school',

      finalStatus:
        'dropped_at_school',

      timestamp,

      dropTime:
        timestamp,

      journeyTimes: {

        morningPickedUpAt:
          parent.morningPickedUpAt || null,

        morningDroppedAtSchoolAt:
          parent.morningDroppedAtSchoolAt || null,

        eveningPickedFromSchoolAt:
          parent.eveningPickedFromSchoolAt || null,

        eveningDroppedAtHomeAt:
          parent.eveningDroppedAtHomeAt || null

      }

    };


    if (io) {

      // ===================================================
      // PARENT
      // ===================================================

      io.to(
        parent.parentId
      ).emit(
        'studentStatusUpdated',
        payload
      );


      // ===================================================
      // DRIVER
      // ===================================================

      emitDriverChannel(
        io,
        parent.driverId,
        'studentStatusUpdated',
        payload
      );


      // ===================================================
      // DASHBOARD UPDATE
      // ===================================================

      emitDriverChannel(
        io,
        parent.driverId,
        'dashboardUpdated',
        {
          type:
            'student_status_updated',

          parentId:
            parent.parentId,

          rideType:
            'morning',

          status:
            'dropped_at_school',

          timestamp

        }
      );

    }


    // =====================================================
    // RESPONSE
    // =====================================================

    return res.status(200).json({

      success: true,

      message:
        'Student dropped at school successfully',

      data: {

        parent,

        timestamp

      }

    });


  } catch (error) {

    console.error(
      '❌ DROP STUDENT AT SCHOOL ERROR:',
      error
    );


    return res.status(500).json({

      success: false,

      message:
        error.message ||
        'Unable to drop student at school'

    });

  }
};

/**
 * =====================================================
 * EVENING PICKUP
 * =====================================================
 */

// =====================================================
// EVENING PICKUP FROM SCHOOL
// =====================================================

exports.pickStudentFromSchool =
  async (req, res) => {

    try {

      const {
        driverId,
        parentId
      } = req.body;


      if (!driverId || !parentId) {

        return res.status(400).json({

          success: false,

          message:
            'driverId and parentId are required'

        });

      }


      const result =
        await rideService.pickStudentFromSchool(
          driverId,
          parentId
        );


      const parent =
        result.parent;

      const timestamp =
        result.timestamp;


      const io =
        req.app.get('io');


      const payload = {

        parentId:
          parent.parentId,

        driverId:
          parent.driverId,

        rideType:
          'evening',

        status:
          'picked_from_school',

        timestamp,

        pickupTime:
          timestamp

      };


      emitParent(
        io,
        parent.parentId,
        'studentStatusUpdated',
        payload
      );


      emitDriverChannel(
        io,
        parent.driverId,
        'studentStatusUpdated',
        payload
      );


      broadcastDashboardUpdate(
        io,
        parent.driverId,
        'student_picked'
      );


      return res.status(200).json({

        success: true,

        message:
          'Student picked from school',

        data: {

          parent,

          timestamp

        }

      });

    }

    catch (error) {

      console.error(
        'Evening Pickup Error:',
        error
      );

      return res.status(500).json({

        success: false,

        message:
          error.message

      });

    }

  };
// =====================================================
// EVENING DROP AT HOME
// =====================================================

exports.dropStudentHome = async (req, res) => {

  try {

    const {
      driverId,
      parentId
    } = req.body;


    if (!driverId || !parentId) {

      return res.status(400).json({

        success: false,

        message:
          'driverId and parentId are required'

      });

    }


    const result =
      await rideService.dropStudentHome(
        driverId,
        parentId
      );


    const parent =
      result.parent;

    const timestamp =
      result.timestamp;


    const io =
      req.app.get('io');


    const payload = {

      parentId:
        parent.parentId,

      driverId:
        parent.driverId,

      rideType:
        'evening',

      status:
        'dropped_at_home',

      timestamp,

      dropTime:
        timestamp

    };


    emitParent(
      io,
      parent.parentId,
      'studentStatusUpdated',
      payload
    );


    emitDriverChannel(
      io,
      parent.driverId,
      'studentStatusUpdated',
      payload
    );


    broadcastDashboardUpdate(
      io,
      parent.driverId,
      'student_dropped'
    );


    return res.status(200).json({

      success: true,

      message:
        'Student dropped at home',

      data: {

        parent,

        timestamp

      }

    });

  }

  catch (error) {

    console.error(
      'Evening Home Drop Error:',
      error
    );

    return res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

};