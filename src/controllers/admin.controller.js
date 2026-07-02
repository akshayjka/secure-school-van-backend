const Driver = require('../models/driver.model');

const Parent = require('../models/parent.model');

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


// Drivers

exports.getDrivers = async (req, res) => {

    const drivers = await Driver.find();

    res.json({

        success: true,

        data: drivers

    });

};

exports.getDriver = async (req, res) => {

    const driver = await Driver.findById(req.params.id);

    res.json({

        success: true,

        data: driver

    });

};


exports.updateDriver = async (req, res) => {

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

};



exports.deleteDriver = async (req, res) => {

    await Driver.findByIdAndDelete(

        req.params.id

    );

    res.json({

        success: true,

        message: 'Driver Deleted'

    });

};


// Parents

exports.getParents = async (req, res) => {

  const parents = await Parent.find();

  res.json(parents);

};


exports.updateParent = async (req, res) => {

  const parent = await Parent.findByIdAndUpdate(

    req.params.id,

    req.body,

    { new: true }

  );

  res.json(parent);

};


exports.deleteParent = async (req, res) => {

  await Parent.findByIdAndDelete(

    req.params.id

  );

  res.json({

    success: true

  });

};