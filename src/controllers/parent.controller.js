const parentService = require('../services/parent.service');
const Parent = require('../models/parent.model');


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

const getAllParents = async (req, res) => {

  try {

    const parents = await parentService.getAllParents();
    return res.status(200).json({
      success: true,
      count: parents.length,
      data: parents
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }

};

const getParent = async (req, res) => {

  try {
    const parent = await parentService.getParent(
      req.params.id
    );

    return res.status(200).json({
      success: true,
      data: parent
    });

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });

  }

};

const updateParent = async (req, res) => {

  try {

    const parent = await parentService.updateParent( req.params.id, req.body);
    return res.status(200).json({success: true, message: 'Parent updated successfully', data: parent});

  } catch (error) {
    return res.status(500).json({ success: false, message: error.message});
  }

};

const deleteParent = async (req, res) => {
  try {
    await parentService.deleteParent( req.params.id);
    return res.status(200).json({ success: true, message: 'Parent deleted successfully'});
  } 
  catch (error) {
    return res.status(500).json({success: false, message: error.message});
  }

};

const updateFcmToken = async (req,res)=>{

  try {

    const {
      parentId,
      fcmToken
    } = req.body;

    await Parent.findOneAndUpdate(
      { parentId },
      { fcmToken }
    );

    res.json({
      success:true
    });

  } catch(error){

    res.status(500).json({
      success:false,
      message:error.message
    });

  }

};

const getDashboard = async (req, res) => {

  try {

    const { parentId } = req.params;

    const data =
      await parentService.getDashboard(parentId);

    res.status(200).json(data);

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};

const updateAttendance = async (req, res) => {

  try {

    const {
      parentId,
      isPresent
    } = req.body;

    await parentService.updateAttendance(
      parentId,
      isPresent
    );

    res.status(200).json({
      success: true,
      message: 'Attendance updated'
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }

};


module.exports = {
  addParent,
  getAllParents,
  getParent,
  updateParent,
  deleteParent,
  updateFcmToken,
   getDashboard,
  updateAttendance
};