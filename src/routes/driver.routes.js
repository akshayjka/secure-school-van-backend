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

module.exports = router;