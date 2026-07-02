const Ride = require('../models/ride.model');
const Parent =
    require('../models/parent.model');

const Driver = require('../models/driver.model');
const rideService = require('../services/ride.service');
// const {
//     sendRideStartedNotification
// } =
//     require('../services/notification.service');

exports.startRide = async (req, res) => {

    try {

        const { driverId } = req.body;

        const existingRide =
            await Ride.findOne({ driverId, status: 'started' });

        if (existingRide) {
            return res.status(400).json({ success: false, message: 'Ride already active' });
        }

        const rideCount =
            await Ride.countDocuments();
        const rideId =
            `RIDE${String(rideCount + 1).padStart(6, '0')}`;

        const ride = await Ride.create({ rideId, driverId, status: 'started', startTime: new Date(), locations: [] });

        res.status(201).json({ success: true, message: 'Ride started', ride });
    }

    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }

};

exports.updateLocation = async (req, res) => {
    try {
        const {
            driverId,
            latitude,
            longitude,
            timestamp
        } = req.body;
        const ride =
            await Ride.findOne({ driverId, status: 'started' });

        if (!ride) {
            return res.status(404).json({ success: false, message: 'Active ride not found' });
        }

        ride.currentLatitude = latitude;
        ride.currentLongitude = longitude;
        ride.locations.push({ latitude, longitude, timestamp });
        await ride.save();
        return res.json({ success: true, message: 'Location updated' });
    }

    catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.endRide = async (req, res) => {

    try {

        const { driverId } = req.body;
        const ride =
            await Ride.findOne({ driverId, status: 'started' });

        if (!ride) {
            await sendRideEndedNotification(tokens, driver.name);
            return res.status(404).json({ success: false, message: 'No active ride found' });

        }
        ride.status = 'ended';
        ride.endTime = new Date();
        await ride.save();
        return res.json({ success: true, message: 'Ride ended' });

    }

    catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: error.message });
    }

};

exports.getLiveLocation =
    async (req, res) => {

        try {

            const { driverId } =
                req.params;

            const ride =
                await Ride.findOne({ driverId, status: 'started' });

            if (!ride) {

                return res.status(404).json({ success: false, message: 'Ride not active' });

            }

            return res.json({
                success: true,
                latitude:
                    ride.currentLatitude,
                longitude:
                    ride.currentLongitude,
                startTime:
                    ride.startTime
            });

        }

        catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: error.message });

        }

    };

exports.getRideStatus =
    async (req, res) => {

        try {

            const { driverId } =
                req.params;

            const ride =
                await Ride.findOne({ driverId, status: 'started' });

            res.json({ success: true, rideStarted: !!ride });

        }

        catch (error) {

            res.status(500).json({ success: false, message: error.message });

        }

    };
    


exports.startRide = async (
  req,
  res
) => {

  try {

    const { driverId } = req.body;

    const ride =
      await rideService.startRide(driverId);

    res.status(200).json({
      success: true,
      ride
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};


exports.endRide = async (
  req,
  res
) => {

  try {

    const { driverId } = req.body;

    const ride =
      await rideService.endRide(driverId);

    res.status(200).json({
      success: true,
      ride
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};

exports.getRideStatus = async (
  req,
  res
) => {

  try {

    const { driverId } = req.params;

    const data =
      await rideService.getRideStatus(
        driverId
      );

    res.status(200).json(data);

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};