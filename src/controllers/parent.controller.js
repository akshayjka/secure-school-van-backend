const parentService = require('../services/parent.service');
const Parent = require('../models/parent.model');
const Attendance = require('../models/attendance.model');
const mongoose = require('mongoose');


/**
 * =====================================================
 * Helper
 * =====================================================
 */

const emitDriverChannel = (io, driverId, event, payload = {}) => {

  if (!driverId) {
    return;
  }

  io.to(`driver_${driverId}`).emit(
    event,
    payload
  );

};

/**
 * =====================================================
 * ADD PARENT
 * =====================================================
 */

const addParent = async (req, res) => {

  try {

    const parent =
      await parentService.addParent(req.body);

    return res.status(201).json({

      success: true,

      message: 'Parent added successfully',

      data: parent

    });

  }

  catch (error) {

    if (error.message === 'Parent already exists') {

      return res.status(409).json({

        success: false,

        message: error.message

      });

    }

    return res.status(500).json({

      success: false,

      message: error.message

    });

  }

};

/**
 * =====================================================
 * GET ALL
 * =====================================================
 */

const getAllParents = async (req, res) => {

  try {

    const parents =
      await parentService.getAllParents();

    return res.status(200).json({

      success: true,

      count: parents.length,

      data: parents

    });

  }

  catch (error) {

    return res.status(500).json({

      success: false,

      message: error.message

    });

  }

};

/**
 * =====================================================
 * GET ONE
 * =====================================================
 */

const getParent = async (req, res) => {

  try {

    const parent =
      await parentService.getParent(
        req.params.id
      );

    return res.status(200).json({

      success: true,

      data: parent

    });

  } catch (error) {

    console.error(
      'GET PARENT ERROR:',
      error
    );

    return res.status(500).json({

      success: false,

      message: error.message

    });

  }

};

/**
 * =====================================================
 * UPDATE
 * =====================================================
 */

const updateParent = async (req, res) => {

  try {

    const parent =
      await parentService.updateParent(
        req.params.id,
        req.body
      );

    return res.status(200).json({

      success: true,

      message: 'Parent updated successfully',

      data: parent

    });

  }

  catch (error) {

    return res.status(500).json({

      success: false,

      message: error.message

    });

  }

};

/**
 * =====================================================
 * DELETE
 * =====================================================
 */

const deleteParent = async (req, res) => {

  try {

    await parentService.deleteParent(
      req.params.id
    );

    return res.status(200).json({

      success: true,

      message: 'Parent deleted successfully'

    });

  }

  catch (error) {

    return res.status(500).json({

      success: false,

      message: error.message

    });

  }

};

/**
 * =====================================================
 * FCM
 * =====================================================
 */

const updateFcmToken = async (req, res) => {

  try {

    const {

      parentId,

      fcmToken

    } = req.body;

    await Parent.findOneAndUpdate(

      {

        parentId

      },

      {

        fcmToken

      }

    );

    res.json({

      success: true

    });

  }

  catch (error) {

    res.status(500).json({

      success: false,

      message: error.message

    });

  }

};

/**
 * =====================================================
 * DASHBOARD
 * =====================================================
 */

const getDashboard = async (req, res) => {

  try {

    const {

      parentId

    } = req.params;

    const data =
      await parentService.getDashboard(parentId);

    return res.status(200).json({

      success: true,

      data

    });

  }

  catch (error) {

    return res.status(500).json({

      success: false,

      message: error.message

    });

  }

};

/**
 * =====================================================
 * ATTENDANCE
 * =====================================================
 */

const updateAttendance = async (req, res) => {

  try {

    const {

      parentId,

      attendance

    } = req.body;

    const parent =
      await parentService.updateAttendance(

        parentId,

        attendance

      );

    const io =
      req.app.get('io');

    /**
     * Parent Room
     */

    io.to(parentId).emit(

      'attendanceUpdated',

      {

        parentId,

        attendance

      }

    );

    /**
     * Driver + Parents
     */

    emitDriverChannel(

      io,

      parent.driverId,

      'attendanceUpdated',

      {

        parentId,

        attendance,

        driverId: parent.driverId

      }

    );

    emitDriverChannel(

      io,

      parent.driverId,

      'dashboardUpdated',

      {

        type: 'attendance_updated'

      }

    );

    return res.status(200).json({

      success: true,

      message: 'Attendance updated',

      data: parent

    });

  }

  catch (error) {

    return res.status(500).json({

      success: false,

      message: error.message

    });

  }

};

/**
 * =====================================================
 * STUDENT STATUS
 * =====================================================
 */

const updateStudentStatus = async (req, res) => {

  try {

    const {

      parentId,

      rideType,

      status

    } = req.body;

    if (

      !parentId ||

      !rideType ||

      !status

    ) {

      return res.status(400).json({

        success: false,

        message:
          'parentId, rideType and status are required'

      });

    }

    const parent =
      await parentService.updateStudentStatus(

        parentId,

        rideType,

        status

      );

    const io =
      req.app.get('io');

    /**
     * Parent
     */

    io.to(parentId).emit(

      'studentStatusUpdated',

      {

        parentId,

        rideType,

        status

      }

    );

    /**
     * Driver + Parents
     */

    emitDriverChannel(

      io,

      parent.driverId,

      'studentStatusUpdated',

      {

        parentId,

        rideType,

        status,

        driverId: parent.driverId

      }

    );

    emitDriverChannel(

      io,

      parent.driverId,

      'dashboardUpdated',

      {

        type: 'student_status_updated'

      }

    );

    /**
     * Tracking
     */

    if (

      rideType === 'morning' &&

      status === 'picked_up'

    ) {

      io.to(parentId).emit(

        'trackingStarted',

        {

          parentId,

          rideType

        }

      );

    }

    if (

      rideType === 'morning' &&

      status === 'dropped_at_school'

    ) {

      io.to(parentId).emit(

        'trackingStopped',

        {

          parentId,

          rideType

        }

      );

    }

    if (

      rideType === 'evening' &&

      status === 'picked_from_school'

    ) {

      io.to(parentId).emit(

        'trackingStarted',

        {

          parentId,

          rideType

        }

      );

    }

    if (

      rideType === 'evening' &&

      status === 'dropped_at_home'

    ) {

      io.to(parentId).emit(

        'trackingStopped',

        {

          parentId,

          rideType

        }

      );

    }

    return res.status(200).json({

      success: true,

      message: 'Student status updated',

      data: parent

    });

  }

  catch (error) {

    return res.status(500).json({

      success: false,

      message: error.message

    });

  }

};

const saveMonthlyAttendance = async (
  req,
  res
) => {

  try {

    const {
      parentId,
      year,
      month,
      records
    } = req.body;

    if (!parentId) {

      return res.status(400).json({
        success: false,
        message: 'parentId is required'
      });

    }

    if (!year || !month) {

      return res.status(400).json({
        success: false,
        message:
          'year and month are required'
      });

    }

    if (!Array.isArray(records)) {

      return res.status(400).json({
        success: false,
        message:
          'records must be an array'
      });

    }

    // ==========================================
    // SAVE
    // ==========================================

    const result =
      await parentService
        .saveMonthlyAttendance(
          parentId,
          year,
          month,
          records
        );

    const io =
      req.app.get('io');

    // ==========================================
    // REAL-TIME SYNC
    // ==========================================

    emitAttendanceUpdated(
    io,
  result.parent,
  result.year,
  result.month,
  result.records
    );

    // ==========================================
    // RESPONSE
    // ==========================================

    return res.status(200).json({

      success: true,

      message:
        'Attendance saved successfully',

      data: {

        parentId:
          result.parentId,

        year:
          result.year,

        month:
          result.month,

        records:
          result.records

      }

    });

  }
  catch (error) {

    console.error(
      'SAVE MONTHLY ATTENDANCE ERROR:',
      error
    );

    return res.status(500).json({

      success: false,

      message: error.message

    });

  }

};

const getMonthlyAttendance = async (req, res) => {
  try {

    const { parentId } = req.params;
    const { year, month } = req.query;

    console.log('GET MONTHLY ATTENDANCE');
    console.log('parentId:', parentId);
    console.log('year:', year);
    console.log('month:', month);

    if (!parentId) {
      return res.status(400).json({
        success: false,
        message: 'parentId is required'
      });
    }

    let parent = null;

    // Frontend is sending MongoDB _id
    if (mongoose.Types.ObjectId.isValid(parentId)) {
      parent = await Parent.findById(parentId);
    }

    // Fallback to application parentId
    if (!parent) {
      parent = await Parent.findOne({
        parentId: parentId
      });
    }

    if (!parent) {
      return res.status(404).json({
        success: false,
        message: 'Parent not found',
        receivedParentId: parentId
      });
    }

    const startDate = new Date(
      Number(year),
      Number(month) - 1,
      1
    );

    const endDate = new Date(
      Number(year),
      Number(month),
      1
    );

    const records = await Attendance.find({
      parentId: parent.parentId,
      date: {
        $gte: startDate,
        $lt: endDate
      }
    }).sort({
      date: 1
    });

    return res.status(200).json({
      success: true,
      data: {
        parentId: parent.parentId,
        year: Number(year),
        month: Number(month),
        records
      }
    });

  } catch (error) {

    console.error(
      'GET MONTHLY ATTENDANCE ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const emitAttendanceUpdated = (
  io,
  parent,
  year,
  month,
  records = []
) => {

  if (!io || !parent) {
    return;
  }


  const parentId =
    parent.parentId;

  const driverId =
    parent.driverId;


  // =====================================================
  // FIND TODAY'S ATTENDANCE
  // =====================================================

  const today =
    new Date();

  const todayRecord =
    records.find(record => {

      const recordDate =
        new Date(record.date);

      return (
        recordDate.getFullYear() ===
          today.getFullYear() &&

        recordDate.getMonth() ===
          today.getMonth() &&

        recordDate.getDate() ===
          today.getDate()
      );

    });


  /*
   * Attendance collection stores:
   *
   * present
   * absent
   *
   * Convert that into boolean because
   * Driver Dashboard currently uses:
   *
   * student.attendance === true
   */

  const attendance =
    todayRecord
      ? todayRecord.status === 'present'
      : parent.attendance;


  // =====================================================
  // SOCKET PAYLOAD
  // =====================================================

  const payload = {

    parentId,

    driverId,

    studentName:
      parent.studentName,

    attendance,

    status:
      attendance
        ? 'present'
        : 'absent',

    date:
      today.toISOString(),

    year:
      Number(year),

    month:
      Number(month)

  };


  console.log(
    '📅 Broadcasting attendanceUpdated:',
    payload
  );


  // =====================================================
  // PARENT ATTENDANCE ROOM
  // =====================================================

  io.to(
    `parent_attendance_${parentId}`
  ).emit(
    'attendanceUpdated',
    payload
  );


  // =====================================================
  // ADMIN ROOM
  // =====================================================

  io.to('admins')
    .emit(
      'attendanceUpdated',
      payload
    );


  // =====================================================
  // DRIVER CHANNEL
  // =====================================================

  if (driverId) {

    const driverChannel =
      `driver_${driverId}`;


    console.log(
      `🚌 Sending attendance update to ${driverChannel}`
    );


    io.to(
      driverChannel
    ).emit(
      'attendanceUpdated',
      payload
    );

  }

};

module.exports = {

  addParent,

  getAllParents,

  getParent,

  updateParent,

  deleteParent,

  updateFcmToken,

  getDashboard,

  updateAttendance,
emitAttendanceUpdated,
  updateStudentStatus,
  saveMonthlyAttendance,
  getMonthlyAttendance

};