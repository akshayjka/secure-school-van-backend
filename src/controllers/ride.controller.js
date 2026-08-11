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
 *//**
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
     * Start Ride
     */

    const ride = await rideService.startRide(

      driverId,

      rideType

    );

    const io = req.app.get('io');

    /**
     * =====================================================
     * Driver Channel
     *
     * Driver +
     * All Parents
     * =====================================================
     */

    broadcastRideEvent(

      io,

      driverId,

      rideType,

      'rideStarted'

    );

    /**
     * Dashboard Refresh
     */

    broadcastDashboardUpdate(

      io,

      driverId,

      'ride_started'

    );

    /**
     * Parent Dashboard
     * (Backward Compatibility)
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

    /**
     * Success
     */

    return res.status(201).json({

      success: true,

      message: `${rideType} ride started successfully`,

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

exports.getLiveLocation = async (req, res) => {

  try {

    const {

      driverId,

      rideType

    } = req.params;

    /**
     * Validation
     */

    if (!driverId || !rideType) {

      return res.status(400).json({

        success: false,

        message: 'driverId and rideType are required'

      });

    }

    /**
     * Active Ride
     */

    const ride = await Ride.findOne({

      driverId,

      rideType,

      status: 'started'

    });

    if (!ride) {

      return res.status(404).json({

        success: false,

        message: 'No active ride found'

      });

    }

    return res.status(200).json({

      success: true,

      data: {

        rideId: ride.rideId,

        driverId: ride.driverId,

        rideType: ride.rideType,

        latitude: ride.currentLatitude,

        longitude: ride.currentLongitude,

        startTime: ride.startTime,

        status: ride.status,

        updatedAt: ride.updatedAt

      }

    });

  }

  catch (error) {

    console.error(

      'Live Location Error',

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
 * RIDE STATUS
 * =====================================================
 */

exports.getRideStatus = async (req, res) => {

  try {

    const {

      driverId,

      rideType

    } = req.params;

    /**
     * Validation
     */

    if (!driverId || !rideType) {

      return res.status(400).json({

        success: false,

        message: 'driverId and rideType are required'

      });

    }

    const data = await rideService.getRideStatus(

      driverId,

      rideType

    );

    return res.status(200).json({

      success: true,

      data: {

        driverId,

        rideType,

        rideStarted: data.rideStarted,

        status: data.status,

        timestamp: Date.now()

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
/**
 * =====================================================
 * MORNING PICKUP
 * =====================================================
 */

exports.pickStudentMorning = async (req, res) => {

  try {

    const { parentId } = req.body;

    const parent =
      await rideService.pickStudentMorning(parentId);

    const io = req.app.get('io');

    /**
     * Parent Room
     */

    emitParent(

      io,

      parent.parentId,

      'studentStatusUpdated',

      {

        parentId: parent.parentId,

        rideType: 'morning',

        status: 'picked_up'

      }

    );

    /**
     * Driver + Parents
     */

    emitDriverChannel(

      io,

      parent.driverId,

      'studentStatusUpdated',

      {

        parentId: parent.parentId,

        driverId: parent.driverId,

        rideType: 'morning',

        status: 'picked_up'

      }

    );

    broadcastDashboardUpdate(

      io,

      parent.driverId,

      'student_picked'

    );

    return res.status(200).json({

      success: true,

      message: 'Student picked successfully',

      data: parent

    });

  }

  catch (error) {

    console.error(error);

    return res.status(500).json({

      success: false,

      message: error.message

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

    const { parentId } = req.body;

    const parent =
      await rideService.dropStudentSchool(parentId);

    const io = req.app.get('io');

    emitParent(

      io,

      parent.parentId,

      'studentStatusUpdated',

      {

        parentId: parent.parentId,

        rideType: 'morning',

        status: 'dropped_at_school'

      }

    );

    emitDriverChannel(

      io,

      parent.driverId,

      'studentStatusUpdated',

      {

        parentId: parent.parentId,

        driverId: parent.driverId,

        rideType: 'morning',

        status: 'dropped_at_school'

      }

    );

    broadcastDashboardUpdate(

      io,

      parent.driverId,

      'student_dropped'

    );

    return res.status(200).json({

      success: true,

      message: 'Student dropped at school',

      data: parent

    });

  }

  catch (error) {

    console.error(error);

    return res.status(500).json({

      success: false,

      message: error.message

    });

  }

};

/**
 * =====================================================
 * EVENING PICKUP
 * =====================================================
 */

exports.pickStudentFromSchool = async (req, res) => {

  try {

    const { parentId } = req.body;

    const parent =
      await rideService.pickStudentFromSchool(parentId);

    const io = req.app.get('io');

    emitParent(

      io,

      parent.parentId,

      'studentStatusUpdated',

      {

        parentId: parent.parentId,

        rideType: 'evening',

        status: 'picked_from_school'

      }

    );

    emitDriverChannel(

      io,

      parent.driverId,

      'studentStatusUpdated',

      {

        parentId: parent.parentId,

        driverId: parent.driverId,

        rideType: 'evening',

        status: 'picked_from_school'

      }

    );

    broadcastDashboardUpdate(

      io,

      parent.driverId,

      'student_picked'

    );

    return res.status(200).json({

      success: true,

      message: 'Student picked from school',

      data: parent

    });

  }

  catch (error) {

    console.error(error);

    return res.status(500).json({

      success: false,

      message: error.message

    });

  }

};
/**
 * =====================================================
 * EVENING DROP
 * =====================================================
 */

exports.dropStudentHome = async (req, res) => {

  try {

    const { parentId } = req.body;

    const parent =
      await rideService.dropStudentHome(parentId);

    const io = req.app.get('io');

    emitParent(

      io,

      parent.parentId,

      'studentStatusUpdated',

      {

        parentId: parent.parentId,

        rideType: 'evening',

        status: 'dropped_at_home'

      }

    );

    emitDriverChannel(

      io,

      parent.driverId,

      'studentStatusUpdated',

      {

        parentId: parent.parentId,

        driverId: parent.driverId,

        rideType: 'evening',

        status: 'dropped_at_home'

      }

    );

    broadcastDashboardUpdate(

      io,

      parent.driverId,

      'student_dropped'

    );

    return res.status(200).json({

      success: true,

      message: 'Student dropped at home',

      data: parent

    });

  }

  catch (error) {

    console.error(error);

    return res.status(500).json({

      success: false,

      message: error.message

    });

  }

};