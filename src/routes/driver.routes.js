const express = require('express');
const router = express.Router();

const driverController = require('../controllers/driver.controller');

router.post(
  '/register',
  driverController.registerDriver
);

router.get(
  '/',
  driverController.getAllDrivers
);

router.post('/add', driverController.addDriver);

router.get('/dashboard/:driverId', driverController.getDashboard);
// router.get('/', driverController.getDrivers);

router.get('/:id', driverController.getDriver);

router.put('/:id', driverController.updateDriver);

router.delete('/:id', driverController.deleteDriver);
router.get('/referral/:driverId', driverController.getReferralDetails);
router.get('/referrals/:driverId', driverController.getReferredDrivers);

module.exports = router;