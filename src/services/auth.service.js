const bcrypt = require('bcryptjs');

const Driver = require('../models/driver.model');
const Parent = require('../models/parent.model');

const login = async (data) => {
  const mobileNumber = String(data.mobileNumber || '').trim();
  const password = String(data.password || '');

  // -----------------------------
  // Basic validation
  // -----------------------------
  if (!mobileNumber) {
    throw new Error('Mobile number is required');
  }

  if (!password) {
    throw new Error('Password is required');
  }

  // -----------------------------
  // Find user
  // Driver first, then Parent
  // -----------------------------
  let user = await Driver.findOne({ mobileNumber });

  let userType = 'driver';

  if (!user) {
    user = await Parent.findOne({ mobileNumber });
    userType = 'parent';
  }

  // -----------------------------
  // User not found
  // -----------------------------
  if (!user) {
    throw new Error('User not found');
  }

  // -----------------------------
  // Password must exist
  // -----------------------------
  if (!user.password) {
    throw new Error(
      'Password not set for this account. Please use Forgot Password to set your password.'
    );
  }

  // -----------------------------
  // Compare entered password
  // with bcrypt hashed password
  // -----------------------------
  const passwordMatched = await bcrypt.compare(
    password,
    user.password
  );

  if (!passwordMatched) {
    throw new Error('Invalid password');
  }

  // -----------------------------
  // Never send password to client
  // -----------------------------
  const userObject = user.toObject();

  delete userObject.password;

  // -----------------------------
  // Successful login
  // -----------------------------
  return {
    success: true,
    message: 'Login successful',
    role: user.role || userType,
    user: userObject
  };
};

module.exports = {
  login
};