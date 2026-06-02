const mongoose = require('mongoose');

const userschema = new mongoose.Schema({

    email:{
        type:String,
        required:true,
        unique:true
    },
    password:{
        type:String,
        required:true
    },
    role:{
        type:String,
        enum:["admin","desk"],
        default:"desk"
    }
})

module.exports = mongoose.model("user",userschema)