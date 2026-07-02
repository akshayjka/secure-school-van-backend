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
    '/live/:driverId',
    rideController.getLiveLocation
);

router.get(
  '/status/:driverId',
  rideController.getRideStatus
);

router.post(
  '/start',
  rideController.startRide
);

router.post(
  '/end',
  rideController.endRide
);

router.get(
  '/status/:driverId',
  rideController.getRideStatus
);


module.exports = router;