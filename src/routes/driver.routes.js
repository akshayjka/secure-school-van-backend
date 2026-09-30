const express = require('express');
const router = express.Router();

const driverController = require('../controllers/driver.controller');

router.post('/register', driverController.registerDriver);
router.get('/', driverController.getAllDrivers);
router.post('/add', driverController.addDriver);

/*
 * IMPORTANT:
 * Keep this route before /:id so "dashboard" is never interpreted
 * as a driver id.
 */
router.get('/dashboard/:driverId', driverController.getDashboard);

router.get('/find', driverController.findDriver);
router.get('/referral/:driverId', driverController.getReferralDetails);
router.get('/referrals/:driverId', driverController.getReferredDrivers);

router.get('/:id', driverController.getDriver);
router.put('/:id', driverController.updateDriver);
router.delete('/:id', driverController.deleteDriver);

module.exports = router;
