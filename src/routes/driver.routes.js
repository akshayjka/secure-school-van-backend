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

router.post('/add',driverController.addDriver);

module.exports = router;