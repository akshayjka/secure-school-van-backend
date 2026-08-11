const express = require('express');

const router = express.Router();

const parentController =
  require('../controllers/parent.controller');


// =====================================================
// PARENT MANAGEMENT
// =====================================================

router.post(
  '/add',
  parentController.addParent
);

router.get(
  '/',
  parentController.getAllParents
);


// =====================================================
// DASHBOARD
// =====================================================

router.get(
  '/dashboard/:parentId',
  parentController.getDashboard
);


// =====================================================
// MONTHLY ATTENDANCE
// IMPORTANT: BEFORE /:id
// =====================================================




// =====================================================
// STUDENT STATUS
// =====================================================

router.put(
  '/update-status',
  parentController.updateStudentStatus
);


// =====================================================
// FCM TOKEN
// =====================================================

router.post(
  '/fcm-token',
  parentController.updateFcmToken
);


// =====================================================
// GENERIC PARENT ID ROUTES
// IMPORTANT: THESE MUST BE LAST
// =====================================================


router.put(
  '/attendance',
  parentController.saveMonthlyAttendance
);

router.get(
  '/attendance/:parentId',
  parentController.getMonthlyAttendance
);

router.get(
  '/:id',
  parentController.getParent
);

router.put(
  '/:id',
  parentController.updateParent
);

router.delete(
  '/:id',
  parentController.deleteParent
);


// =====================================================

module.exports = router;