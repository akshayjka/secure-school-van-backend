const Parent = require('../models/parent.model');
const Driver = require('../models/driver.model');
const Ride = require('../models/ride.model');

const addParent = async (data) => {

  if (!data.driverId) {
    throw new Error(
      'Driver Id is required'
    );

  }

  const existingParent = await Parent.findOne({
    mobileNumber: data.mobileNumber
  });

  if (existingParent) {
    throw new Error(
      'Parent already exists'
    );
  }

  const count = await Parent.countDocuments();
  const parentId = `PAR${String(count + 1).padStart(6, '0')}`;

  const parent = await Parent.create({
    ...data,
    parentId,
    role: 'parent',
    attendance: false
  });
  return parent;

};
const getAllParents = async () => {
  return await Parent.find().sort({
    createdAt: -1
  });
};

const getParent = async (id) => {
  return await Parent.findById(id);
};

const updateParent = async (id, data) => {
  return await Parent.findByIdAndUpdate(id,data,{ new: true });
};

const deleteParent = async (id) => {
  return await Parent.findByIdAndDelete(id);
};

exports.getDashboard = async (parentId) => {

  const parent = await Parent.findOne({
    parentId
  });

  if (!parent) {
    throw new Error('Parent not found');
  }

  const driver = await Driver.findOne({
    driverId: parent.driverId
  });

  const ride = await Ride.findOne({
    driverId: parent.driverId
  });

  return {
    studentName: parent.studentName,
    schoolName: parent.schoolName,
    pickupArea: parent.pickupArea,
    dropArea: parent.dropArea,

    driver: driver ? {
      driverId: driver.driverId,
      name: driver.name,
      mobileNumber: driver.mobileNumber
    } : null,

    rideStarted: ride?.rideStarted || false,

    isPresent: parent.isPresent
  };
};

exports.updateAttendance = async (
  parentId,
  isPresent
) => {

  const parent = await Parent.findOneAndUpdate(
    { parentId },
    { isPresent },
    { new: true }
  );

  if (!parent) {
    throw new Error('Parent not found');
  }

  return parent;
};

module.exports = {
 addParent,
  getAllParents,
  getParent,
  updateParent,
  deleteParent
};