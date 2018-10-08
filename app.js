const express = require('express')
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)

app.use(express.static('./DiCon2018'))

server.listen(process.env.PORT || 8080)

//----------------------------------------------------------------------------------------------------------------------------------------------------------------------------//

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
    socket.on("join", data => addUser(1, socket.id))
    socket.on("update", data => updateUser(socket.id, data))
    socket.on("died", data => userDied(data.hunter, data.target))
    socket.on("disconnect", data => userDisconnected(socket.id))
})

setInterval(() => {
    monitoring()
    sendGameData()
    checkGameOver()
}, 100)

//----------------------------------------------------------------------------------------------------------------------------------------------------------------------------//

function checkGameOver() {
    game.rooms.forEach((element, index) => {	
	if (isGameOver(index)) userWon(game.users.find(element => element.roomid == index && element.isDead == false))	
    })
}

function sendGameData() {
    game.users.forEach(element => io.to(element.id).emit("update", {
	users: getRoomSUserList(getUser(element.id).roomid),
	room: game.rooms[element.roomid]
    }))
}

function monitoring() {
    console.log(game)
    console.log(game.rooms[0].foodchain)
}

function addUser(access, id, roomid) {
    let numberOfUsers = 4
    if (access == 1) {
	game.users.push({x: 0, y: 0, id: id, rotation: 0, tail: [], roomid: game.rooms.length - 1, isDead: false})
	if (getRoomSNumberOfUser(game.rooms.length - 1) == numberOfUsers) {
            startGame(game.rooms.length - 1)
            createNewRoom()
	}
    } else {
	if (game.rooms[roomid].status == 0) {
	    game.users.push({x: 0, y:0, id: id, rotation: 0, tail: [], roomid: roomid, isDead})
	    if (getRoomSNumberOfUser(roomid) == numberOfUsers)
		startGame(roomid)
	} else {
	    io.to(id).emit("full")
	}
    }
}

function updateUser(id, data) {
    let userIndex = getUserIndex(id)
    game.users[userIndex] = data
    game.users[userIndex].id = id
}

function userDied(hunter, target) {
    io.to(target).emit("died")

    if (!hunter || !game.rooms[getUser(hunter).roomid].foodchain.find(element => element.hunter == target) || !game.rooms[getUser(hunter).roomid].foodchain.find(element => element.target == target))
	return;

    game.rooms[getUser(hunter).roomid].foodchain.splice(game.rooms[getUser(hunter).roomid].foodchain.findIndex(element => element.target == target), 1)
    game.rooms[getUser(hunter).roomid].foodchain[game.rooms[getUser(hunter).roomid].foodchain.findIndex(element => element.hunter == target)].hunter = hunter   
    game.users[getUserIndex(target)].isDead = true
}

function userDisconnected(id) {
    let user = getUser(id)
    if (user == undefined) return;

    if (user.roomid >= 0 && game.rooms[user.roomid].status == 1 && user.isDead == undefined)
	userDied(null, id)
    removeUser(id)
}

function userWon(winner) {
    removeRoom(winner.roomid)
    getRoomSUserList(winner.id).forEach(element => {
	game.users[game.users.findIndex(element => element.roomid != -2)].roomid = -2
	game.users[game.users.findIndex(element => element.isDead != false)].isDead = false
	io.to(element.id).emit("gameEnd", {winner: winner} )
    })
    game.users.filter(element => element.roomid == winner.roomid).forEach(element => game.users[getUserIndex(element.id)].roomid = -2) 
}

function setBlocks(roomid) {
    //setting blocks in the room
    for (let i = 0; i < 10; i++)
	putBlock(roomid)	
}

function putBlock(roomid) {
    game.rooms[roomid].blocks.push({})
}

function startGame(roomid) {
    game.rooms[roomid].status = 1
    game.rooms[roomid].foodchain = makeFoodchain(game.users, roomid)

    setBlocks(roomid)
}

function makeFoodchain(users, roomid) {
    let foodchain = []
    let userlist = getRoomSUserList(roomid)

    for (let i=0; i<userlist.length; i++) 
	foodchain.push({hunter: userlist[i].id, target: userlist[i != userlist.length - 1 ? i+1 : 0].id})
    return foodchain
}

function removeUser(id) {
    if (getRoomSNumberOfUser(-1) != 0 && getUser(id).roomid != -1 && game.rooms[0].status == 0)
	game.users[game.users.findIndex(element => element.roomid == -1)].roomid = 0
	
    game.users.splice(getUserIndex(id), 1)
}

function createNewRoom(access) {
    game.rooms.push({status: 0, blocks: [], foodchain: [], access: access})
}

function removeRoom(roomid) {
    game.rooms[roomid] = {status: 0, blocks: [], foodchain: [], access: 1}
}

function getRoom(roomid) {
    return game.rooms.find(element => element.roomid == roomid)
}

function getRoomIndex(roomid) {
    return game.rooms.findIndex(element => element.roomid == roomid)
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

function getUser(id) {
    return game.users.find(element => element.id == id)
}

function isGameOver(roomid) {
    return game.users.filter(element => element.roomid == roomid && element.isDead == false).length == 1 && game.rooms[roomid].status == 1
}
