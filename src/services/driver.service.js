const Driver = require('../models/driver.model');

const registerDriver = async (data) => {

  const existingDriver = await Driver.findOne({
    mobileNumber: data.mobileNumber
  });

  if (existingDriver) {

    return {
      success: false,

      message: 'Driver already registered',

      data: existingDriver
    };
  }

  const count = await Driver.countDocuments();

  const driverId = `DRV${String(count + 1).padStart(6, '0')}`;

  const driver = await Driver.create({

    ...data,

    driverId
  });

  return {

    success: true,

    message: 'Driver registered successfully',

    data: driver
  };
};


const getAllDrivers = async () => {

  const drivers = await Driver.find(
    {},
    {
      _id: 0,
      driverId: 1,
      name: 1,
      mobileNumber: 1,
      vehicleNumber: 1,
      routeArea: 1,
      isVerified: 1
    }
  );

  return drivers;
};

module.exports = {
  registerDriver,
  getAllDrivers
};