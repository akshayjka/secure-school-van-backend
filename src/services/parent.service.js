const Parent = require('../models/parent.model');

const addParent = async (data) => {

  const existingParent = await Parent.findOne({
    mobileNumber: data.mobileNumber
  });

  if (existingParent) {
    throw new Error('Parent already exists');
  }

  const count = await Parent.countDocuments();

  const parentId = `PAR${String(count + 1).padStart(6, '0')}`;

  const parent = await Parent.create({
    ...data,
    parentId
  });

  return parent;
};

module.exports = {
  addParent
};