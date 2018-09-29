const express = require('express')
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)

app.use(express.static('/game'))

server.listen(process.env.PORT || 8080)

let room = {
    users: []
}

io.set('origins', '*:*');
io.on('connection', socket => {
    addUser(socket.id)
    socket.on("update", data => {
        updateUser(socket.id, data)
    })
    socket.on("disconnect", data => {
        removeUser(socket.id)
    })

    setInterval(() => {
        io.emit("update", room)
    }, 50)
})

function addUser(id) {
    room.users.push({x: 0, y: 0, id: id, rotation: 0, tail: []})
}

function updateUser(id, data) {
    let userIndex = getUserIndex(id)
    room.users[userIndex] = data
    room.users[userIndex].id = id
}

function removeUser(id) {
    let userIndex = getUserIndex(id)
    room.users.splice(userIndex, 1)
    io.emit("update", room)
}

function getUserIndex(id) {
    return room.users.findIndex(element => element.id == id)
}