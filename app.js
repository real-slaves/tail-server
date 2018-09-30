const express = require('express')
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)

app.use(express.static('./game'))

server.listen(process.env.PORT || 8080)

let game = {
	users: [],
	room: {
		status: 0
	}
}

io.set('origins', '*:*')
io.on('connection', socket => {
    addUser(socket.id)
    socket.on("update", data => {
        updateUser(socket.id, data)
    })
    socket.on("disconnect", data => {
        removeUser(socket.id)
	clearInterval(sendData)
    })
    
    let sendData = setInterval(() => {
	console.log(game)
        socket.emit("update", { 
		users: game.users.filter(element => element.roomid == game.users[getUserIndex(socket.id)].roomid), 
		room: game.room
	})
    }, 100)
})

function addUser(id) {
    if (getRoomSNumberOfUser(0) < 4 && game.room.status == 0) {
	game.users.push({x: 0, y: 0, id: id, rotation: 0, tail: [], roomid: 0})
	if (getRoomSNumberOfUser(0) == 4)
	    startGame(0)
    } else {
	game.users.push({x: 0, y: 0, id: id, rotation: 0, tail: [], roomid: -1})
    }
}

function updateUser(id, data) {
    let userIndex = getUserIndex(id)
    game.users[userIndex] = data
    game.users[userIndex].id = id
}

function removeUser(id) {
    let userIndex = getUserIndex(id)
    if (game.users[userIndex].roomid != -1 && game.room.status != 0)
	game.users.find(element => element.roomid == -1).roomid = game.users[userIndex].roomid
	
    game.users.splice(userIndex, 1)
}

function startGame(roomid) {
    game.room.status == 1
}

function getRoomSNumberOfUser(roomid) {
    return game.users.filter(element => element.roomid == roomid).length
}

function getUserIndex(id) {
    return game.users.findIndex(element => element.id == id)
}
