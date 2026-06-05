const mongoose = require('mongoose');

const menuschema = new mongoose.Schema({

    name:{
        type:String,
        required:true,
        unique:true
    },
    category:{
        type:String,
        required:true,
        enum:["drinks","snacks","desserts","others"],
        default:"drinks"
    },
    price:{
        type:Number,
        required:true
    },
    image:{
        type:String,
    },
    available:{
        type:Boolean,
        default:true
    }

})

module.exports = mongoose.model("menu",menuschema)