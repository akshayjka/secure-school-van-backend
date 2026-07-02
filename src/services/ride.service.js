const Ride = require('../models/ride.model');
exports.startRide = async (driverId) => {

  let ride = await Ride.findOne({
    driverId
  });

  if (!ride) {

    ride = await Ride.create({
      driverId,
      rideStarted: true,
      startTime: new Date()
    });

  } else {

    ride.rideStarted = true;
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

  ride.rideStarted = false;
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