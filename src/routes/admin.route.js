const express = require('express');

const router = express.Router();

const adminController = require('../controllers/admin.controller');

router.get('/dashboard', adminController.dashboard);

router.get('/drivers', adminController.getDrivers);

router.put('/drivers/:id', adminController.updateDriver);

router.delete('/drivers/:id', adminController.deleteDriver);

router.get('/parents', adminController.getParents);

router.put('/parents/:id', adminController.updateParent);

router.delete('/parents/:id', adminController.deleteParent);



module.exports = router;