const parentService =
  require('../services/parent.service');

const Parent =
  require('../models/parent.model');

const Attendance =
  require('../models/attendance.model');

const mongoose =
  require('mongoose');




/**
 * =====================================================
 * SOCKET HELPER
 * =====================================================
 */

const emitDriverChannel = (
  io,
  driverId,
  event,
  payload = {}
) => {

  if (!io || !driverId) {
    return;
  }

  io.to(
    `driver_${driverId}`
  ).emit(
    event,
    payload
  );
};


/**
 * =====================================================
 * DATE HELPERS
 * =====================================================
 *
 * IMPORTANT:
 * Do not use:
 *
 * new Date('2026-09-25')
 *
 * and then setHours().
 *
 * That can cause timezone shifts because
 * YYYY-MM-DD strings are interpreted as UTC.
 *
 * We explicitly construct the local date.
 */

const normalizeAttendanceDate = (
  value
) => {

  if (!value) {
    return null;
  }

  // Already a Date
  if (value instanceof Date) {

    if (
      Number.isNaN(
        value.getTime()
      )
    ) {
      return null;
    }

    return new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate(),
      0,
      0,
      0,
      0
    );
  }


  // YYYY-MM-DD
  if (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {

    const [
      year,
      month,
      day
    ] = value
      .split('-')
      .map(Number);

    const date =
      new Date(
        year,
        month - 1,
        day,
        0,
        0,
        0,
        0
      );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return null;
    }

    return date;
  }


  // Fallback for ISO strings
  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return null;
  }

  return new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
    0,
    0,
    0,
    0
  );
};


/**
 * =====================================================
 * DATE -> YYYY-MM-DD
 * =====================================================
 */

const formatAttendanceDate = (
  date
) => {

  if (!date) {
    return '';
  }

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(2, '0');

  const day =
    String(
      date.getDate()
    ).padStart(2, '0');

  return `${year}-${month}-${day}`;
};


/**
 * =====================================================
 * FIND PARENT
 * =====================================================
 */

const findParentByIdentifier = async (
  parentId
) => {

  let parent = null;


  // MongoDB ObjectId support
  if (
    mongoose.Types.ObjectId.isValid(
      parentId
    )
  ) {

    parent =
      await Parent.findById(
        parentId
      );
  }


  // Application parentId support
  if (!parent) {

    parent =
      await Parent.findOne({
        parentId
      });
  }


  return parent;
};

/**
 * =====================================================
 * ADD PARENT
 * =====================================================
 */

const addParent = async (
  req,
  res
) => {

  try {

    const parent =
      await parentService.addParent(
        req.body
      );


    return res.status(201).json({

      success: true,

      message:
        'Parent added successfully',

      data:
        parent

    });

  }

  catch (error) {

    console.error(
      'ADD PARENT ERROR:',
      error
    );


    if (
      error.message ===
      'Parent already exists'
    ) {

      return res.status(409).json({

        success: false,

        message:
          error.message

      });

    }


    return res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

};


/**
 * =====================================================
 * GET ALL PARENTS
 * =====================================================
 */

const getAllParents = async (
  req,
  res
) => {

  try {

    const parents =
      await parentService
        .getAllParents();


    return res.status(200).json({

      success: true,

      count:
        parents.length,

      data:
        parents

    });

  }

  catch (error) {

    console.error(
      'GET ALL PARENTS ERROR:',
      error
    );


    return res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

};


/**
 * =====================================================
 * GET SINGLE PARENT
 * =====================================================
 */

const getParent = async (
  req,
  res
) => {

  try {

    const parent =
      await parentService
        .getParent(
          req.params.id
        );


    if (!parent) {

      return res.status(404).json({

        success: false,

        message:
          'Parent not found'

      });

    }


    return res.status(200).json({

      success: true,

      data:
        parent

    });

  }

  catch (error) {

    console.error(
      'GET PARENT ERROR:',
      error
    );


    return res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

};


/**
 * =====================================================
 * UPDATE PARENT
 * =====================================================
 */

const updateParent = async (
  req,
  res
) => {

  try {

    const parent =
      await parentService
        .updateParent(
          req.params.id,
          req.body
        );


    if (!parent) {

      return res.status(404).json({

        success: false,

        message:
          'Parent not found'

      });

    }


    return res.status(200).json({

      success: true,

      message:
        'Parent updated successfully',

      data:
        parent

    });

  }

  catch (error) {

    console.error(
      'UPDATE PARENT ERROR:',
      error
    );


    return res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

};


/**
 * =====================================================
 * DELETE PARENT
 * =====================================================
 */

const deleteParent = async (
  req,
  res
) => {

  try {

    const result =
      await parentService
        .deleteParent(
          req.params.id
        );


    return res.status(200).json({

      success: true,

      message:
        'Parent deleted successfully',

      data:
        result

    });

  }

  catch (error) {

    console.error(
      'DELETE PARENT ERROR:',
      error
    );


    return res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

};


/**
 * =====================================================
 * GET DASHBOARD
 * =====================================================
 */

const getDashboard = async (
  req,
  res
) => {

  try {

    const {
      parentId
    } = req.params;


    if (!parentId) {

      return res.status(400).json({

        success: false,

        message:
          'parentId is required'

      });

    }


    const data =
      await parentService
        .getDashboard(
          parentId
        );


    return res.status(200).json({

      success: true,

      data

    });

  }

  catch (error) {

    console.error(
      'GET PARENT DASHBOARD ERROR:',
      error
    );


    return res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

};


/**
 * =====================================================
 * TODAY ATTENDANCE
 * =====================================================
 */

const updateAttendance = async (
  req,
  res
) => {

  try {

    const {
      parentId,
      attendance
    } = req.body;


    if (!parentId) {

      return res.status(400).json({

        success: false,

        message:
          'parentId is required'

      });

    }


    const parent =
      await parentService
        .updateAttendance(
          parentId,
          Boolean(attendance)
        );


    if (!parent) {

      return res.status(404).json({

        success: false,

        message:
          'Parent not found'

      });

    }


    const io =
      req.app.get('io');


    if (io) {

      io.to(parentId).emit(

        'attendanceUpdated',

        {

          parentId,

          attendance:
            Boolean(attendance)

        }

      );


      emitDriverChannel(

        io,

        parent.driverId,

        'attendanceUpdated',

        {

          parentId,

          attendance:
            Boolean(attendance),

          driverId:
            parent.driverId

        }

      );


      emitDriverChannel(

        io,

        parent.driverId,

        'dashboardUpdated',

        {

          type:
            'attendance_updated',

          parentId,

          timestamp:
            Date.now()

        }

      );

    }


    return res.status(200).json({

      success: true,

      message:
        'Attendance updated',

      data:
        parent

    });

  }

  catch (error) {

    console.error(
      'UPDATE ATTENDANCE ERROR:',
      error
    );


    return res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

};


/**
 * =====================================================
 * TOMORROW ATTENDANCE
 * =====================================================
 *
 * POST /api/parents/tomorrow-attendance
 *
 * Body:
 *
 * {
 *   "parentId": "PAR123",
 *   "status": "present"
 * }
 *
 * Optional:
 *
 * {
 *   "parentId": "PAR123",
 *   "status": "present",
 *   "date": "2026-09-26"
 * }
 */

const updateTomorrowAttendance =
  async (
    req,
    res
  ) => {

    try {

      const {
        parentId,
        status,
        date
      } = req.body;


      // -------------------------------------------------
      // VALIDATION
      // -------------------------------------------------

      if (!parentId) {

        return res.status(400).json({

          success: false,

          message:
            'parentId is required'

        });
      }


      if (
        !['present', 'absent']
          .includes(status)
      ) {

        return res.status(400).json({

          success: false,

          message:
            'status must be present or absent'

        });
      }


      // -------------------------------------------------
      // FIND PARENT
      // -------------------------------------------------

      const parent =
        await findParentByIdentifier(
          parentId
        );


      if (!parent) {

        return res.status(404).json({

          success: false,

          message:
            'Parent not found'

        });
      }


      // -------------------------------------------------
      // DETERMINE TOMORROW
      // -------------------------------------------------

      let attendanceDate;


      if (date) {

        attendanceDate =
          normalizeAttendanceDate(
            date
          );

      } else {

        const tomorrow =
          new Date();

        tomorrow.setDate(
          tomorrow.getDate() + 1
        );

        attendanceDate =
          normalizeAttendanceDate(
            tomorrow
          );
      }


      if (!attendanceDate) {

        return res.status(400).json({

          success: false,

          message:
            'Invalid attendance date'

        });
      }


      // -------------------------------------------------
      // SAVE / UPDATE
      // -------------------------------------------------

      const attendance =
        await Attendance.findOneAndUpdate(

          {
            parentId:
              parent.parentId,

            date:
              attendanceDate
          },

          {
            parentId:
              parent.parentId,

            date:
              attendanceDate,

            status
          },

          {
            new: true,

            upsert: true,

            setDefaultsOnInsert: true,

            runValidators: true
          }
        );


      // -------------------------------------------------
      // SOCKET
      // -------------------------------------------------

      const io =
        req.app.get('io');


      const payload = {

        parentId:
          parent.parentId,

        driverId:
          parent.driverId,

        studentName:
          parent.studentName,

        status,

        attendanceStatus:
          status,

        date:
          attendanceDate,

        dateString:
          formatAttendanceDate(
            attendanceDate
          ),

        timestamp:
          Date.now()
      };


      if (io) {

        // Parent room
        io.to(
          parent.parentId
        ).emit(
          'tomorrowAttendanceUpdated',
          payload
        );


        // Attendance-specific parent room
        io.to(
          `parent_attendance_${parent.parentId}`
        ).emit(
          'attendanceUpdated',
          {
            ...payload,

            year:
              attendanceDate.getFullYear(),

            month:
              attendanceDate.getMonth() + 1
          }
        );


        // Driver room
        emitDriverChannel(
          io,

          parent.driverId,

          'tomorrowAttendanceUpdated',

          payload
        );


        // Dashboard refresh
        io.to(
          parent.parentId
        ).emit(
          'dashboardUpdated',
          {
            type:
              'tomorrow_attendance_updated',

            parentId:
              parent.parentId,

            tomorrowAttendanceStatus:
              status,

            timestamp:
              Date.now()
          }
        );
      }


      // -------------------------------------------------
      // RESPONSE
      // -------------------------------------------------

      return res.status(200).json({

        success: true,

        message:
          'Tomorrow attendance updated successfully',

        data: {

          parentId:
            parent.parentId,

          status,

          date:
            attendanceDate,

          dateString:
            formatAttendanceDate(
              attendanceDate
            )
        }

      });

    }

    catch (error) {

      console.error(
        'UPDATE TOMORROW ATTENDANCE ERROR:',
        error
      );


      // Duplicate key protection
      if (
        error?.code === 11000
      ) {

        return res.status(409).json({

          success: false,

          message:
            'Attendance record already exists'

        });
      }


      return res.status(500).json({

        success: false,

        message:
          error.message ||
          'Failed to update tomorrow attendance'

      });

    }

  };


/**
 * =====================================================
 * STUDENT STATUS
 * =====================================================
 */

const updateStudentStatus =
  async (
    req,
    res
  ) => {

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


      const result =
        await parentService
          .updateStudentStatus(
            parentId,
            rideType,
            status
          );


      const parent =
        result.parent;


      const eventTime =
        result.eventTime;


      const journeyTimes = {

        morningPickedUpAt:
          parent.morningPickedUpAt ||
          null,

        morningDroppedAtSchoolAt:
          parent.morningDroppedAtSchoolAt ||
          null,

        eveningPickedFromSchoolAt:
          parent.eveningPickedFromSchoolAt ||
          null,

        eveningDroppedAtHomeAt:
          parent.eveningDroppedAtHomeAt ||
          null

      };


      const finalStatus =
        rideType === 'morning'
          ? parent.morningStatus
          : parent.eveningStatus;


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

        status,

        finalStatus,

        eventTime,

        timestamp:
          eventTime,

        journeyTimes

      };


      if (io) {

        io.to(
          parent.parentId
        ).emit(

          'studentStatusUpdated',

          socketPayload

        );


        emitDriverChannel(

          io,

          parent.driverId,

          'studentStatusUpdated',

          socketPayload

        );


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
        'UPDATE STUDENT STATUS ERROR:',
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


/**
 * =====================================================
 * FCM TOKEN
 * =====================================================
 */

const updateFcmToken = async (
  req,
  res
) => {

  try {

    const {
      parentId,
      fcmToken
    } = req.body;


    if (!parentId || !fcmToken) {

      return res.status(400).json({

        success: false,

        message:
          'parentId and fcmToken are required'

      });

    }


    const parent =
      await Parent.findOneAndUpdate(

        {
          parentId
        },

        {
          fcmToken
        },

        {
          new: true
        }

      );


    if (!parent) {

      return res.status(404).json({

        success: false,

        message:
          'Parent not found'

      });

    }


    return res.status(200).json({

      success: true,

      message:
        'FCM token updated successfully'

    });

  }

  catch (error) {

    console.error(
      'UPDATE FCM TOKEN ERROR:',
      error
    );


    return res.status(500).json({

      success: false,

      message:
        error.message

    });

  }

};


/**
 * =====================================================
 * SAVE MONTHLY ATTENDANCE
 * =====================================================
 *
 * PUT /api/parents/attendance
 *
 * Supported body:
 *
 * {
 *   parentId: "PAR123",
 *   records: [
 *     {
 *       date: "2026-09-01",
 *       status: "present"
 *     },
 *     {
 *       date: "2026-09-02",
 *       status: "absent"
 *     }
 *   ]
 * }
 *
 * Also supports:
 *
 * {
 *   parentId: "PAR123",
 *   date: "2026-09-25",
 *   status: "present"
 * }
 */

const saveMonthlyAttendance =
  async (
    req,
    res
  ) => {

    try {

      const {
        parentId,
        date,
        status,
        records = []
      } = req.body;


      // -------------------------------------------------
      // VALIDATION
      // -------------------------------------------------

      if (!parentId) {

        return res.status(400).json({

          success: false,

          message:
            'parentId is required'

        });
      }


      // -------------------------------------------------
      // SUPPORT SINGLE RECORD
      // -------------------------------------------------

      let attendanceRecords =
        Array.isArray(records)
          ? [...records]
          : [];


      if (
        date &&
        status
      ) {

        attendanceRecords.push({

          date,

          status

        });
      }


      // -------------------------------------------------
      // VALIDATE RECORDS
      // -------------------------------------------------

      if (
        attendanceRecords.length === 0
      ) {

        return res.status(400).json({

          success: false,

          message:
            'At least one attendance record is required'

        });
      }


      // -------------------------------------------------
      // FIND PARENT
      // -------------------------------------------------

      const parent =
        await findParentByIdentifier(
          parentId
        );


      if (!parent) {

        return res.status(404).json({

          success: false,

          message:
            'Parent not found'

        });
      }


      // -------------------------------------------------
      // NORMALIZE + VALIDATE
      // -------------------------------------------------

      const normalizedRecords =
        attendanceRecords.map(
          (record) => {

            const recordDate =
              normalizeAttendanceDate(
                record.date
              );


            if (!recordDate) {

              throw new Error(
                `Invalid attendance date: ${record.date}`
              );
            }


            if (
              !['present', 'absent']
                .includes(record.status)
            ) {

              throw new Error(
                `Invalid attendance status for ${record.date}`
              );
            }


            return {

              parentId:
                parent.parentId,

              date:
                recordDate,

              status:
                record.status

            };

          }
        );


      // -------------------------------------------------
      // REMOVE DUPLICATES
      // -------------------------------------------------
      //
      // Prevent the same date from being processed
      // multiple times in one request.
      //

      const uniqueRecords =
        new Map();


      normalizedRecords.forEach(
        (record) => {

          uniqueRecords.set(
            formatAttendanceDate(
              record.date
            ),
            record
          );

        }
      );


      const finalRecords =
        Array.from(
          uniqueRecords.values()
        );


      // -------------------------------------------------
      // UPSERT ALL RECORDS
      // -------------------------------------------------

      const bulkOperations =
        finalRecords.map(
          (record) => ({

            updateOne: {

              filter: {

                parentId:
                  record.parentId,

                date:
                  record.date

              },

              update: {

                $set: {

                  status:
                    record.status,

                  date:
                    record.date,

                  parentId:
                    record.parentId

                }

              },

              upsert: true

            }

          })
        );


      await Attendance.bulkWrite(
        bulkOperations,
        {
          ordered: true
        }
      );


      // -------------------------------------------------
      // UPDATE TODAY'S PARENT ATTENDANCE
      // -------------------------------------------------

      const today =
        normalizeAttendanceDate(
          new Date()
        );


      const todayRecord =
        finalRecords.find(
          (record) =>
            record.date.getTime() ===
            today.getTime()
        );


      if (todayRecord) {

        parent.attendance =
          todayRecord.status ===
          'present';

        await parent.save();

      }


      // -------------------------------------------------
      // SOCKET
      // -------------------------------------------------

      const io =
        req.app.get('io');


      if (io) {

        for (
          const record
          of finalRecords
        ) {

          const attendanceData = {

            parentId:
              parent.parentId,

            driverId:
              parent.driverId,

            studentName:
              parent.studentName,

            date:
              record.date,

            dateString:
              formatAttendanceDate(
                record.date
              ),

            status:
              record.status,

            year:
              record.date.getFullYear(),

            month:
              record.date.getMonth() + 1,

            timestamp:
              Date.now()

          };


          // Parent main room
          io.to(
            parent.parentId
          ).emit(
            'attendanceUpdated',
            attendanceData
          );


          // Parent attendance room
          io.to(
            `parent_attendance_${parent.parentId}`
          ).emit(
            'attendanceUpdated',
            attendanceData
          );


          // Driver channel
          emitDriverChannel(
            io,

            parent.driverId,

            'attendanceUpdated',

            attendanceData
          );

        }


        // One dashboard refresh event
        emitDriverChannel(
          io,

          parent.driverId,

          'dashboardUpdated',

          {

            type:
              'attendance_updated',

            parentId:
              parent.parentId,

            timestamp:
              Date.now()

          }
        );

      }


      // -------------------------------------------------
      // RETURN FRESH RECORDS
      // -------------------------------------------------

      const savedRecords =
        await Attendance.find({

          parentId:
            parent.parentId,

          date: {

            $in:
              finalRecords.map(
                record =>
                  record.date
              )

          }

        })
        .sort({
          date: 1
        });


      // -------------------------------------------------
      // RESPONSE
      // -------------------------------------------------

      return res.status(200).json({

        success: true,

        message:
          'Attendance saved successfully',

        data: {

          parentId:
            parent.parentId,

          records:
            savedRecords

        }

      });

    }

    catch (error) {

      console.error(
        'SAVE MONTHLY ATTENDANCE ERROR:',
        error
      );


      if (
        error.message &&
        error.message.startsWith(
          'Invalid attendance'
        )
      ) {

        return res.status(400).json({

          success: false,

          message:
            error.message

        });

      }


      if (
        error?.code === 11000
      ) {

        return res.status(409).json({

          success: false,

          message:
            'Duplicate attendance record detected'

        });

      }


      return res.status(500).json({

        success: false,

        message:
          error.message ||
          'Failed to save attendance'

      });

    }

  };


/**
 * =====================================================
 * GET MONTHLY ATTENDANCE
 * =====================================================
 *
 * GET
 * /api/parents/attendance/:parentId
 *
 * Query:
 *
 * ?year=2026&month=9
 */

const getMonthlyAttendance =
  async (
    req,
    res
  ) => {

    try {

      const {
        parentId
      } = req.params;


      const {
        year,
        month
      } = req.query;


      // -------------------------------------------------
      // VALIDATION
      // -------------------------------------------------

      if (!parentId) {

        return res.status(400).json({

          success: false,

          message:
            'parentId is required'

        });
      }


      if (
        !year ||
        !month
      ) {

        return res.status(400).json({

          success: false,

          message:
            'year and month are required'

        });
      }


      const numericYear =
        Number(year);

      const numericMonth =
        Number(month);


      if (
        !Number.isInteger(
          numericYear
        ) ||
        !Number.isInteger(
          numericMonth
        ) ||
        numericMonth < 1 ||
        numericMonth > 12
      ) {

        return res.status(400).json({

          success: false,

          message:
            'Invalid year or month'

        });
      }


      // -------------------------------------------------
      // FIND PARENT
      // -------------------------------------------------

      const parent =
        await findParentByIdentifier(
          parentId
        );


      if (!parent) {

        return res.status(404).json({

          success: false,

          message:
            'Parent not found',

          receivedParentId:
            parentId

        });
      }


      // -------------------------------------------------
      // DATE RANGE
      // -------------------------------------------------

      const startDate =
        new Date(
          numericYear,
          numericMonth - 1,
          1,
          0,
          0,
          0,
          0
        );


      const endDate =
        new Date(
          numericYear,
          numericMonth,
          1,
          0,
          0,
          0,
          0
        );


      // -------------------------------------------------
      // FETCH
      // -------------------------------------------------

      const records =
        await Attendance.find({

          parentId:
            parent.parentId,

          date: {

            $gte:
              startDate,

            $lt:
              endDate

          }

        })
        .sort({
          date: 1
        })
        .lean();


      // -------------------------------------------------
      // RESPONSE
      // -------------------------------------------------

      return res.status(200).json({

        success: true,

        data: {

          parentId:
            parent.parentId,

          year:
            numericYear,

          month:
            numericMonth,

          records

        }

      });

    }

    catch (error) {

      console.error(
        'GET MONTHLY ATTENDANCE ERROR:',
        error
      );


      return res.status(500).json({

        success: false,

        message:
          error.message ||
          'Failed to get monthly attendance'

      });

    }

  };

/**
 * =====================================================
 * EXPORTS
 * =====================================================
 */

module.exports = {

  addParent,

  getAllParents,

  getParent,

  updateParent,

  deleteParent,

  getDashboard,

  updateAttendance,

  updateTomorrowAttendance,

  updateStudentStatus,

  updateFcmToken,

  saveMonthlyAttendance,

  getMonthlyAttendance

};