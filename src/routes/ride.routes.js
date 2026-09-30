const express = require('express');
const router = express.Router();
const rideController = require('../controllers/ride.controller');

const requireHandler = name => {
  const handler = rideController[name];

  if (typeof handler !== 'function') {
    throw new TypeError(
      `[ride.routes.js] rideController.${name} is not a function. ` +
      `Check src/controllers/ride.controller.js`
    );
  }

  return handler;
};

// =========================================================
// RIDE LIFECYCLE
// =========================================================
router.post('/start', requireHandler('startRide'));
router.post('/location', requireHandler('updateLocation'));
router.post('/end', requireHandler('endRide'));

// =========================================================
// LIVE TRACKING
// =========================================================
router.get('/live/:driverId/:rideType', requireHandler('getLiveLocation'));

// Preferred status endpoint: rideType is optional query parameter.
// Example: /rides/status/DRV123?rideType=evening&parentId=PAR123
router.get('/status/:driverId', requireHandler('getRideStatus'));

// Backward-compatible route for callers using /status/:driverId/:rideType.
router.get('/status/:driverId/:rideType', requireHandler('getRideStatus'));

// =========================================================
// STUDENT JOURNEY STATE TRANSITIONS
// =========================================================
router.put('/pick-student-morning', requireHandler('pickStudentMorning'));
router.put('/drop-student-school', requireHandler('dropStudentSchool'));
router.put('/pick-student-school', requireHandler('pickStudentFromSchool'));
router.put('/drop-student-home', requireHandler('dropStudentHome'));

// =========================================================
// JOURNEY REPORT
// =========================================================
router.get('/journey-report/:parentId', requireHandler('getStudentJourneyReport'));

module.exports = router;

// TEST ONLY: repeat today's Home → School → Home cycle during development
router.post('/test/reset-cycle', requireHandler('resetTestCycle'));
