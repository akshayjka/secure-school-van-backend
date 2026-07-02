const Driver = require('../models/driver.model');

const Parent = require('../models/parent.model');

// ================= REGISTER DRIVER =================

const registerDriver = async (data) => {

  const existingDriver = await Driver.findOne({
    mobileNumber: data.mobileNumber
  });

  if (existingDriver) {
    return {
      success: false,
      message: 'Driver already registered'
    };
  }

  const count = await Driver.countDocuments();

  const driverId =
    `DRV${String(count + 1).padStart(6, '0')}`;

  const referralCode =
    `DRV${1000 + count + 1}`;

  let referredByDriver = null;

  if (data.referredByCode) {

    referredByDriver = await Driver.findOne({
      referralCode: data.referredByCode
    });

    if (!referredByDriver) {

      return {
        success: false,
        message: 'Invalid referral code'
      };
    }
  }

  const driver = await Driver.create({

    ...data,

    driverId,

    referralCode,

    referredByCode:
      referredByDriver?.referralCode || null,

    referredByDriverId:
      referredByDriver?._id || null

  });

  if (referredByDriver) {

    await Driver.findByIdAndUpdate(
      referredByDriver._id,
      {
        $inc: {
          referralCount: 1
        }
      }
    );
  }

  return {
    success: true,
    message: 'Driver registered successfully',
    data: driver
  };
};

// ======= Get Referal Details =======================

const getReferralDetails = async (driverId) => {

  const driver = await Driver.findOne(
    { driverId },
    {
      driverId: 1,
      name: 1,
      referralCode: 1,
      referralCount: 1,
      referredByCode: 1
    }
  );

  if (!driver) {
    throw new Error('Driver not found');
  }

  return driver;
};

// ========== Get Referred Drivers ==================
const getReferredDrivers = async (driverId) => {

  const driver = await Driver.findOne({
    driverId
  });

  if (!driver) {
    throw new Error('Driver not found');
  }

  const referrals = await Driver.find(
    {
      referredByCode: driver.referralCode
    },
    {
      driverId: 1,
      name: 1,
      mobileNumber: 1,
      vehicleNumber: 1,
      createdAt: 1
    }
  );

  return referrals;
};


// ================= GET ALL DRIVERS =================

const getAllDrivers = async () => {

  return await Driver.find(
    {},
    {
      _id: 1,
      driverId: 1,
      role: 1,
      name: 1,
      mobileNumber: 1,
      vehicleNumber: 1,
      routeArea: 1,
      isVerified: 1
    }
  );
};
// ================= ADD DRIVER =================

const addDriver = async (data) => {

  const existingDriver = await Driver.findOne({

    mobileNumber: data.mobileNumber

  });

  if (existingDriver) {

    throw new Error(

      'Driver already exists'

    );

  }

  const count = await Driver.countDocuments();

  const driverId = `DRV${String(

    count + 1

  ).padStart(6, '0')}`;

  const driver = await Driver.create({

    ...data,

    driverId,

    role: 'driver',

    password: null

  });

  return driver;

};

// ===================Get DashBoard =====================
const getDashboard = async (driverId) => {

  const driver = await Driver.findOne({

    driverId

  });

  if (!driver) {

    throw new Error(

      'Driver not found'

    );

  }

  const students = await Parent.find(

    {

      driverId

    },

    {

      _id: 0,

      parentId: 1,

      name: 1,

      mobileNumber: 1,

      studentName: 1,

      schoolName: 1,

      pickupArea: 1,

      dropArea: 1,

      attendance: 1

    }

  );

  const present = students.filter(

    student => student.attendance

  ).length;

  const absent = students.filter(

    student => !student.attendance

  ).length;

  return {

    success: true,

    driver: {

      driverId: driver.driverId,

      name: driver.name,

      vehicleNumber: driver.vehicleNumber,

      routeArea: driver.routeArea

    },

    students,

    todayStats: {

      present,

      absent,

      total: students.length

    }

  };

};

// ================= GET DRIVER =================

const getDriver = async (id) => {
  return await Driver.findById(id);
};

// ================= UPDATE DRIVER =================

const updateDriver = async (id, data) => {

  return await Driver.findByIdAndUpdate(
    id,
    data,
    { new: true }
  );

};

// ================= DELETE DRIVER =================

const deleteDriver = async (id) => {

  return await Driver.findByIdAndDelete(id);

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