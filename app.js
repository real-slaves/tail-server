const express = require('express')
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)

app.use(express.static('./game'))

server.listen(process.env.PORT || 8080)

let game = {
	users: [],
	room: {
		status: 0,
		foodchain: []
	}
}

io.set('origins', '*:*')
io.on('connection', socket => {
    addUser(socket.id)
    socket.on("update", data => {
        updateUser(socket.id, data)
    })
    socket.on("died", data => {
	userDied(data.hunter, data.target)
    })
    socket.on("disconnect", data => {
	let user = game.users.find(element => element.id == socket.id)
	if (user.roomid >= 0 && game.room.status == 1 && user.isDead == undefined)
		userDied(game.room.foodchain.find(element => element.target == socket.id).hunter, user.id)
	removeUser(socket.id)
	clearInterval(sendData)
    })
    
    let sendData = setInterval(() => {
	console.log(game)
	if (isGameOver(0) && game.room.status == 1)
		userWon(game.users.find(element => element.roomid == 0 && element.isDead == undefined))

        socket.emit("update", { 
		users: game.users.filter(element => element.roomid == game.users[getUserIndex(socket.id)].roomid), 
		room: game.room
	})
   }, 100)
})

function addUser(id) {
    let numberOfUsers = 4
    if (getRoomSNumberOfUser(0) < numberOfUsers && game.room.status == 0) {
	game.users.push({x: 0, y: 0, id: id, rotation: 0, tail: [], roomid: 0, isDead: false})
	if (getRoomSNumberOfUser(0) == numberOfUsers)
	    startGame(0)
    } else {
	game.users.push({x: 0, y: 0, id: id, rotation: 0, tail: [], roomid: -1, isDead: false})
    }
}

function updateUser(id, data) {
    let userIndex = getUserIndex(id)
    game.users[userIndex] = data
    game.users[userIndex].id = id
}

function userDied(hunter, target) {
    io.to(target).emit("died")
    if (game.room.foodchain.find(element => element.hunter == target) && game.room.foodchain.find(element => element.target == target))
	console.log("")	
    else
	return;

    game.room.foodchain.splice(game.room.foodchain.findIndex(element => element.target == target), 1)
    game.room.foodchain[game.room.foodchain.findIndex(element => element.hunter == target)].hunter = hunter   
    game.users[game.users.findIndex(element => element.id == target)].isDead = true
    console.log(game.room.foodchain)
}

function userWon(winner) {
    console.log(game.users.filter(element => element.roomid == winner.roomid).length)
    game.users.filter(element => element.roomid == winner.roomid).forEach(element => {
	game.users[game.users.findIndex(element => element.roomid != -2)].roomid = -2
	io.to(element.id).emit("gameEnd", {winner: winner} )
    })
    game.room.status = 0    
}

function removeUser(id) {
    let userIndex = getUserIndex(id)
    if (getRoomSNumberOfUser(-1) != 0 && game.users[userIndex].roomid != -1 && game.room.status == 0)
	game.users[game.users.findIndex(element => element.roomid == -1)].roomid = 0
	
    game.users.splice(userIndex, 1)
}

function startGame(roomid) {
    game.room.status = 1
    game.room.foodchain = makeFoodchain(game.users)
}

function makeFoodchain(users) {
    let foodchain = []
    for (let i=0; i<users.length - 1; i++)
	foodchain.push({hunter: users[i].id, target: users[i+1].id})

    foodchain.push({hunter: users[users.length - 1].id, target: users[0].id})   
    return foodchain
}

function getRoomSNumberOfUser(roomid) {
    return game.users.filter(element => element.roomid == roomid && !element.isDead).length
}

function getUserIndex(id) {
    return game.users.findIndex(element => element.id == id)
}

function isGameOver(roomid) {
    return game.users.filter(element => element.roomid == roomid && element.isDead == undefined).length == 1
}
