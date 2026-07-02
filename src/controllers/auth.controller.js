const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Driver = require('../models/driver.model');
const Parent = require('../models/parent.model');
const admin = require('../config/admin');

// ================= REGISTER =================

exports.register = async (req, res) => {

  try {

    const payload = req.body;

    const {
      role,
      mobileNumber,
      password
    } = payload;

    let existingUser;

    if (role === 'driver') {

      existingUser = await Driver.findOne({
        mobileNumber
      });

    } else {

      existingUser = await Parent.findOne({
        mobileNumber
      });

    }

    if (existingUser) {

      return res.status(400).json({

        success: false,

        message: 'User already exists'

      });

    }

    const hashedPassword = await bcrypt.hash(
      password,
      10
    );

    payload.password = hashedPassword;

    let savedUser;

if (role === 'driver') {

  const count = await Driver.countDocuments();

  const driverId =
    `DRV${String(count + 1).padStart(6, '0')}`;

  const referralCode =
    `REF${String(count + 1).padStart(4, '0')}`;

  let referredByDriver = null;

  if (payload.referredByCode) {

    referredByDriver = await Driver.findOne({
      referralCode: payload.referredByCode
    });

    if (!referredByDriver) {

      return res.status(400).json({
        success: false,
        message: 'Invalid referral code'
      });

    }

  }

  savedUser = await Driver.create({

    ...payload,

    driverId,

    referralCode,

    referredByCode:
      referredByDriver?.referralCode || null,

    referredByDriverId:
      referredByDriver?._id || null,

    referralCount: 0

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

}
    
    else {

      savedUser = await Parent.create({

        ...payload,

        parentId: `PAR${Date.now()}`

      });

    }

    res.status(201).json({

      success: true,

      message: 'Registration successful',

      user: savedUser

    });

  }

  catch (error) {

    res.status(500).json({

      success: false,

      message: error.message

    });

  }

};


// ================= LOGIN =================

exports.login = async (req, res) => {
  try {
    const { mobileNumber, password } = req.body;
    // Validation
    if (!mobileNumber || !password) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number and password are required'
      });
    }

    if ( mobileNumber === admin.mobileNumber && password === admin.password ) {

      const token = jwt.sign(
        {
          id: 'ADMIN001',
          role: 'admin'
        },
        process.env.JWT_SECRET,
        {
          expiresIn: '1d'
        }
      );

      return res.json({
        success: true,
        token,
        role: 'admin',
        name: admin.name
      });
    }

    // Find Driver

    let user = await Driver.findOne({
      mobileNumber
    });

    // Find Parent if Driver not found

    if (!user) {
      user = await Parent.findOne({
        mobileNumber
      });
    }

    // User not found

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });

    }

    // Password missing in DB

  if (!user.password) {
  return res.status(400).json({
    success: false,
    message: 'Password not set. Please create password first.'
  });

}

    // Compare password

    const isMatch = await bcrypt.compare(password,user.password);

    if (!isMatch) {
      return res.status(401).json({success: false,  message: 'Invalid password'});
    }

    // Generate token

    const token = jwt.sign(
      {
        id: user._id,
        role: user.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '1d'
      }
    );

  return res.status(200).json({
  success:true,
  message:'Login successful',
  token,
  role:user.role,
  name:user.name,
  userId:user._id,
  driverId:user.driverId || null,
  user
});

  }

  catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message
    });

  }


  };
  // ================= FORGOT PASSWORD =================

exports.forgotPassword = async (req, res) => {
  try {
    const {
      mobileNumber,
      newPassword
    } = req.body;

    if (!mobileNumber || !newPassword) {

      return res.status(400).json({ success: false, message: 'Mobile number and new password are required'});
    }
    let collection = Driver;

let user = await Driver.findOne({
  mobileNumber
});

if (user) {

  user.role = 'driver';

}

if (!user) {

  user = await Parent.findOne({
    mobileNumber
  });

  if (user) {

    user.role = 'parent';

  }

}

      collection = Parent;

    


    if (!user) {

      return res.status(404).json({

        success: false,

        message: 'User not found'

      });

    }


    const hashedPassword = await bcrypt.hash(

      newPassword,

      10

    );


    await collection.findByIdAndUpdate(

      user._id,

      {

        password: hashedPassword

      }

    );


    return res.status(200).json({

      success: true,

      message: 'Password updated successfully'

    });

  }

  catch (error) {

    console.log(error);

    return res.status(500).json({

      success: false,

      message: error.message

    });

  }

};


// ================= SET PASSWORD =================

exports.setPassword = async (req, res) => {

  try {

    const {
      mobileNumber,
      password
    } = req.body;

    // Validation

    if (!mobileNumber || !password) {

      return res.status(400).json({

        success: false,

        message: 'Mobile number and password are required'

      });

    }

    if (password.length < 6) {

      return res.status(400).json({

        success: false,

        message: 'Password must be at least 6 characters'

      });

    }

    let user = await Driver.findOne({

      mobileNumber

    });

    if (!user) {

      user = await Parent.findOne({

        mobileNumber

      });

    }

    if (!user) {

      return res.status(404).json({

        success: false,

        message: 'User not found'

      });

    }

    const hashedPassword = await bcrypt.hash(

      password,

      10

    );

    user.password = hashedPassword;

    await user.save();

    return res.status(200).json({

      success: true,

      message: 'Password updated successfully'

    });

  }

  catch (error) {

    console.error(error);

    return res.status(500).json({

      success: false,

      message: 'Internal server error'

    });

  }

};

