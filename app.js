const express = require('express')
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)

app.use(express.static('./DiCon2018'))

server.listen(process.env.PORT || 8080)

let game = {
	users: [],
	rooms: new Array(1).fill({
		status: 0,
		foodchain: [],
		blocks: []
	})
}

io.set('origins', '*:*')
io.on('connection', socket => {
    socket.on("join", data => {
        addUser(socket.id)
    })
    socket.on("update", data => {
        updateUser(socket.id, data)
    })
    socket.on("died", data => {
	userDied(data.hunter, data.target)
    })
    socket.on("disconnect", data => {
	let user = game.users.find(element => element.id == socket.id)
	if (user == undefined)
		return;
	if (user.roomid >= 0 && game.rooms[0].status == 1 && user.isDead == undefined)
		userDied(null, user.id)
	removeUser(socket.id)
    })
})

setInterval(() => {
	console.log(game)
	if (isGameOver(0))
		userWon(game.users.find(element => element.roomid == 0 && element.isDead == false))

	game.users.forEach(element => io.to(element.id).emit("update", {
		users: getRoomSUserList(game.users[getUserIndex(element.id)].roomid),
		room: game.rooms[0]
	}))
}, 100)

function addUser(id) {
    let numberOfUsers = 4
    if (getRoomSNumberOfUser(0) < numberOfUsers && game.rooms[0].status == 0) {
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
    if (hunter == null)
	return;

    if (game.rooms[0].foodchain.find(element => element.hunter == target) && game.rooms[0].foodchain.find(element => element.target == target))
	console.log("")	
    else
	return;

    game.rooms[0].foodchain.splice(game.rooms[0].foodchain.findIndex(element => element.target == target), 1)
    game.rooms[0].foodchain[game.rooms[0].foodchain.findIndex(element => element.hunter == target)].hunter = hunter   
    game.users[game.users.findIndex(element => element.id == target)].isDead = true
}

function userWon(winner) {
    getRoomSUserList(winner.id).forEach(element => {
	game.users[game.users.findIndex(element => element.roomid != -2)].roomid = -2
	game.users[game.users.findIndex(element => element.isDead != false)].isDead = false
	io.to(element.id).emit("gameEnd", {winner: winner} )
    })
    game.users.filter(element => element.roomid == winner.roomid).forEach(element => game.users[getUserIndex(element.id)].roomid = -2) 
    game.rooms[0].status = 0
}

function removeUser(id) {
    let userIndex = getUserIndex(id)
    if (getRoomSNumberOfUser(-1) != 0 && game.users[userIndex].roomid != -1 && game.rooms[0].status == 0)
	game.users[game.users.findIndex(element => element.roomid == -1)].roomid = 0
	
    game.users.splice(userIndex, 1)
}

function createNewRoom(roomid) {
	game.rooms.push({status: 0, blocks: [], foodchain: [], roomid: roomid})
}

function removeRoom(roomid) {
	game.rooms.splice(getRoomIndex(roomid), 1)
}

function getRoom(roomid) {
	return game.rooms.find(element => element.roomid == roomid)
}

function getRoomIndex(roomid) {
	return game.rooms.findIndex(element => element.roomid == roomid)
}

function setBlocks(roomid) {
	//setting blocks in the room
    for (let i = 0; i < 10; i++)
	putBlock(roomid)	
}

function putBlock(roomid) {

}

function startGame(roomid) {
    game.rooms[roomid].status = 1
    game.rooms[roomid].foodchain = makeFoodchain(game.users)
}

function makeFoodchain(users) {
    let foodchain = []
    let userlist = getRoomSUserList(0)
    for (let i=0; i<userlist.length; i++) 
	foodchain.push({hunter: userlist[i].id, target: userlist[i != userlist.length - 1 ? i+1 : 0].id})
     
    return foodchain
}

function getRoomSUserList(roomid) {
    return game.users.filter(element => element.roomid == roomid)
}

function getRoomSNumberOfUser(roomid) {
    return game.users.filter(element => element.roomid == roomid && !element.isDead).length
}

function getUserIndex(id) {
    return game.users.findIndex(element => element.id == id)
}

function isGameOver(roomid) {
    return game.users.filter(element => element.roomid == roomid && element.isDead == false).length == 1 && game.rooms[roomid].status == 1
}
