const driverService = require('../services/driver.service');
const mongoose = require('mongoose');
const Driver = require('../models/driver.model');
const Parent = require('../models/parent.model');

// ============================================================
// FIND DRIVER
// GET /api/drivers/find?driverId=DRV000001
// GET /api/drivers/find?mobile=9876543210
// ============================================================


async function getAuthenticatedDriver(req) {
  // Adapt this to the verified identity supplied by your auth middleware.
  const driverId = req.user?.driverId;

  if (!driverId) {
    const error = new Error('Authenticated driver identity is missing');
    error.statusCode = 401;
    throw error;
  }

  const driver = await Driver.findOne({ driverId });

  if (!driver) {
    const error = new Error('Driver not found');
    error.statusCode = 404;
    throw error;
  }

  return driver;
}

function validatePendingDetails(body = {}) {
  const parentName = String(body.parentName || '').trim();
  const parentMobile = String(body.parentMobile || '').replace(/\D/g, '');

  if (parentName.length < 2 || parentName.length > 100) {
    return 'Enter a valid parent name';
  }

  if (!/^[6-9]\d{9}$/.test(parentMobile)) {
    return 'Enter a valid 10-digit parent mobile number';
  }

  return null;
}

// GET /api/drivers/me/pending-students
exports.getPendingStudents = async (req, res) => {
  try {
    const driver = await getAuthenticatedDriver(req);

    const pendingStudents = driver.pendingStudents
      .filter(item => item.status === 'pending')
      .map(item => ({
        _id: item._id,
        parentName: item.parentName,
        parentMobile: item.parentMobile,
        studentName: item.studentName,
        studentClass: item.studentClass,
        studentSection: item.studentSection,
        schoolName: item.schoolName,
        pickupAddress: item.pickupAddress,
        schoolAddress: item.schoolAddress,
        updatedAt: item.updatedAt
      }));

    return res.json({
      success: true,
      count: pendingStudents.length,
      data: pendingStudents
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Unable to load pending students'
    });
  }
};

// PUT /api/drivers/me/pending-students/:contactId
exports.updatePendingStudent = async (req, res) => {
  try {
    const driver = await getAuthenticatedDriver(req);
    const { contactId } = req.params;

    if (!mongoose.isValidObjectId(contactId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pending student ID'
      });
    }

    const entry = driver.pendingStudents.id(contactId);

    if (!entry || entry.status !== 'pending') {
      return res.status(404).json({
        success: false,
        message: 'Pending student not found'
      });
    }

    const validationError = validatePendingDetails(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    // Explicit allowlist: never spread req.body into the model.
    const allowedFields = [
      'parentName',
      'parentMobile',
      'studentName',
      'studentClass',
      'studentSection',
      'schoolName',
      'pickupAddress',
      'schoolAddress'
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        entry[field] = String(req.body[field]).trim();
      }
    }

    entry.parentMobile = String(entry.parentMobile).replace(/\D/g, '');

    await driver.save();

    return res.json({
      success: true,
      message: 'Pending student updated',
      data: entry
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Unable to update pending student'
    });
  }
};

// POST /api/drivers/me/pending-students/:contactId/complete
exports.completePendingStudent = async (req, res) => {
  try {
    const driver = await getAuthenticatedDriver(req);
    const { contactId } = req.params;

    if (!mongoose.isValidObjectId(contactId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid pending student ID'
      });
    }

    const entry = driver.pendingStudents.id(contactId);

    if (!entry || entry.status !== 'pending') {
      return res.status(404).json({
        success: false,
        message: 'Pending student not found'
      });
    }

    // Combine saved details with the latest form submission.
    const data = {
      parentName: req.body.parentName ?? entry.parentName,
      parentMobile: req.body.parentMobile ?? entry.parentMobile,
      studentName: req.body.studentName ?? entry.studentName,
      studentClass: req.body.studentClass ?? entry.studentClass,
      studentSection: req.body.studentSection ?? entry.studentSection,
      schoolName: req.body.schoolName ?? entry.schoolName,
      pickupAddress: req.body.pickupAddress ?? entry.pickupAddress,
      schoolAddress: req.body.schoolAddress ?? entry.schoolAddress,
      pickupLocation: req.body.pickupLocation,
      schoolLocation: req.body.schoolLocation
    };

    const validationError = validatePendingDetails(data);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError
      });
    }

    const requiredText = [
      ['studentName', 'Student name'],
      ['studentClass', 'Student class'],
      ['studentSection', 'Student section'],
      ['schoolName', 'School name'],
      ['pickupAddress', 'Pickup address'],
      ['schoolAddress', 'School address']
    ];

    for (const [field, label] of requiredText) {
      if (!String(data[field] || '').trim()) {
        return res.status(400).json({
          success: false,
          message: `${label} is required`
        });
      }
    }

    function validLocation(location) {
      return location &&
        Number.isFinite(Number(location.latitude)) &&
        Number.isFinite(Number(location.longitude)) &&
        Number(location.latitude) >= -90 &&
        Number(location.latitude) <= 90 &&
        Number(location.longitude) >= -180 &&
        Number(location.longitude) <= 180;
    }

    if (
      !validLocation(data.pickupLocation) ||
      !validLocation(data.schoolLocation)
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid pickup and school map coordinates are required'
      });
    }

    const mobileNumber = String(data.parentMobile).replace(/\D/g, '');

    const existingParent = await Parent.findOne({ mobileNumber });

    if (existingParent) {
      return res.status(409).json({
        success: false,
        message: 'A parent account already exists with this mobile number'
      });
    }

    const parent = await Parent.create({
      parentId: `PAR${Date.now()}`,
      driverId: driver.driverId,
      name: String(data.parentName).trim(),
      mobileNumber,
      studentName: String(data.studentName).trim(),
      studentClass: String(data.studentClass).trim(),
      studentSection: String(data.studentSection).trim(),
      schoolName: String(data.schoolName).trim(),
      pickupArea: String(data.pickupAddress).trim(),
      pickupAddress: String(data.pickupAddress).trim(),
      pickupLocation: {
        latitude: Number(data.pickupLocation.latitude),
        longitude: Number(data.pickupLocation.longitude)
      },
      dropArea: String(data.schoolAddress).trim(),
      schoolAddress: String(data.schoolAddress).trim(),
      schoolLocation: {
        latitude: Number(data.schoolLocation.latitude),
        longitude: Number(data.schoolLocation.longitude)
      }
    });

    entry.status = 'completed';
    entry.parentId = parent._id;
    await driver.save();

    return res.status(201).json({
      success: true,
      message: 'Student and parent registration completed',
      data: {
        parentId: parent.parentId,
        studentName: parent.studentName
      }
    });
  } catch (error) {
    // Duplicate mobile number / other unique index conflicts.
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'A record already exists with this unique value'
      });
    }

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Unable to complete registration'
    });
  }
};

const findDriver = async (req, res) => {
    try {

        const {
            driverId,
            mobile
        } = req.query;

        // ----------------------------------------------------
        // Validation
        // ----------------------------------------------------

        if (!driverId && !mobile) {

            return res.status(400).json({

                success: false,

                message:
                    'Driver ID or mobile number is required'

            });

        }

        // ----------------------------------------------------
        // Build search conditions
        // ----------------------------------------------------

        const conditions = [];

        // Search by Driver ID
        if (driverId) {

            conditions.push({

                driverId: driverId.trim()

            });

        }

        // Search by mobile number
        if (mobile) {

            const normalizedMobile =
                mobile
                    .replace(/\s+/g, '')
                    .replace(/^\+91/, '');

            conditions.push({

                mobileNumber:
                    normalizedMobile

            });

        }

        // ----------------------------------------------------
        // Find Driver
        // ----------------------------------------------------

        const driver = await Driver.findOne({

            $or: conditions

        }).select('-password');

        // ----------------------------------------------------
        // Driver not found
        // ----------------------------------------------------

        if (!driver) {

            return res.status(404).json({

                success: false,

                message:
                    'Driver not found'

            });

        }

        // ----------------------------------------------------
        // Success
        // ----------------------------------------------------

        return res.status(200).json({

            success: true,

            message:
                'Driver found successfully',

            data: driver

        });

    }

    catch (error) {

        console.error(
            'Find Driver Error:',
            error
        );

        return res.status(500).json({

            success: false,

            message:
                'Unable to find driver',

            error:
                error.message

        });

    }
};


// ============================================================
// REGISTER DRIVER
// ============================================================

const registerDriver = async (req, res) => {

    try {

        const response =
            await driverService.registerDriver(
                req.body
            );

        return res.status(200).json(response);

    }

    catch (error) {

        console.error(
            'Register Driver Error:',
            error
        );

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

};


// ============================================================
// GET ALL DRIVERS
// ============================================================

const getAllDrivers = async (req, res) => {

    try {

        const drivers =
            await driverService.getAllDrivers();

        return res.status(200).json({

            success: true,

            count: drivers.length,

            data: drivers

        });

    }

    catch (error) {

        console.error(
            'Get All Drivers Error:',
            error
        );

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

};


// ============================================================
// ADD DRIVER
// ============================================================

const addDriver = async (req, res) => {

    try {

        const driver =
            await driverService.addDriver(
                req.body
            );

        return res.status(201).json({

            success: true,

            message:
                'Driver added successfully',

            data: driver

        });

    }

    catch (error) {

        console.error(
            'Add Driver Error:',
            error
        );

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

};


// ============================================================
// DRIVER DASHBOARD
// GET /api/drivers/dashboard/:driverId
// ============================================================

const getDashboard = async (req, res) => {

    try {

        const { driverId } = req.params;

        const response =
            await driverService.getDashboard(
                driverId
            );

        return res.status(200).json(response);

    }

    catch (error) {

        console.error(
            'Get Driver Dashboard Error:',
            error
        );

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

};


// ============================================================
// GET DRIVER BY MONGODB ID
// GET /api/drivers/:id
// ============================================================

const getDriver = async (req, res) => {

    try {

        const driver =
            await driverService.getDriver(
                req.params.id
            );

        return res.status(200).json({

            success: true,

            data: driver

        });

    }

    catch (error) {

        console.error(
            'Get Driver Error:',
            error
        );

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

};


// ============================================================
// UPDATE DRIVER
// PUT /api/drivers/:id
// ============================================================

const updateDriver = async (req, res) => {

    try {

        const driver =
            await driverService.updateDriver(
                req.params.id,
                req.body
            );

        return res.status(200).json({

            success: true,

            message:
                'Driver updated successfully',

            data: driver

        });

    }

    catch (error) {

        console.error(
            'Update Driver Error:',
            error
        );

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

};


// ============================================================
// DELETE DRIVER
// DELETE /api/drivers/:id
// ============================================================

const deleteDriver = async (req, res) => {

    try {

        await driverService.deleteDriver(
            req.params.id
        );

        return res.status(200).json({

            success: true,

            message:
                'Driver deleted successfully'

        });

    }

    catch (error) {

        console.error(
            'Delete Driver Error:',
            error
        );

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

};


// ============================================================
// GET REFERRAL DETAILS
// GET /api/drivers/referral/:driverId
// ============================================================

const getReferralDetails = async (req, res) => {

    try {

        const data =
            await driverService.getReferralDetails(
                req.params.driverId
            );

        return res.status(200).json({

            success: true,

            data

        });

    }

    catch (error) {

        console.error(
            'Get Referral Details Error:',
            error
        );

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

};


// ============================================================
// GET REFERRED DRIVERS
// GET /api/drivers/referrals/:driverId
// ============================================================

const getReferredDrivers = async (req, res) => {

    try {

        const data =
            await driverService.getReferredDrivers(
                req.params.driverId
            );

        return res.status(200).json({

            success: true,

            count: data.length,

            data

        });

    }

    catch (error) {

        console.error(
            'Get Referred Drivers Error:',
            error
        );

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

};


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    findDriver,

    registerDriver,

    getAllDrivers,

    addDriver,

    getDashboard,

    getDriver,

    updateDriver,

    deleteDriver,

    getReferralDetails,

    getReferredDrivers

};