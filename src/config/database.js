const mongoose = require('mongoose');

const connectDB = async () => {

  try {

    console.log('Connecting to MongoDB...');

    await mongoose.connect(
      process.env.MONGO_URI,
      {
        serverSelectionTimeoutMS: 10000
      }
    );

    console.log('✅ MongoDB Connected');

  }

  catch (error) {

    console.log('❌ MongoDB Connection Failed');

    console.log(error.message);

    process.exit(1);

  }

};

module.exports = connectDB;