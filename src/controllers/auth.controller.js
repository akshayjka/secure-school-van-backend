const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const Driver = require('../models/driver.model');
const Parent = require('../models/parent.model');
const admin = require('../config/admin');

// =====================================================
// HELPERS
// =====================================================

const normalizeMobileNumber = (value) => {
  return String(value || '').replace(/\D/g, '');
};

const validatePassword = (password) => {
  return (
    typeof password === 'string' &&
    password.length >= 6
  );
};

const isBcryptHash = (value) => {
  if (typeof value !== 'string') {
    return false;
  }

  return /^\$2[aby]\$\d{2}\$/.test(value);
};

const sanitizeUser = (user) => {
  if (!user) {
    return null;
  }

  const data =
    typeof user.toObject === 'function'
      ? user.toObject()
      : { ...user };

  delete data.password;

  return data;
};

// =====================================================
// REGISTER
// =====================================================

exports.register = async (req, res) => {
  try {
    const payload = {
      ...req.body
    };

    const role =
      String(payload.role || '')
        .trim()
        .toLowerCase();

    const mobileNumber =
      normalizeMobileNumber(
        payload.mobileNumber
      );

    const password =
      typeof payload.password === 'string'
        ? payload.password
        : '';

    // -------------------------------------------------
    // VALIDATION
    // -------------------------------------------------

    if (!mobileNumber) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number is required'
      });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message:
          'Password must be at least 6 characters'
      });
    }

    if (
      role !== 'driver' &&
      role !== 'parent'
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }

    payload.mobileNumber =
      mobileNumber;

    // -------------------------------------------------
    // CHECK EXISTING USER
    // -------------------------------------------------

    let existingUser = null;

    if (role === 'driver') {
      existingUser =
        await Driver.findOne({
          mobileNumber
        });
    } else {
      existingUser =
        await Parent.findOne({
          mobileNumber
        });
    }

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User already exists'
      });
    }

    // -------------------------------------------------
    // HASH PASSWORD
    // -------------------------------------------------

    payload.password =
      await bcrypt.hash(
        password,
        10
      );

    let savedUser;

    // =================================================
    // DRIVER
    // =================================================

    if (role === 'driver') {

      const count =
        await Driver.countDocuments();

      const driverId =
        `DRV${String(
          count + 1
        ).padStart(6, '0')}`;

      const referralCode =
        `REF${String(
          count + 1
        ).padStart(4, '0')}`;

      let referredByDriver = null;

      if (payload.referredByCode) {

        referredByDriver =
          await Driver.findOne({
            referralCode:
              payload.referredByCode
          });

        if (!referredByDriver) {
          return res.status(400).json({
            success: false,
            message:
              'Invalid referral code'
          });
        }
      }

      savedUser =
        await Driver.create({
          ...payload,

          driverId,

          referralCode,

          referredByCode:
            referredByDriver?.referralCode ||
            null,

          referredByDriverId:
            referredByDriver?._id ||
            null,

          referralCount: 0
        });

      // Update referral count
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

    } else {

      // =================================================
      // PARENT
      // =================================================

      savedUser =
        await Parent.create({
          ...payload,

          parentId:
            payload.parentId ||
            `PAR${Date.now()}`
        });
    }

    return res.status(201).json({
      success: true,
      message:
        'Registration successful',

      user:
        sanitizeUser(savedUser)
    });

  } catch (error) {

    console.error(
      'REGISTER ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Registration failed'
    });
  }
};

// =====================================================
// LOGIN
// =====================================================

exports.login = async (req, res) => {
  try {

    const mobileNumber =
      normalizeMobileNumber(
        req.body.mobileNumber
      );

    // DO NOT trim the password.
    const password =
      typeof req.body.password === 'string'
        ? req.body.password
        : '';

    // -------------------------------------------------
    // VALIDATION
    // -------------------------------------------------

    if (!mobileNumber) {
      return res.status(400).json({
        success: false,
        message:
          'Mobile number is required'
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message:
          'Password is required'
      });
    }

    // =================================================
    // ADMIN LOGIN
    // =================================================

    if (
      mobileNumber ===
        normalizeMobileNumber(
          admin.mobileNumber
        ) &&
      password === admin.password
    ) {

      if (!process.env.JWT_SECRET) {
        throw new Error(
          'JWT_SECRET is not configured'
        );
      }

      const token =
        jwt.sign(
          {
            id: 'ADMIN001',
            role: 'admin'
          },
          process.env.JWT_SECRET,
          {
            expiresIn: '1d'
          }
        );

      return res.status(200).json({
        success: true,
        message:
          'Login successful',
        token,
        role: 'admin',
        name:
          admin.name
      });
    }

    // =================================================
    // DRIVER
    // =================================================

    let user =
      await Driver.findOne({
        mobileNumber
      });

    let userType = 'driver';

    // =================================================
    // PARENT
    // =================================================

    if (!user) {

      user =
        await Parent.findOne({
          mobileNumber
        });

      userType = 'parent';
    }

    // =================================================
    // USER NOT FOUND
    // =================================================

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          'User not found'
      });
    }

    // -------------------------------------------------
    // DEBUG INFORMATION
    // -------------------------------------------------

    console.log(
      'AUTH LOGIN:',
      {
        mobileNumber,
        userType,
        userId: String(user._id),
        role: user.role,
        hasPassword:
          Boolean(user.password),
        passwordIsBcrypt:
          isBcryptHash(user.password)
      }
    );

    // =================================================
    // PASSWORD NOT SET
    // =================================================

    if (
      typeof user.password !== 'string' ||
      !user.password
    ) {

      return res.status(401).json({
        success: false,
        message:
          'Password not set for this account. Please use Forgot Password.'
      });
    }

    // =================================================
    // PASSWORD CHECK
    // =================================================

    let passwordMatched = false;

    // -------------------------------------------------
    // BCRYPT
    // -------------------------------------------------

    if (
      isBcryptHash(
        user.password
      )
    ) {

      passwordMatched =
        await bcrypt.compare(
          password,
          user.password
        );

    } else {

      // -------------------------------------------------
      // LEGACY PASSWORD
      // -------------------------------------------------

      passwordMatched =
        password ===
        user.password;

      // Convert old password to bcrypt
      if (passwordMatched) {

        const newHash =
          await bcrypt.hash(
            password,
            10
          );

        await user.updateOne({
          $set: {
            password: newHash
          }
        });

        console.log(
          'Legacy password migrated to bcrypt'
        );
      }
    }

    // =================================================
    // INVALID PASSWORD
    // =================================================

    if (!passwordMatched) {

      return res.status(401).json({
        success: false,
        message:
          'Invalid password'
      });
    }

    // =================================================
    // JWT
    // =================================================

    if (!process.env.JWT_SECRET) {
      throw new Error(
        'JWT_SECRET is not configured'
      );
    }

    const role =
      user.role ||
      userType;

    const token =
      jwt.sign(
        {
          id: user._id,
          role
        },
        process.env.JWT_SECRET,
        {
          expiresIn: '1d'
        }
      );

    // =================================================
    // RESPONSE
    // =================================================

    return res.status(200).json({

      success: true,

      message:
        'Login successful',

      token,

      role,

      name:
        user.name ||
        user.studentName ||
        '',

      userId:
        user._id,

      parentId:
        user.parentId ||
        null,

      driverId:
        user.driverId ||
        null,

      user:
        sanitizeUser(user)
    });

  } catch (error) {

    console.error(
      'LOGIN ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Internal server error'
    });
  }
};

// =====================================================
// FORGOT PASSWORD
// =====================================================

exports.forgotPassword = async (
  req,
  res
) => {

  try {

    const mobileNumber =
      normalizeMobileNumber(
        req.body.mobileNumber
      );

    const newPassword =
      typeof req.body.newPassword === 'string'
        ? req.body.newPassword
        : '';

    // -------------------------------------------------
    // VALIDATION
    // -------------------------------------------------

    if (!mobileNumber) {
      return res.status(400).json({
        success: false,
        message:
          'Mobile number is required'
      });
    }

    if (!validatePassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          'Password must be at least 6 characters'
      });
    }

    // =================================================
    // FIND DRIVER
    // =================================================

    let user =
      await Driver.findOne({
        mobileNumber
      });

    let userModel = Driver;

    // =================================================
    // FIND PARENT
    // =================================================

    if (!user) {

      user =
        await Parent.findOne({
          mobileNumber
        });

      userModel = Parent;
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          'User not found'
      });
    }

    // =================================================
    // HASH
    // =================================================

    const hashedPassword =
      await bcrypt.hash(
        newPassword,
        10
      );

    // =================================================
    // UPDATE
    // =================================================

    const updateResult =
      await userModel.updateOne(
        {
          _id: user._id
        },
        {
          $set: {
            password:
              hashedPassword
          }
        }
      );

    console.log(
      'FORGOT PASSWORD UPDATE:',
      {
        model:
          userModel.modelName,
        userId:
          String(user._id),
        matchedCount:
          updateResult.matchedCount,
        modifiedCount:
          updateResult.modifiedCount
      }
    );

    // -------------------------------------------------
    // VERIFY USING A FRESH QUERY
    // -------------------------------------------------

    const verifyUser =
      await userModel.findOne({
        _id: user._id
      });

    if (
      !verifyUser ||
      typeof verifyUser.password !== 'string' ||
      !verifyUser.password
    ) {

      return res.status(500).json({
        success: false,
        message:
          'Password update failed. The password field is not available in the user schema.'
      });
    }

    return res.status(200).json({
      success: true,
      message:
        'Password updated successfully'
    });

  } catch (error) {

    console.error(
      'FORGOT PASSWORD ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Internal server error'
    });
  }
};

// =====================================================
// SET PASSWORD
// =====================================================

exports.setPassword = async (
  req,
  res
) => {

  try {

    const mobileNumber =
      normalizeMobileNumber(
        req.body.mobileNumber
      );

    const password =
      typeof req.body.password === 'string'
        ? req.body.password
        : '';

    // -------------------------------------------------
    // VALIDATION
    // -------------------------------------------------

    if (!mobileNumber) {
      return res.status(400).json({
        success: false,
        message:
          'Mobile number is required'
      });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({
        success: false,
        message:
          'Password must be at least 6 characters'
      });
    }

    // =================================================
    // FIND DRIVER
    // =================================================

    let user =
      await Driver.findOne({
        mobileNumber
      });

    let userModel = Driver;

    // =================================================
    // FIND PARENT
    // =================================================

    if (!user) {

      user =
        await Parent.findOne({
          mobileNumber
        });

      userModel = Parent;
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          'User not found'
      });
    }

    console.log(
      'SET PASSWORD USER:',
      {
        model:
          userModel.modelName,
        userId:
          String(user._id),
        mobileNumber
      }
    );

    // =================================================
    // HASH
    // =================================================

    const hashedPassword =
      await bcrypt.hash(
        password,
        10
      );

    // =================================================
    // SAVE THROUGH DOCUMENT
    // =================================================

    user.password =
      hashedPassword;

    await user.save();

    // =================================================
    // FRESH DATABASE READ
    // =================================================

    const updatedUser =
      await userModel.findOne({
        _id: user._id
      });

    console.log(
      'SET PASSWORD VERIFY:',
      {
        model:
          userModel.modelName,
        userId:
          String(user._id),
        passwordSaved:
          Boolean(
            updatedUser?.password
          ),
        passwordIsBcrypt:
          isBcryptHash(
            updatedUser?.password
          )
      }
    );

    // =================================================
    // FAILED
    // =================================================

    if (
      !updatedUser ||
      typeof updatedUser.password !== 'string' ||
      !updatedUser.password
    ) {

      return res.status(500).json({
        success: false,
        message:
          'Password update failed. The password field is not available in the user schema.'
      });
    }

    // =================================================
    // SUCCESS
    // =================================================

    return res.status(200).json({
      success: true,
      message:
        'Password updated successfully'
    });

  } catch (error) {

    console.error(
      'SET PASSWORD ERROR:',
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        'Internal server error'
    });
  }
};