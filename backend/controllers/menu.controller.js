const menumodel = require('../models/menu.model')

const createmenu = async (req, res) => {

    const { name, category, price, image } = req.body

    if (!name || !category || !price) {
        return res.status(400).json({ message: "please fill all the fields" })
    }

    try {

        const menu = await menumodel.create({ name, category, price, image })

        return res.status(201).json({ message: "menu created successfully", menu })

    } catch (err) {
        return res.status(500).json({ message: "internal server error", error: err.message })
    }

}

const getmenus = async (req, res) => {
    try {
        const menu = await menumodel.find()
        return res.status(200).json({ message: "menus fetched successfully", menu })
    } catch (err) {
        return res.status(500).json({ message: "internal server error", error: err.message })
    }
}

const updatemenu = async (req, res) => {

    const { id } = req.params
    const { name, category, price, image, available } = req.body

    if (!id) {
        return res.status(400).json({ message: "menu id is required" })
    }

    if (!name || !category || !price) {
        return res.status(400).json({ message: "please fill all the fields" })
    }

    try {

        const menu = await menumodel.findByIdAndUpdate(id, { name, category, price, image, available }, { new: true })

        return res.status(200).json({ message: "menu updated successfully", menu })

    } catch (err) {
        return res.status(500).json({ message: "internal server error", error: err.message })
    }

}

const deletemenu = async (req, res) => {

    const { id } = req.params

    if (!id) {
        return res.status(400).json({ message: "menu id is required" })
    }

    try {
        await menumodel.findByIdAndDelete(id)
        return res.status(200).json({ message: "menu deleted successfully" })
    }
    catch (err) {
        return res.status(500).json({ message: "internal server error", error: err.message })
    }
}

module.exports = { createmenu, getmenus, updatemenu, deletemenu }