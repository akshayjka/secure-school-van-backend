const express = require('express');

const router = express.Router();

const parentController = require('../controllers/parent.controller');

router.post('/add', parentController.addParent);
router.get('/', parentController.getAllParents);
router.get('/:id', parentController.getParent);
router.put('/:id', parentController.updateParent);
router.delete('/:id', parentController.deleteParent);
router.post( '/fcm-token', parentController.updateFcmToken);
router.get('/dashboard/:parentId',parentController.getDashboard);
router.put('/attendance', parentController.updateAttendance);
module.exports = router;