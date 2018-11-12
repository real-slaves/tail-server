const express = require('express')
const app = express()
const server = require('http').Server(app)
const io = require('socket.io')(server)

app.use(express.static('./DiCon2018'))

server.listen(process.env.PORT || 8080)

//----------------------------------------------------------------------------------------------------------------------------------------------------------------------------//

const game = {
    users: [],
    rooms: []
}

createNewRoom(1)

io.set('origins', '*:*')
io.on('connection', socket => {
    socket.on("getRoomList", data => sendRoomList(socket.id))
    socket.on("join", data => join(data.access, socket.id, data.roomid))
    socket.on("update", data => updateUser(socket.id, data))
    socket.on("died", data => userDied(data.target))
    socket.on("disconnect", data => userDisconnected(socket.id))
    socket.on("chatPost", data => chatPosted(getUser(socket.id).roomid, data))
    socket.on("addTail", data => io.to(data.target).emit("addTail"))
    socket.on("getAllData", data => socket.emit("allData", game))
    socket.on("blockCollision", data => blockCollision(data))
})

setInterval(() => {
    monitoring()
    sendGameData()
    checkGameOver()
    garbageCollect()
}, 50)

//----------------------------------------------------------------------------------------------------------------------------------------------------------------------------//

function sendRoomList(id) {
    io.to(id).emit("roomList", {rooms: game.rooms})
}

function blockCollision(block) {
    if (game.rooms[block.roomid] == undefined) return
    if (game.rooms[block.roomid].objects[block.index] == undefined) return
    if (game.rooms[block.roomid].objects[block.index].size > 0) game.rooms[block.roomid].objects[block.index].size -= 0.1
    else game.rooms[block.roomid].objects.splice(block.index, 1)
}

function join(access, id, roomid) {
    if (access == 1) {
	let roomIndex = game.rooms.findIndex(element => element.status == 0 && element.option.access == 1)
	if (game.users.find(element => element.id == id) == undefined) {
	     game.users.push({x: 0, y: 0, id, rotation: 0, tail: [], roomid: roomIndex, isDead: false, username: ""})
	} else {
	     game.users[getUserIndex(id)].roomid = roomIndex
	     game.users[getUserIndex(id)].isDead = false
	}

	if (getRoomSNumberOfUser(roomIndex) == 4 || roomIndex == -1) {	
	    if(game.rooms[roomIndex] == undefined)
		return   
            startGame(game.rooms[roomIndex].option.numberOfObjects, roomIndex)
            if (game.rooms.findIndex(element => element.status == 0 && element.option.access == 1) == -1)
		createNewRoom()
	}
	setTimeout(() => chatPosted(roomIndex, {username: "[System]",description: `${getUser(id).username} joined`}), 500)
    } else {
	if (game.rooms[roomid].status == 0) {
	    game.users.push({x: 0, y:0, id, rotation: 0, tail: [], roomid, isDead: false, username: ""})
	    if (getRoomSNumberOfUser(roomid) == game.rooms[roomid].option.numberOfUsers)
		startGame(game.rooms[roomIndex].option.numberOfObjects, roomid)
	    setTimeout(() => chatPosted(roomid, {username: "[System]", description: `${getUser(id).username} joined`}), 500)
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

function userDied(target) {
    emitMessagesToUsers(getRoomSUserList(getUser(target).roomid), "died", {id: target, x: getUser(target).x, y: getUser(target).y})
    chatPosted(getUser(target).roomid, {username: "[System]", description: `${getUser(target).username} was slained`})
    if (game.rooms[getUser(target).roomid] == undefined)
	return
    if (game.rooms[getUser(target).roomid].foodchain.find(element => element.target == target) == undefined)
	return
    if (game.rooms[getUser(target).roomid].foodchain[game.rooms[getUser(target).roomid].foodchain.findIndex(element => element.hunter == target)].hunter == undefined)
        return

    let hunter = game.rooms[getUser(target).roomid].foodchain.find(element => element.target == target).hunter

    game.rooms[getUser(target).roomid].foodchain.splice(game.rooms[getUser(target).roomid].foodchain.findIndex(element => element.target == target), 1)
    if (game.rooms[getUser(target).roomid].foodchain[game.rooms[getUser(target).roomid].foodchain.findIndex(element => element.hunter == target)] == undefined)
	return
    game.rooms[getUser(target).roomid].foodchain[game.rooms[getUser(target).roomid].foodchain.findIndex(element => element.hunter == target)].hunter = hunter   
    game.users[getUserIndex(target)].isDead = true
}

function userDisconnected(id) {
    let user = getUser(id)
    if (user == undefined) return;

    if (user.roomid >= 0 && game.rooms[user.roomid].status == 1)
	userDied(id)
    removeUser(id)
    
    chatPosted(user.roomid, {username: "[System]", description: `${user.username} quited`})
}

function chatPosted(roomid, data) {
    if (game.rooms[roomid] == undefined) return
    game.rooms[roomid].chat.push(data)
    if(game.rooms[roomid].chat.length > 6)
	game.rooms[roomid].chat.shift()
}

function monitoring() {
    console.log(game)
}

function sendGameData() {
    game.users.forEach(element => io.to(element.id).emit("update", { 
	users: getRoomSUserList(getUser(element.id).roomid),
	room: game.rooms[element.roomid]
    }))
}

function checkGameOver() {
    game.rooms.forEach((element, index) => {	
	if (isGameOver(index)) userWon(game.users.find(element => element.roomid == index && element.isDead == false))	
    })
}

function garbageCollect() {
    if (game.rooms.length < 2)
	return;

    if (game.rooms[game.rooms.length - 1].status == 0 && game.rooms.filter((element, index) => getRoomSNumberOfUser(index) == 0).length > 1)
	game.rooms.splice(game.rooms.length - 1, 1)
}

function userWon(winner) {
    clearRoom(winner.roomid)
    getRoomSUserList(winner.roomid).forEach(element => {
	if(game.rooms[winner.roomid].option.access)
            game.users[game.users.findIndex(element => element.roomid != -2)].roomid = -2
	if (game.users.findIndex(element => element.isDead != false != -1))
	     game.users[game.users.findIndex(element => element.isDead != false)].isDead = false
    })
    emitMessagesToUsers(getRoomSUserList(winner.roomid), "gameEnd", {winner: winner})
    game.users.filter(element => element.roomid == winner.roomid).forEach(element => game.users[getUserIndex(element.id)].roomid = -2) 
}

function startGame(numberOfObjects, roomid) {
    if (game.rooms[roomid] == undefined)
	return

    game.rooms[roomid].status = 2
    game.rooms[roomid].foodchain = makeFoodchain(game.users, roomid)
    setObjects(numberOfObjects, roomid, game.rooms[roomid].map)
    emitMessagesToUsers(getRoomSUserList(roomid), "countdown", null)
    
    setTimeout(() => {
	game.rooms[roomid].status = 1
	emitMessagesToUsers(getRoomSUserList(roomid), "gameStart", game.rooms[roomid])
    }, 3500)
} 

function setObjects(numberOfObjects, roomid, map) {
    for (let i = 0; i < numberOfObjects; i++)
	putObject(roomid, map)

    putSpecialObjects(roomid)
}

function putObject(roomid, map) {
    if (map == 1) {
        let type = getRandomNumber(0, 2)
        if (type == 0)
            createObject(roomid, "block")
        else if (type == 1)
            createObject(roomid, "breakableBlock")
    } else if (map == 2) {
        let type = getRandomNumber(0, 7)
        if (type == 0)
            createObject(roomid, "block")
        else if (type == 1)
            createObject(roomid, "breakableBlock")
        else if (type == 2 || type == 3 || type == 4)
            createObject(roomid, "wood")
        else if (type == 5 || type == 6)
            createObject(roomid, "leaf")
    } else if (map == 3) {
        let type = getRandomNumber(0, 8)
        if (type == 0 || type == 1)
            createObject(roomid, "block")
        else if (type == 2 || type == 3)
            createObject(roomid, "water")
        else if (type == 4 || type == 5)
            createObject(roomid, "leaf")
        else if (type == 6 || type == 7)
            createObject(roomid, "wood")
    } else if (map == 4) {
        let type = getRandomNumber(0, 8)
        if (type == 0)
            createObject(roomid, "block")
        else if (type == 1)
            createObject(roomid, "breakableBlock")
        else if (type == 2 || type == 3)
            createObject(roomid, "cherry1")
        else if (type == 4 || type == 5)
            createObject(roomid, "cherry2")
        else if (type == 6 || type == 7)
            createObject(roomid, "flower")
    }
}

function createObject(roomid, obj) {
    let size = getRandomNumber(5, 13) / 10, x, y
    let rotation = getRandomNumber(-3141592, 3141592) / 100000
    do {
        x = getRandomNumber(0, 2400)
        y = getRandomNumber(0, 2400)
    } while(obj != "leaf" && obj != "water" && isEnablePosition(x, y, size, roomid))

    if (obj == "block") {
        game.rooms[roomid].objects.push({x, y, type:0, size, rotation})
    } else if (obj == "breakableBlock") {
        game.rooms[roomid].objects.push({x, y, type:1, size, rotation})
    } else if (obj == "leaf") {
        game.rooms[roomid].objects.push({x, y, type:2, size, rotation})
    } else if (obj == "wood") {
        size = getRandomNumber(15, 30) / 10
        game.rooms[roomid].objects.push({x, y, type:3, size:size * getRandomNumber(5, 10) / 10, rotation})
        game.rooms[roomid].objects.push({x, y, type:4, size, rotation})
    } else if (obj == "water") {
        game.rooms[roomid].objects.push({x, y, type:5, size, rotation})
    } else if (obj == "cactus") {
        game.rooms[roomid].objects.push({x, y, type:6, size, rotation})
    } else if (obj == "cherry1") {
        size = getRandomNumber(12, 24) / 10
        game.rooms[roomid].objects.push({x, y, type:3, size:size * getRandomNumber(5, 10) / 10, rotation})
        game.rooms[roomid].objects.push({x, y, type:7, size, rotation})
    } else if (obj == "cherry2") {
        size = getRandomNumber(12, 24) / 10
        game.rooms[roomid].objects.push({x, y, type:3, size:size * getRandomNumber(5, 10) / 10, rotation})
        game.rooms[roomid].objects.push({x, y, type:8, size, rotation})
    } else if (obj == "flower") {
        game.rooms[roomid].objects.push({x, y, type:9, size, rotation})
    }
}

function putSpecialObjects (roomid) {

}

function isEnablePosition (x, y, size, roomid) {
     return game.rooms[roomid].objects.concat(getRoomSUserList(roomid)).some(element => getDistanceBetween(x, y, element.x, element.y) < size * 100 + (element.size != undefined ? element.size : 0) * 100)
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

function emitMessagesToUsers(userList, messageName, messageData) {
    userList.forEach(element => io.to(element.id).emit(messageName, messageData))
}

function addMessage(roomid, userid, message) {
    game.rooms[roomid].push({userid: userid, message: message})
}

function createNewRoom(access) {
    game.rooms.push({status: 0, objects: [], foodchain: [], chat: [], option: {access, numberOfUsers: 4, numberOfObjects: 30}, map: getRandomNumber(4, 5)})
}

function clearRoom(roomid) {
    game.rooms[roomid] = {status: 0, objects: [], foodchain: [], chat: [], option: {access: 1, numberOfUsers: 4, numberOfObjects: 30}, map: getRandomNumber(4, 5)}
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

function getRandomNumber(number1, number2) {
    return Math.floor((Math.random() * Math.abs(number1 - number2)) + (number1 > number2 ? number2 : number1))
}

function getDistanceBetween(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2))
}
