const parentService = require('../services/parent.service');

const addParent = async (req, res) => {

  try {

    const parent = await parentService.addParent(req.body);

    return res.status(201).json({
      success: true,
      message: 'Parent added successfully',
      data: parent
    });

  } catch (error) {

    if (error.message === 'Parent already exists') {

      return res.status(409).json({
        success: false,
        message: error.message
      });

    }

    return res.status(500).json({
      success: false,
      message: error.message
    });

  }

};

module.exports = {
  addParent
};