const express =
    require('express');

const router =
    express.Router();

const rideController =
    require('../controllers/ride.controller');

router.post(
    '/start',
    rideController.startRide
);

router.post(
    '/location',
    rideController.updateLocation
);

router.post(
    '/end',
    rideController.endRide
);

router.get(
  '/live/:driverId/:rideType',
  rideController.getLiveLocation
);

// router.get(
//   '/live/:driverId/:rideType',
//   rideController.getLiveLocation
// );

// router.post(
//   '/start',
//   rideController.startRide
// );

// router.post(
//   '/end',
//   rideController.endRide
// );

router.get(
  '/status/:driverId/:rideType',
  rideController.getRideStatus
);

router.put(
  '/pick-student-morning',
  rideController.pickStudentMorning
);

router.put(
  '/drop-student-school',
  rideController.dropStudentSchool
);

router.put(
  '/pick-student-school',
  rideController.pickStudentFromSchool
);

router.put(
  '/drop-student-home',
  rideController.dropStudentHome
);

module.exports = router;