const driverService = require(

    '../services/driver.service'

);


// ================= REGISTER =================

const registerDriver = async (

    req,

    res

) => {

    try {

        const response = await

            driverService.registerDriver(

                req.body

            );

        return res.status(200)

            .json(response);

    }

    catch (error) {

        return res.status(500)

            .json({

                success: false,

                message: error.message

            });

    }

};


// ================= GET ALL =================

const getAllDrivers = async (

    req,

    res

) => {

    try {

        const drivers = await

            driverService.getAllDrivers();

        return res.status(200)

            .json({

                success: true,

                count: drivers.length,

                data: drivers

            });

    }

    catch (error) {

        return res.status(500)

            .json({

                success: false,

                message: error.message

            });

    }

};


// ================= ADD DRIVER =================

const addDriver = async (

    req,

    res

) => {

    try {

        const driver = await

            driverService.addDriver(

                req.body

            );

        return res.status(201)

            .json({

                success: true,

                message:

                    'Driver added successfully',

                data: driver

            });

    }

    catch (error) {

        return res.status(500)

            .json({

                success: false,

                message: error.message

            });

    }

};


// =======================Get Dashboard ===================

const getDashboard = async (req, res) => {
    try {
        const { driverId } = req.params;

        const response = await

            driverService.getDashboard(

                driverId

            );

        return res.status(200).json(response);
    }

    catch (error) {
        return res.status(500)

            .json({

                success: false,

                message: error.message

            });

    }

};

const getDriver = async (req, res) => {

    try {

        const driver = await driverService.getDriver(req.params.id);

        return res.status(200).json({

            success: true,

            data: driver

        });

    } catch (error) {

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

};

const updateDriver = async (req, res) => {

    try {

        const driver = await driverService.updateDriver(
            req.params.id,
            req.body
        );

        return res.status(200).json({

            success: true,

            message: 'Driver updated successfully',

            data: driver

        });

    } catch (error) {

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

};

const deleteDriver = async (req, res) => {

    try {

        await driverService.deleteDriver(req.params.id);

        return res.status(200).json({

            success: true,

            message: 'Driver deleted successfully'

        });

    } catch (error) {

        return res.status(500).json({

            success: false,

            message: error.message

        });

    }

};

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

    return res.status(500).json({

      success: false,

      message: error.message

    });

  }

};

const getReferredDrivers = async (req, res) => {

    try {

        const data = await driverService.getReferredDrivers(req.params.driverId);

        return res.status(200).json({ success: true, count: data.length, data });
    }

    catch (error) {

        return res.status(500).json({ success: false, message: error.message });
    }
};

module.exports = {
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