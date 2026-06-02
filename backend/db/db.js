const mongoose = require('mongoose');
const dotenv = require('dotenv').config();

const connectDB = async () => {

    await mongoose.connect(`${process.env.MONGODB_URI}`)
        .then(() => {
            console.log("db connected")
        }
        )
        .catch((err) => {
            console.log("db not connected", err)
        }
        )

}

module.exports = connectDB;