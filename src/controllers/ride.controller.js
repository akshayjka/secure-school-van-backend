
const Ride = require('../models/ride.model');
const Parent = require('../models/parent.model');

const rideService =
  require('../services/ride.service');

/**
 * =========================================================
 * SOCKET HELPERS
 * =========================================================
 */

const getDriverRoom = (
  driverId
) => `driver_${driverId}`;

const emitDriverChannel = (
  io,
  driverId,
  event,
  payload = {}
) => {
  if (!io || !driverId) {
    return;
  }

  io.to(
    getDriverRoom(driverId)
  ).emit(
    event,
    payload
  );
};

const emitParent = (
  io,
  parentId,
  event,
  payload = {}
) => {
  if (!io || !parentId) {
    return;
  }

  io.to(
    parentId
  ).emit(
    event,
    payload
  );
};

const getParentIdsForDriver =
  async (
    driverId
  ) => {
    const parents =
      await Parent.find(
        {
          driverId
        },
        {
          parentId: 1,
          _id: 0
        }
      ).lean();

    return parents
      .map(p => p.parentId)
      .filter(Boolean);
  };

const broadcastRideEvent =
  async (
    io,
    driverId,
    event,
    ride
  ) => {
    if (!ride) {
      return;
    }

    const payload = {
      driverId,
      rideId:
        ride.rideId,
      rideType:
        ride.rideType,
      status:
        ride.status,
      rideStarted:
        ride.status ===
        'started',
      startTime:
        ride.startTime ||
        null,
      endTime:
        ride.endTime ||
        null,
      timestamp:
        Date.now()
    };

    /*
     * Driver channel.
     */
    emitDriverChannel(
      io,
      driverId,
      event,
      payload
    );

    /*
     * Parent rooms.
     *
     * This guarantees the Parent Dashboard receives the
     * event even if it is not listening on the driver room.
     */
    const parentIds =
      await getParentIdsForDriver(
        driverId
      );

    parentIds.forEach(
      parentId => {
        emitParent(
          io,
          parentId,
          event,
          payload
        );
      }
    );

    /*
     * Dashboard refresh event.
     */
    parentIds.forEach(
      parentId => {
        emitParent(
          io,
          parentId,
          'dashboardUpdated',
          {
            type:
              event === 'rideStarted'
                ? 'ride_started'
                : 'ride_ended',

            driverId,

            rideId:
              ride.rideId,

            rideType:
              ride.rideType,

            status:
              ride.status,

            rideStarted:
              ride.status ===
              'started',

            timestamp:
              Date.now()
          }
        );
      }
    );
  };

const broadcastDashboardUpdate =
  async (
    io,
    driverId,
    type,
    extra = {}
  ) => {
    const payload = {
      type,
      driverId,
      ...extra,
      timestamp:
        Date.now()
    };

    emitDriverChannel(
      io,
      driverId,
      'dashboardUpdated',
      payload
    );

    const parentIds =
      await getParentIdsForDriver(
        driverId
      );

    parentIds.forEach(
      parentId => {
        emitParent(
          io,
          parentId,
          'dashboardUpdated',
          payload
        );
      }
    );
  };

/**
 * =========================================================
 * DAILY JOURNEY REPORT
 * =========================================================
 */

exports.getStudentJourneyReport =
  async (
    req,
    res
  ) => {
    try {
      const {
        parentId
      } = req.params;

      const {
        date
      } = req.query;

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

      const data =
        await rideService
          .getStudentJourneyReport(
            parentId,
            date
          );

      return res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
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
 * =========================================================
 * START RIDE
 * =========================================================
 */

exports.startRide =
  async (
    req,
    res
  ) => {
    try {
      const {
        driverId,
        rideType
      } = req.body;

      if (
        !driverId ||
        !rideType
      ) {
        return res.status(400).json({
          success: false,
          message:
            'driverId and rideType are required'
        });
      }

      if (
        !['morning', 'evening']
          .includes(rideType)
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Invalid rideType'
        });
      }

      const result =
        await rideService
          .startRide(
            driverId,
            rideType
          );

      const ride =
        result.ride;

      const alreadyStarted =
        result.alreadyStarted ===
        true;

      const io =
        req.app.get('io');

      /*
       * Only broadcast when the database transitioned
       * from no active ride -> active ride.
       */
      if (!alreadyStarted) {
        await broadcastRideEvent(
          io,
          driverId,
          'rideStarted',
          ride
        );

        await broadcastDashboardUpdate(
          io,
          driverId,
          'ride_started',
          {
            rideId:
              ride.rideId,
            rideType:
              ride.rideType,
            status:
              ride.status,
            rideStarted:
              true
          }
        );
      }

      return res.status(
        alreadyStarted
          ? 200
          : 201
      ).json({
        success: true,

        alreadyStarted,

        message:
          alreadyStarted
            ? `${rideType} ride already active`
            : `${rideType} ride started successfully`,

        data: {
          rideId:
            ride.rideId,

          driverId:
            ride.driverId,

          rideType:
            ride.rideType,

          status:
            ride.status,

          rideStarted:
            ride.status ===
            'started',

          startTime:
            ride.startTime,

          endTime:
            ride.endTime ||
            null
        }
      });
    } catch (error) {
      console.error(
        'Start Ride Error:',
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          'Unable to start ride'
      });
    }
  };

/**
 * =========================================================
 * UPDATE LOCATION
 * =========================================================
 */

exports.updateLocation =
  async (
    req,
    res
  ) => {
    try {
      const {
        driverId,
        rideType,
        latitude,
        longitude
      } = req.body;

      if (
        !driverId ||
        !rideType
      ) {
        return res.status(400).json({
          success: false,
          message:
            'driverId and rideType are required'
        });
      }

      const ride =
        await rideService
          .updateLocation(
            driverId,
            rideType,
            latitude,
            longitude
          );

      const io =
        req.app.get('io');

      /*
       * Location is also a dashboard synchronization event,
       * but ride state still comes from MongoDB.
       */
      emitDriverChannel(
        io,
        driverId,
        'locationUpdated',
        {
          driverId,
          rideId:
            ride.rideId,
          rideType:
            ride.rideType,
          latitude:
            ride.currentLatitude,
          longitude:
            ride.currentLongitude,
          status:
            ride.status,
          timestamp:
            Date.now()
        }
      );

      await broadcastDashboardUpdate(
        io,
        driverId,
        'location_updated',
        {
          rideId:
            ride.rideId,
          rideType:
            ride.rideType,
          status:
            ride.status
        }
      );

      return res.status(200).json({
        success: true,
        message:
          'Location updated successfully',
        data: {
          rideId:
            ride.rideId,
          driverId,
          rideType,
          latitude:
            ride.currentLatitude,
          longitude:
            ride.currentLongitude,
          status:
            ride.status
        }
      });
    } catch (error) {
      console.error(
        'Location Update Error:',
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          'Unable to update location'
      });
    }
  };

/**
 * =========================================================
 * END RIDE
 * =========================================================
 */

exports.endRide =
  async (
    req,
    res
  ) => {
    try {
      const {
        driverId,
        rideType
      } = req.body;

      if (
        !driverId ||
        !rideType
      ) {
        return res.status(400).json({
          success: false,
          message:
            'driverId and rideType are required'
        });
      }

      if (
        !['morning', 'evening']
          .includes(rideType)
      ) {
        return res.status(400).json({
          success: false,
          message:
            'Invalid rideType'
        });
      }

      const ride =
        await rideService
          .endRide(
            driverId,
            rideType
          );

      const io =
        req.app.get('io');

      await broadcastRideEvent(
        io,
        driverId,
        'rideEnded',
        ride
      );

      await broadcastDashboardUpdate(
        io,
        driverId,
        'ride_ended',
        {
          rideId:
            ride.rideId,
          rideType:
            ride.rideType,
          status:
            ride.status,
          rideStarted:
            false
        }
      );

      return res.status(200).json({
        success: true,

        message:
          `${rideType} ride ended successfully`,

        data: {
          rideId:
            ride.rideId,

          driverId:
            ride.driverId,

          rideType:
            ride.rideType,

          status:
            ride.status,

          rideStarted:
            false,

          startTime:
            ride.startTime,

          endTime:
            ride.endTime
        }
      });
    } catch (error) {
      console.error(
        'End Ride Error:',
        error
      );

      return res.status(400).json({
        success: false,
        message:
          error.message ||
          'Unable to end ride'
      });
    }
  };

/**
 * =========================================================
 * LIVE LOCATION
 * =========================================================
 */

exports.getLiveLocation =
  async (
    req,
    res
  ) => {
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
          trackingAvailable: false,
          message:
            'driverId, rideType and parentId are required'
        });
      }

      if (
        !['morning', 'evening']
          .includes(rideType)
      ) {
        return res.status(400).json({
          success: false,
          trackingAvailable: false,
          message:
            'Invalid rideType'
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
          trackingAvailable: false,
          message:
            'Parent is not assigned to this driver'
        });
      }

      /*
       * IMPORTANT:
       * Only today's active ride can be tracked.
       */
      const status =
        await rideService
          .getRideStatus(
            driverId,
            rideType,
            parentId
          );

      if (
        status.rideStarted !== true ||
        status.status !== 'started'
      ) {
        return res.status(404).json({
          success: false,
          trackingAvailable: false,
          message:
            'No active ride found'
        });
      }

      if (
        parent.attendance !== true
      ) {
        return res.status(403).json({
          success: false,
          trackingAvailable: false,
          message:
            'Live tracking is unavailable because the student is absent'
        });
      }

      if (
        rideType === 'morning'
      ) {
        if (
          parent.morningStatus ===
          'dropped_at_school'
        ) {
          return res.status(403).json({
            success: false,
            trackingAvailable: false,
            message:
              'Morning tracking ended because the student reached school'
          });
        }

        /*
         * Existing product rule:
         * morning tracking is available after pickup.
         */
        if (
          parent.morningStatus !==
          'picked_up'
        ) {
          return res.status(403).json({
            success: false,
            trackingAvailable: false,
            message:
              'Live tracking is available after student pickup'
          });
        }
      }

      if (
        rideType === 'evening'
      ) {
        /*
         * Return tracking is available only after
         * the student has boarded the return van.
         */
        if (
          parent.eveningStatus !==
          'picked_from_school'
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
            status.rideId,

          driverId,

          rideType,

          latitude:
            status.currentLatitude,

          longitude:
            status.currentLongitude,

          startTime:
            status.startTime,

          status:
            status.status,

          updatedAt:
            status.updatedAt ||
            null
        }
      });
    } catch (error) {
      console.error(
        'Live Location Error:',
        error
      );

      return res.status(500).json({
        success: false,
        trackingAvailable: false,
        message:
          error.message ||
          'Unable to get live location'
      });
    }
  };

/**
 * =========================================================
 * RIDE STATUS
 * =========================================================
 */

exports.getRideStatus =
  async (
    req,
    res
  ) => {
    try {
      const {
        driverId
      } = req.params;

      const {
        rideType,
        parentId
      } = req.query;

      if (!driverId) {
        return res.status(400).json({
          success: false,
          message:
            'driverId is required'
        });
      }

      const data =
        await rideService
          .getRideStatus(
            driverId,
            rideType,
            parentId
          );

      return res.status(200).json({
        success: true,
        data
      });
    } catch (error) {
      console.error(
        'Get Ride Status Error:',
        error
      );

      return res.status(500).json({
        success: false,
        message:
          error.message ||
          'Unable to get ride status'
      });
    }
  };

/**
 * =========================================================
 * MORNING PICKUP
 * =========================================================
 */

exports.pickStudentMorning =
  async (
    req,
    res
  ) => {
    try {
      const {
        driverId,
        parentId
      } = req.body;

      if (
        !driverId ||
        !parentId
      ) {
        return res.status(400).json({
          success: false,
          message:
            'driverId and parentId are required'
        });
      }

      const result =
        await rideService
          .pickStudentMorning(
            driverId,
            parentId
          );

      const io =
        req.app.get('io');

      emitParent(
        io,
        parentId,
        'studentStatusUpdated',
        {
          parentId,
          driverId,
          rideType:
            'morning',
          status:
            'picked_up',
          timestamp:
            result.timestamp
        }
      );

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message:
          error.message
      });
    }
  };

/**
 * =========================================================
 * MORNING DROP
 * =========================================================
 */

exports.dropStudentSchool =
  async (
    req,
    res
  ) => {
    try {
      const {
        driverId,
        parentId
      } = req.body;

      const result =
        await rideService
          .dropStudentSchool(
            driverId,
            parentId
          );

      const io =
        req.app.get('io');

      emitParent(
        io,
        parentId,
        'studentStatusUpdated',
        {
          parentId,
          driverId,
          rideType:
            'morning',
          status:
            'dropped_at_school',
          timestamp:
            result.timestamp
        }
      );

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message:
          error.message
      });
    }
  };

/**
 * =========================================================
 * EVENING PICKUP
 * =========================================================
 */

exports.pickStudentFromSchool =
  async (
    req,
    res
  ) => {
    try {
      const {
        driverId,
        parentId
      } = req.body;

      const result =
        await rideService
          .pickStudentFromSchool(
            driverId,
            parentId
          );

      const io =
        req.app.get('io');

      emitParent(
        io,
        parentId,
        'studentStatusUpdated',
        {
          parentId,
          driverId,
          rideType:
            'evening',
          status:
            'picked_from_school',
          timestamp:
            result.timestamp
        }
      );

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message:
          error.message
      });
    }
  };

/**
 * =========================================================
 * EVENING DROP
 * =========================================================
 */

exports.dropStudentHome =
  async (
    req,
    res
  ) => {
    try {
      const {
        driverId,
        parentId
      } = req.body;

      const result =
        await rideService
          .dropStudentHome(
            driverId,
            parentId
          );

      const io =
        req.app.get('io');

      emitParent(
        io,
        parentId,
        'studentStatusUpdated',
        {
          parentId,
          driverId,
          rideType:
            'evening',
          status:
            'dropped_at_home',
          timestamp:
            result.timestamp
        }
      );

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        message:
          error.message
      });
    }
  };
