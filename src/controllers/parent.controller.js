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

    const responseData = {
      ...(
        typeof parent?.toObject === 'function'
          ? parent.toObject()
          : parent
      )
    };

    delete responseData.password;

    return res.status(201).json({

      success: true,

      message:
        parent?.driverCreated
          ? 'Parent registered and new driver created successfully'
          : 'Parent added successfully',

      driverCreated:
        Boolean(parent?.driverCreated),

      data: responseData

    });

  }

  catch (error) {

    if (error.message === 'Parent already exists') {

      return res.status(409).json({

        success: false,

        message: error.message

      });

    }

    const statusCode =
      [
        'Parent already exists',
        'Driver ID is already assigned to another driver'
      ].includes(error.message)
        ? 409
        : [
            'Invalid parent mobile number',
            'Driver mobile number is required when adding a new driver',
            'Invalid driver mobile number',
            'Valid pickup location coordinates are required',
            'Valid school location coordinates are required',
            'Registration data is required'
          ].includes(error.message)
            ? 400
            : 500;

    return res.status(statusCode).json({

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

    // =====================================================
    // KEEP PARENT ATTENDANCE BOOLEAN IN SYNC FOR TODAY
    // =====================================================
    const today = new Date();
    const todayRecord = result.records.find(record => {
      const date = new Date(record.date);
      return (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
      );
    });

    if (todayRecord) {

      result.parent.attendance = todayRecord.status === 'present';

      await result.parent.save();

    }

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

    // =====================================================
    // UPDATE PARENT DASHBOARD IMMEDIATELY
    // =====================================================

    io.to(result.parent.parentId).emit(
      'dashboardUpdated',
      {
        type: 'attendance_updated',

        parentId:
          result.parent.parentId,

        attendance:
          todayRecord
            ? todayRecord.status === 'present'
            : false,

        todayAttendanceStatus:
          todayRecord?.status ||
          'not_marked',

        timestamp:
          Date.now()
      }
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

/**
 * =====================================================
 * UPDATE STUDENT RIDE STATUS
 * =====================================================
 */

const updateStudentStatus = async (req, res) => {

  try {

    const {
      parentId,
      rideType,
      status
    } = req.body;

    console.log(
      '========================================'
    );

    console.log(
      'UPDATE STUDENT STATUS'
    );

    console.log(
      'parentId:',
      parentId
    );

    console.log(
      'rideType:',
      rideType
    );

    console.log(
      'status:',
      status
    );

    console.log(
      '========================================'
    );

    // -------------------------------------------------
    // VALIDATION
    // -------------------------------------------------

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

    if (
      !['morning', 'evening']
        .includes(rideType)
    ) {

      return res.status(400).json({

        success: false,

        message:
          'Invalid rideType'

      });

    }

    // -------------------------------------------------
    // UPDATE THROUGH SERVICE
    // -------------------------------------------------

    const result =
      await parentService.updateStudentStatus(
        parentId,
        rideType,
        status
      );

    const parent =
      result.parent;

    const eventTime =
      result.eventTime;

    // -------------------------------------------------
    // JOURNEY TIMES
    // -------------------------------------------------

    const journeyTimes = {

      morningPickedUpAt:
        parent.morningPickedUpAt || null,

      morningDroppedAtSchoolAt:
        parent.morningDroppedAtSchoolAt || null,

      eveningPickedFromSchoolAt:
        parent.eveningPickedFromSchoolAt || null,

      eveningDroppedAtHomeAt:
        parent.eveningDroppedAtHomeAt || null

    };

    // -------------------------------------------------
    // FINAL DATABASE STATUS
    // -------------------------------------------------

    const finalStatus =
      rideType === 'morning'
        ? parent.morningStatus
        : parent.eveningStatus;

    // -------------------------------------------------
    // SOCKET
    // -------------------------------------------------

    const io =
      req.app.get('io');

    const socketPayload = {

      parentId:
        parent.parentId,

      driverId:
        parent.driverId,

      studentName:
        parent.studentName,

      rideType,

      // Return the frontend action.
      // Example evening pickup = picked_up.
      status,

      // Return actual DB status too.
      finalStatus,

      eventTime,

      timestamp:
        eventTime,

      journeyTimes

    };

    if (io) {

      // Parent room
      io.to(
        parent.parentId
      ).emit(
        'studentStatusUpdated',
        socketPayload
      );

      // Driver room
      emitDriverChannel(
        io,
        parent.driverId,
        'studentStatusUpdated',
        socketPayload
      );

      // Driver dashboard refresh
      emitDriverChannel(
        io,
        parent.driverId,
        'dashboardUpdated',
        {
          type:
            'student_status_updated',

          parentId:
            parent.parentId,

          rideType,

          status:
            finalStatus,

          timestamp:
            eventTime
        }
      );

    }

    // -------------------------------------------------
    // RESPONSE
    // -------------------------------------------------

    return res.status(200).json({

      success: true,

      message:
        'Student status updated successfully',

      data: {

        parent,

        status,

        finalStatus,

        eventTime,

        journeyTimes

      }

    });

  }

  catch (error) {

    console.error(
      '❌ UPDATE STUDENT STATUS ERROR:',
      error
    );

    return res.status(500).json({

      success: false,

      message:
        error.message ||
        'Failed to update student status'

    });

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
