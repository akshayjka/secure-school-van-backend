const Driver = require('../models/driver.model');
const Parent = require('../models/parent.model');

// =====================================================
// DRIVER ID
// =====================================================

const createDriverId = async () => {
  const count = await Driver.countDocuments();
  let sequence = count + 1;

  while (true) {
    const driverId =
      `DRV${String(sequence).padStart(6, '0')}`;

    const exists =
      await Driver.exists({ driverId });

    if (!exists) {
      return driverId;
    }

    sequence += 1;
  }
};

// =====================================================
// REGISTER DRIVER
// =====================================================

const registerDriver = async (data) => {
  const mobileNumber =
    String(data?.mobileNumber || '')
      .replace(/\D/g, '');

  const existingDriver =
    await Driver.findOne({ mobileNumber });

  if (existingDriver) {
    return {
      success: false,
      message: 'Driver already registered'
    };
  }

  const driverId =
    await createDriverId();

  const count =
    await Driver.countDocuments();

  const referralCode =
    `DRV${1000 + count + 1}`;

  let referredByDriver = null;

  if (data.referredByCode) {
    referredByDriver =
      await Driver.findOne({
        referralCode:
          data.referredByCode
      });

    if (!referredByDriver) {
      return {
        success: false,
        message: 'Invalid referral code'
      };
    }
  }

  const driver =
    await Driver.create({
      ...data,

      mobileNumber,

      driverId,

      referralCode,

      registrationSource:
        'driver',

      referredByCode:
        referredByDriver?.referralCode ||
        null,

      referredByDriverId:
        referredByDriver?._id ||
        null
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
    message:
      'Driver registered successfully',
    data: driver
  };
};

// =====================================================
// FIND DRIVER
// =====================================================

const findDriver = async ({
  driverId,
  mobile
} = {}) => {
  const normalizedMobile =
    String(mobile || '')
      .replace(/\D/g, '');

  const normalizedDriverId =
    String(driverId || '')
      .trim();

  const conditions = [];

  if (normalizedDriverId) {
    conditions.push({
      driverId:
        normalizedDriverId
    });
  }

  if (normalizedMobile) {
    conditions.push({
      mobileNumber:
        normalizedMobile
    });
  }

  if (conditions.length === 0) {
    throw new Error(
      'Driver ID or mobile number is required'
    );
  }

  const driver =
    await Driver.findOne({
      $or: conditions
    }).select(
      '+password'
    );

  if (!driver) {
    throw new Error(
      'Driver not found'
    );
  }

  return driver;
};

// =====================================================
// REFERRAL DETAILS
// =====================================================

const getReferralDetails = async (driverId) => {
  const driver =
    await Driver.findOne(
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
    throw new Error(
      'Driver not found'
    );
  }

  return driver;
};

// =====================================================
// REFERRED DRIVERS
// =====================================================

const getReferredDrivers = async (driverId) => {
  const driver =
    await Driver.findOne({
      driverId
    });

  if (!driver) {
    throw new Error(
      'Driver not found'
    );
  }

  return Driver.find(
    {
      referredByCode:
        driver.referralCode
    },
    {
      driverId: 1,
      name: 1,
      mobileNumber: 1,
      vehicleNumber: 1,
      createdAt: 1
    }
  );
};

// =====================================================
// GET ALL DRIVERS
// =====================================================

const getAllDrivers = async () => {
  return Driver.find(
    {},
    {
      _id: 1,
      driverId: 1,
      role: 1,
      name: 1,
      mobileNumber: 1,
      vehicleNumber: 1,
      routeArea: 1,
      isVerified: 1,
      registrationSource: 1
    }
  ).sort({
    createdAt: -1
  });
};

// =====================================================
// ADD DRIVER - ADMIN
// =====================================================

const addDriver = async (data) => {
  const mobileNumber =
    String(data?.mobileNumber || '')
      .replace(/\D/g, '');

  if (!/^[6-9]\d{9}$/.test(mobileNumber)) {
    throw new Error(
      'Invalid driver mobile number'
    );
  }

  const existingDriver =
    await Driver.findOne({
      mobileNumber
    });

  if (existingDriver) {
    throw new Error(
      'Driver already exists'
    );
  }

  const driverId =
    await createDriverId();

  return Driver.create({
    ...data,

    driverId,

    mobileNumber,

    role: 'driver',

    password: null,

    registrationSource:
      'admin'
  });
};

// =====================================================
// DRIVER DASHBOARD
// =====================================================

const getDashboard = async (driverId) => {
  const driver =
    await Driver.findOne({
      driverId
    });

  if (!driver) {
    throw new Error(
      'Driver not found'
    );
  }

  const students =
    await Parent.find(
      { driverId },
      {
        _id: 0,
        parentId: 1,
        name: 1,
        mobileNumber: 1,
        studentName: 1,
        studentClass: 1,
        studentSection: 1,
        schoolName: 1,
        pickupArea: 1,
        dropArea: 1,
        attendance: 1,
        morningStatus: 1,
        morningPickedUpAt: 1,
        morningDroppedAtSchoolAt: 1,
        eveningStatus: 1,
        eveningPickedFromSchoolAt: 1,
        eveningDroppedAtHomeAt: 1
      }
    );

  const present =
    students.filter(
      student => student.attendance
    ).length;

  const absent =
    students.filter(
      student => !student.attendance
    ).length;

  return {
    success: true,

    driver: {
      driverId:
        driver.driverId,
      name:
        driver.name,
      vehicleNumber:
        driver.vehicleNumber,
      routeArea:
        driver.routeArea,
      isVerified:
        driver.isVerified
    },

    students,

    todayStats: {
      present,
      absent,
      total:
        students.length
    }
  };
};

// =====================================================
// GET / UPDATE / DELETE
// =====================================================

const getDriver = async (id) => {
  return Driver.findById(id);
};

const updateDriver = async (
  id,
  data
) => {
  return Driver.findByIdAndUpdate(
    id,
    data,
    {
      new: true,
      runValidators: true
    }
  );
};

const deleteDriver = async (id) => {
  return Driver.findByIdAndDelete(id);
};

module.exports = {
  registerDriver,
  findDriver,
  getAllDrivers,
  addDriver,
  getDashboard,
  getDriver,
  updateDriver,
  deleteDriver,
  getReferralDetails,
  getReferredDrivers
};
