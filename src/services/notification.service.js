const admin =
require('../config/firebase');

exports.sendRideStartedNotification =
async (
    tokens,
    driverName
) => {

    if (!tokens.length) {

        return;

    }

    const message = {

        notification: {

            title:
                'Ride Started',

            body:
                `${driverName} has started the ride`

        },

        tokens

    };

    try {

        await admin
            .messaging()
            .sendEachForMulticast(
                message
            );

    }

    catch (error) {

        console.error(error);

    }

};

exports.sendRideEndedNotification =
async (
  tokens,
  driverName
) => {

  if (!tokens.length) {
    return;
  }

  const message = {

    notification: {

      title:'Ride Completed',

      body:
      `${driverName} has completed the ride`

    },

    tokens

  };

  await admin
    .messaging()
    .sendEachForMulticast(
      message
    );

};