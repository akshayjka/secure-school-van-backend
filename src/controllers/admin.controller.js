const Driver = require('../models/driver.model');
const Parent = require('../models/parent.model');

/**
 * =====================================================
 * DASHBOARD
 * =====================================================
 */

exports.dashboard = async (req, res) => {

  try {

    const totalDrivers = await Driver.countDocuments();
    const totalParents = await Parent.countDocuments();

    res.json({

      success: true,

      totalDrivers,

      totalParents

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
 * DRIVERS
 * =====================================================
 */

exports.getDrivers = async (req, res) => {

  try {

    const drivers = await Driver.find();

    res.json({

      success: true,

      data: drivers

    });

  }

  catch (error) {

    res.status(500).json({

      success: false,

      message: error.message

    });

  }

};

exports.getDriver = async (req, res) => {

  try {

    const driver = await Driver.findById(req.params.id);

    res.json({

      success: true,

      data: driver

    });

  }

  catch (error) {

    res.status(500).json({

      success: false,

      message: error.message

    });

  }

};

exports.updateDriver = async (req, res) => {

  try {

    const driver = await Driver.findByIdAndUpdate(

      req.params.id,

      req.body,

      {

        new: true

      }

    );

    res.json({

      success: true,

      data: driver

    });

  }

  catch (error) {

    res.status(500).json({

      success: false,

      message: error.message

    });

  }

};

exports.deleteDriver = async (req, res) => {

  try {

    await Driver.findByIdAndDelete(req.params.id);

    res.json({

      success: true,

      message: 'Driver Deleted'

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
 * PARENTS
 * =====================================================
 */

exports.getParents = async (req, res) => {

  try {

    const parents = await Parent.find();

    res.json({

      success: true,

      data: parents

    });

  }

  catch (error) {

    res.status(500).json({

      success: false,

      message: error.message

    });

  }

};

exports.updateParent = async (req, res) => {

  try {

    const parent = await Parent.findByIdAndUpdate(

      req.params.id,

      req.body,

      {

        new: true

      }

    );

    /**
     * Notify this parent dashboard
     */

    if (parent) {

      const io = req.app.get('io');

      io.to(parent.parentId).emit(

        'dashboardUpdated',

        {

          type: 'driver_assignment_updated',

          parentId: parent.parentId,

          driverId: parent.driverId

        }

      );

    }

    res.json({

      success: true,

      message: 'Parent updated successfully',

      data: parent

    });

  }

  catch (error) {

    res.status(500).json({

      success: false,

      message: error.message

    });

  }

};

exports.deleteParent = async (req, res) => {

  try {

    await Parent.findByIdAndDelete(req.params.id);

    res.json({

      success: true,

      message: 'Parent Deleted'

    });

  }

  catch (error) {

    res.status(500).json({

      success: false,

      message: error.message

    });

  }

};