const express = require('express')
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)

server.listen(8080)

let room = {
    users: []
}

io.on('connection', socket => {
    newUser(socket.id)
    socket.on("update", data => {

    })
    socket.on("disconnect", data => {
        removeUser(socket.id)
    })
})

function removeUser(id) {
    let userIndex = room.users.findIndex(element => element.id == id)
    room.users.splice(userIndex, 1)
    io.emit("update", room)
}

function moveUser(id, x, y) {
    let user = room.users.find(element => element.id == id)
    user.x += x
    user.y += y
    io.emit("update", room)
}