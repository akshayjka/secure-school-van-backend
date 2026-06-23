const express = require('express');

const router = express.Router();

const authController = require('../controllers/auth.controller');


router.post(

  '/register',

  authController.register

);


router.post(

  '/login',

  authController.login

);


router.post(

  '/forgot-password',

  authController.forgotPassword

);


router.post(

  '/set-password',

  authController.setPassword

);


module.exports = router;