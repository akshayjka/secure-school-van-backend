const express = require('express');

const router = express.Router();

const parentController = require('../controllers/parent.controller');

router.post('/add',parentController.addParent);

module.exports = router;