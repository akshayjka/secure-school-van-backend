const driverService = require('../services/driver.service');
const Driver = require('../models/driver.model');

// ============================================================
// FIND DRIVER
// GET /api/drivers/find?driverId=DRV000001
// GET /api/drivers/find?mobile=9876543210
// ============================================================

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