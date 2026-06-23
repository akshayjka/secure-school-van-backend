const Driver = require('../models/driver.model');

const Parent = require('../models/parent.model');

const login = async (data) => {

  const { mobileNumber } = data;

  let user = await Driver.findOne({

    mobileNumber

  });

  if (!user) {

    user = await Parent.findOne({

      mobileNumber

    });

  }

  if (!user) {

    throw new Error('User not found');

  }

  return {

    success: true,

    message: 'Login successful',

    role: user.role,

    user

  };

};

module.exports = {

  login

};