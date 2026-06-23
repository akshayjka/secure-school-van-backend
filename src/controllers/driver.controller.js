const driverService = require('../services/driver.service');

const registerDriver = async (req, res) => {

    try {

        const response = await driverService.registerDriver(
            req.body
        );

        return res.status(200).json(response);

    } catch (error) {

        return res.status(500).json({

            success: false,

            message: error.message
        });
    }
};

const getAllDrivers = async (req, res) => {

    try {

        const drivers = await driverService.getAllDrivers();

        return res.status(200).json({

            success: true,

            count: drivers.length,

            data: drivers

        });

    } catch (error) {

        return res.status(500).json({

            success: false,

            message: error.message

        });
    }
};

const addDriver = async(req,res)=>{

try{

 const driver = await driverService.addDriver(req.body);

 return res.status(201).json({

   success:true,

   message:'Driver added successfully',

   data:driver

 });

}

catch(error){

 return res.status(500).json({

   success:false,

   message:error.message

 });

}

}


module.exports = {
    registerDriver,
    getAllDrivers,
    addDriver
};