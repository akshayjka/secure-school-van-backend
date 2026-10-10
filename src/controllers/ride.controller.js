const Parent = require('../models/parent.model');

const rideService = require('../services/ride.service');



/**

 * Socket rooms used by the application:

 *   driver_\<driverId>  -> driver dashboard

 *   \<parentId>         -> parent dashboard

 */

const getDriverRoom = driverId => `driver_${driverId}`;



const emitDriver = (io, driverId, event, payload = {}) => {

  if (!io || !driverId) return;

  io.to(getDriverRoom(driverId)).emit(event, payload);

};



const emitParent = (io, parentId, event, payload = {}) => {

  if (!io || !parentId) return;

  io.to(parentId).emit(event, payload);

};



const getParentIdsForDriver = async driverId => {

  const parents = await Parent.find(

    { driverId },

    { parentId: 1, _id: 0 }

  ).lean();



  return parents.map(p => p.parentId).filter(Boolean);

};



const broadcastRideEvent = async (io, driverId, event, ride) => {

  if (!ride) return;



  const payload = {

    driverId,

    rideId: ride.rideId,

    rideType: ride.rideType,

    status: ride.status,

    rideStarted: ride.status === 'started',

    startTime: ride.startTime || null,

    endTime: ride.endTime || null,

    timestamp: Date.now()

  };



  emitDriver(io, driverId, event, payload);



  const parentIds = await getParentIdsForDriver(driverId);



  for (const parentId of parentIds) {

    emitParent(io, parentId, event, payload);

    emitParent(io, parentId, 'dashboardUpdated', {

      type: event === 'rideStarted' ? 'ride_started' : 'ride_ended',

      ...payload

    });

  }

};



const broadcastStudentStatus = async (

  io,

  { parentId, driverId, rideType, status, timestamp, rideId }

) => {

  const payload = {

    parentId,

    driverId,

    rideType,

    status,

    timestamp: timestamp || new Date(),

    rideId: rideId || null

  };



  // Parent receives its own student state.

  emitParent(io, parentId, 'studentStatusUpdated', payload);

  emitParent(io, parentId, 'dashboardUpdated', {

    type: 'student_status_updated',

    ...payload

  });



  // Driver receives the same persisted state event.

  emitDriver(io, driverId, 'studentStatusUpdated', payload);

  emitDriver(io, driverId, 'dashboardUpdated', {

    type: 'student_status_updated',

    ...payload

  });

};



const validateBodyIds = (req, res) => {

  const { driverId, parentId } = req.body || {};



  if (!driverId || !parentId) {

    res.status(400).json({

      success: false,

      message: 'driverId and parentId are required'

    });

    return false;

  }



  return true;

};



/** START RIDE */

exports.startRide = async (req, res) => {

  try {

    const { driverId, rideType } = req.body || {};



    if (!driverId || !rideType) {

      return res.status(400).json({

        success: false,

        message: 'driverId and rideType are required'

      });

    }



    if (!['morning', 'evening'].includes(rideType)) {

      return res.status(400).json({

        success: false,

        message: 'Invalid rideType'

      });

    }



    const result = await rideService.startRide(driverId, rideType);

    const io = req.app.get('io');



    if (!result.alreadyStarted) {

      await broadcastRideEvent(io, driverId, 'rideStarted', result.ride);

    }



    return res.status(result.alreadyStarted ? 200 : 201).json({

      success: true,

      alreadyStarted: result.alreadyStarted,

      message: result.alreadyStarted

        ? `${rideType} ride already active`

        : `${rideType} ride started successfully`,

      data: {

        rideId: result.ride.rideId,

        driverId: result.ride.driverId,

        rideType: result.ride.rideType,

        rideDate: result.ride.rideDate || null,

        status: result.ride.status,

        rideStarted: result.ride.status === 'started',

        startTime: result.ride.startTime,

        endTime: result.ride.endTime || null

      }

    });

  } catch (error) {

    console.error('START RIDE ERROR:', error);

    return res.status(400).json({

      success: false,

      message: error.message || 'Unable to start ride'

    });

  }

};



/** END RIDE */

exports.endRide = async (req, res) => {

  try {

    const { driverId, rideType } = req.body || {};



    if (!driverId || !rideType) {

      return res.status(400).json({

        success: false,

        message: 'driverId and rideType are required'

      });

    }



    const ride = await rideService.endRide(driverId, rideType);

    const io = req.app.get('io');



    await broadcastRideEvent(io, driverId, 'rideEnded', ride);



    return res.status(200).json({

      success: true,

      message: `${rideType} ride ended successfully`,

      data: {

        rideId: ride.rideId,

        driverId: ride.driverId,

        rideType: ride.rideType,

        rideDate: ride.rideDate || null,

        status: ride.status,

        rideStarted: false,

        startTime: ride.startTime,

        endTime: ride.endTime

      }

    });

  } catch (error) {

    console.error('END RIDE ERROR:', error);

    return res.status(400).json({

      success: false,

      message: error.message || 'Unable to end ride'

    });

  }

};



/** LOCATION */

exports.updateLocation = async (req, res) => {

  try {

    const { driverId, rideType, latitude, longitude } = req.body || {};



    if (!driverId || !rideType) {

      return res.status(400).json({

        success: false,

        message: 'driverId and rideType are required'

      });

    }



    const ride = await rideService.updateLocation(

      driverId,

      rideType,

      latitude,

      longitude

    );



    const io = req.app.get('io');



    emitDriver(io, driverId, 'locationUpdated', {

      driverId,

      rideId: ride.rideId,

      rideType: ride.rideType,

      latitude: ride.currentLatitude,

      longitude: ride.currentLongitude,

      status: ride.status,

      timestamp: Date.now()

    });



    return res.status(200).json({

      success: true,

      message: 'Location updated successfully',

      data: {

        rideId: ride.rideId,

        driverId,

        rideType,

        latitude: ride.currentLatitude,

        longitude: ride.currentLongitude,

        status: ride.status

      }

    });

  } catch (error) {

    console.error('LOCATION UPDATE ERROR:', error);

    return res.status(400).json({

      success: false,

      message: error.message || 'Unable to update location'

    });

  }

};



/** RIDE STATUS */

exports.getRideStatus = async (req, res) => {

  try {

    const { driverId, rideType: routeRideType } = req.params;

    const { rideType: queryRideType, parentId } = req.query;

    const rideType = routeRideType || queryRideType;



    if (!driverId) {

      return res.status(400).json({

        success: false,

        message: 'driverId is required'

      });

    }



    const data = await rideService.getRideStatus(

      driverId,

      rideType,

      parentId

    );



    return res.status(200).json({ success: true, data });

  } catch (error) {

    console.error('GET RIDE STATUS ERROR:', error);

    return res.status(500).json({

      success: false,

      message: error.message || 'Unable to get ride status'

    });

  }

};



/** LIVE LOCATION */

exports.getLiveLocation = async (req, res) => {
  try {
    const { driverId, rideType } = req.params;
    const { parentId } = req.query;

    if (!driverId || !rideType || !parentId) {
      return res.status(400).json({
        success: false,
        trackingAvailable: false,
        message: 'driverId, rideType and parentId are required'
      });
    }

    if (!['morning', 'evening'].includes(rideType)) {
      return res.status(400).json({
        success: false,
        trackingAvailable: false,
        message: 'Invalid rideType'
      });
    }

    const parent = await Parent.findOne({ parentId, driverId });
    if (!parent) {
      return res.status(403).json({
        success: false,
        trackingAvailable: false,
        message: 'Parent is not assigned to this driver'
      });
    }

    const status = await rideService.getRideStatus(driverId, rideType, parentId);

    // Always return the registered route/name. This avoids hard-coded schools.
    const responseData = {
      rideId: status.rideId,
      driverId,
      rideType: status.rideType || rideType,
      rideStarted: status.rideStarted,
      latitude: status.currentLatitude,
      longitude: status.currentLongitude,
      currentLatitude: status.currentLatitude,
      currentLongitude: status.currentLongitude,
      startTime: status.startTime,
      endTime: status.endTime,
      status: status.status,
      updatedAt: status.updatedAt || null,
      studentStatus: status.studentStatus,
      trackingAvailable: status.trackingAvailable,
      etaStage: status.etaStage,
      etaDestination: status.etaDestination,
      route: status.route,
      journeyTimes: status.journeyTimes
    };

    if (parent.attendance !== true) {
      responseData.latitude = null;
      responseData.longitude = null;
      responseData.currentLatitude = null;
      responseData.currentLongitude = null;
      responseData.trackingAvailable = false;
    }

    return res.status(200).json({
      success: true,
      trackingAvailable: responseData.trackingAvailable,
      data: responseData
    });
  } catch (error) {
    console.error('LIVE LOCATION ERROR:', error);
    return res.status(500).json({
      success: false,
      trackingAvailable: false,
      message: error.message || 'Unable to get live location'
    });
  }
};

/** MORNING PICKUP */

exports.pickStudentMorning = async (req, res) => {

  try {

    if (!validateBodyIds(req, res)) return;



    const { driverId, parentId } = req.body;

    const result = await rideService.pickStudentMorning(driverId, parentId);

    const io = req.app.get('io');



    await broadcastStudentStatus(io, {

      parentId,

      driverId,

      rideType: 'morning',

      status: 'picked_up',

      timestamp: result.timestamp,

      rideId: result.rideId

    });



    return res.status(200).json({ success: true, data: result });

  } catch (error) {

    console.error('MORNING PICKUP ERROR:', error);

    return res.status(400).json({

      success: false,

      message: error.message || 'Unable to pick student'

    });

  }

};



/** MORNING SCHOOL DROP */

exports.dropStudentSchool = async (req, res) => {

  try {

    if (!validateBodyIds(req, res)) return;



    const { driverId, parentId } = req.body;

    const result = await rideService.dropStudentSchool(driverId, parentId);

    const io = req.app.get('io');



    await broadcastStudentStatus(io, {

      parentId,

      driverId,

      rideType: 'morning',

      status: 'dropped_at_school',

      timestamp: result.timestamp,

      rideId: result.rideId

    });



    return res.status(200).json({ success: true, data: result });

  } catch (error) {

    console.error('MORNING SCHOOL DROP ERROR:', error);

    return res.status(400).json({

      success: false,

      message: error.message || 'Unable to drop student at school'

    });

  }

};



/** EVENING SCHOOL PICKUP */

exports.pickStudentFromSchool = async (req, res) => {

  try {

    if (!validateBodyIds(req, res)) return;



    const { driverId, parentId } = req.body;

    const result = await rideService.pickStudentFromSchool(driverId, parentId);

    const io = req.app.get('io');



    await broadcastStudentStatus(io, {

      parentId,

      driverId,

      rideType: 'evening',

      status: 'picked_from_school',

      timestamp: result.timestamp,

      rideId: result.rideId

    });



    return res.status(200).json({ success: true, data: result });

  } catch (error) {

    console.error('EVENING SCHOOL PICKUP ERROR:', error);

    return res.status(400).json({

      success: false,

      message: error.message || 'Unable to pick student from school'

    });

  }

};



/** EVENING HOME DROP */

exports.dropStudentHome = async (req, res) => {

  try {

    if (!validateBodyIds(req, res)) return;



    const { driverId, parentId } = req.body;

    const result = await rideService.dropStudentHome(driverId, parentId);

    const io = req.app.get('io');



    await broadcastStudentStatus(io, {

      parentId,

      driverId,

      rideType: 'evening',

      status: 'dropped_at_home',

      timestamp: result.timestamp,

      rideId: result.rideId

    });



    return res.status(200).json({ success: true, data: result });

  } catch (error) {

    console.error('EVENING HOME DROP ERROR:', error);

    return res.status(400).json({

      success: false,

      message: error.message || 'Unable to drop student at home'

    });

  }

};



/** JOURNEY REPORT */

exports.getStudentJourneyReport = async (req, res) => {

  try {

    const { parentId } = req.params;

    const { date } = req.query;



    if (!parentId || !date) {

      return res.status(400).json({

        success: false,

        message: 'parentId and date are required'

      });

    }



    const report = await rideService.getStudentJourneyReport(

      parentId,

      date

    );



    return res.status(200).json({ success: true, data: report });

  } catch (error) {

    console.error('GET JOURNEY REPORT ERROR:', error);

    return res.status(500).json({

      success: false,

      message: error.message || 'Unable to get journey report'

    });

  }

};





/**

 * TEST-ONLY: RESET TODAY'S COMPLETED RIDE CYCLE

 *

 * This endpoint is intentionally disabled in production.

 * It is used only to repeat Home -> School -> Home tests

 * without waiting for the next business day.

 */

exports.resetTestCycle = async (req, res) => {

  try {

    const enabled =

      process.env.NODE_ENV !== 'production' &&

      process.env.ENABLE_RIDE_TEST_RESET !== 'false';



    if (!enabled) {

      return res.status(404).json({

        success: false,

        message: 'Test ride reset is disabled'

      });

    }



    const { driverId } = req.body || {};



    if (!driverId) {

      return res.status(400).json({

        success: false,

        message: 'driverId is required'

      });

    }



    const result = await rideService.resetTestCycle(driverId);

    const io = req.app.get('io');



    emitDriver(io, driverId, 'testCycleReset', {

      driverId,

      date: result.date,

      nextRide: result.nextRide,

      timestamp: Date.now()

    });



    for (const parentId of result.parentIds || []) {

      emitParent(io, parentId, 'testCycleReset', {

        driverId,

        parentId,

        date: result.date,

        nextRide: result.nextRide,

        timestamp: Date.now()

      });



      emitParent(io, parentId, 'dashboardUpdated', {

        type: 'test_cycle_reset',

        driverId,

        parentId,

        nextRide: result.nextRide,

        timestamp: Date.now()

      });

    }



    return res.status(200).json({

      success: true,

      message: 'Test ride cycle reset. Driver can start the morning ride again.',

      data: result

    });

  } catch (error) {

    console.error('TEST RIDE RESET ERROR:', error);



    return res.status(400).json({

      success: false,

      message: error.message || 'Unable to reset test ride cycle'

    });

  }

};
