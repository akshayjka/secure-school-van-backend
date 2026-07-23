const Ride = require('../models/ride.model');
exports.startRide = async (driverId) => {

  let ride = await Ride.findOne({ driverId });

  if (!ride) {

    ride = await Ride.create({
      driverId,
      status: 'started',
      startTime: new Date()
    });

  } else {

    ride.status = 'started';
    ride.startTime = new Date();

    await ride.save();
  }

  return ride;
};
exports.endRide = async (driverId) => {

  const ride = await Ride.findOne({
    driverId
  });

  if (!ride) {
    throw new Error('Ride not found');
  }

  ride.status = 'ended';
  ride.endTime = new Date();

  await ride.save();

  return ride;
};
exports.getRideStatus = async (
  driverId
) => {

  const ride = await Ride.findOne({
    driverId
  });

  return {
    rideStarted:
      ride?.rideStarted || false
  };
};