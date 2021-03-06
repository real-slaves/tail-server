const express = require('express')
const app = express()
const server = app.listen(80)
const io = require('socket.io').listen(server)

app.use(express.static('./DiCon2018'))

//----------------------------------------------------------------------------------------------------------------------------------------------------------------------------//

const game = {
    users: [],
    rooms: []
}

createNewRoom()

io.set('origins', '*:*')
io.on('connection', socket => {
    socket.on("getRoomList", data => sendRoomList(socket.id))
    socket.on("join", data => join(data.access, socket.id, data.roomid, data.password, data.username))
    socket.on("update", data => updateUser(socket.id, data))
    socket.on("died", data => userDied(data.target))
    socket.on("disconnect", data => userDisconnected(socket.id))
    socket.on("chatPost", data => { if (getUser(socket.id) != undefined) chatPosted(getUser(socket.id).roomid, data)})
    socket.on("addTail", data => emitMessageToTheUser(data.target, "addTail", {}))
    socket.on("getAllData", data => emitMessageToTheUser(socket.id, "allData", game))
    socket.on("blockCollision", data => blockCollision(data))
    socket.on("createCustomRoom", data => emitMessageToTheUser(socket.id, "roomCreated", createNewCustomRoom(data)))
})

setInterval(() => {
    sendGameData()
    checkGameOver()
    garbageCollect()
}, 35)

setInterval(() => {
    monitoring()
}, 500)

//----------------------------------------------------------------------------------------------------------------------------------------------------------------------------//

function garbageCollect() {
    if (game.rooms.length < 2)
	return;

    if (game.rooms[game.rooms.length - 1].status == 0 && game.rooms[game.rooms.length - 1].option.access == 1 && game.rooms.filter((element, index) => getRoomSNumberOfUser(index) == 0 && game.rooms[index].option.access == 1).length > 1)
	game.rooms.splice(game.rooms.length - 1, 1)
}

function blockCollision(block) {
    if (game.rooms[block.roomid] == undefined) return
    if (game.rooms[block.roomid].objects[block.index] == undefined) return
    if (game.rooms[block.roomid].objects[block.index].size > 0) game.rooms[block.roomid].objects[block.index].size -= 0.1
    else game.rooms[block.roomid].objects.splice(block.index, 1)
}

function join(access, id, roomid, password, username) {
    if (access == 1) {
	let roomIndex = game.rooms.findIndex(element => element.status == 0 && element.option.access == 1)
	if (game.rooms[roomIndex] == undefined || roomIndex < 0) {
	    emitMessageToTheUser(id, "joinFailed", {error: 5})
	    return
	}
	if (game.users.find(element => element.id == id) == undefined) {
	     game.users.push({x: 0, y: 0, id, rotation: 0, tail: [], roomid: roomIndex, isDead: false, username: ""})
	} else {
	     game.users[getUserIndex(id)].roomid = roomIndex
	     game.users[getUserIndex(id)].isDead = false
	}
	game.rooms[roomIndex].userInfo.push({id, kill: 0})

	if (getRoomSNumberOfUser(roomIndex) == game.rooms[roomIndex].option.numberOfUsers || roomIndex == -1) {	
            startGame(game.rooms[roomIndex].option.numberOfObjects, roomIndex)
            if (game.rooms.findIndex(element => element.status == 0 && element.option.access == 1) == -1)
		createNewRoom()
	}
	setTimeout(() => chatPosted(roomIndex, {username: "[System]",description: `${getUser(id).username} joined`}), 500)
    } else {
	if (game.rooms.length <= roomid) {
	    emitMessageToTheUser(id, "joinFailed", {error: 1})
	    return
	}
        if (game.rooms[roomid] == undefined) {
	    emitMessageToTheUser(id, "joinFailed", {error: 5})
	    return
	}
	if (game.rooms[roomid].option == undefined) {
	    emitMessageToTheUser(id, "joinFailed", {error: 5})
	    return
	}
	if (game.rooms[roomid].option.access == 1) {
	    emitMessageToTheUser(id, "joinFailed", {error: 4})
	    return
	}
	if (game.rooms[roomid].option.password != password && getRoomSNumberOfUser(roomid) > 0) {
	    emitMessageToTheUser(id, "joinFailed", {error: 2})
	    return
	}
	if (game.rooms[roomid].status == 0) {
	    if (game.users.find(element => element.id == id) == undefined) {
		game.users.push({x: 0, y: 0, id, rotation: 0, tail: [], roomid, isDead: false, username: ""})
	    } else {	
		game.users[getUserIndex(id)].roomid = roomid
		game.users[getUserIndex(id)].isDead = false
	    }

	    if (getRoomSNumberOfUser(roomid) == game.rooms[roomid].option.numberOfUsers)
		startGame(game.rooms[roomid].option.numberOfObjects, roomid)
	    
	    if (getUser(id) != undefined)
		setTimeout(() => chatPosted(roomid, {username: "[System]", description: `${username} joined`}), 500)
	    game.rooms[roomid].userInfo.push({id, kill: 0})
	    emitMessageToTheUser(id, "joinSuccess", {})
	} else {
	    emitMessageToTheUser(id, "joinFailed", {error: 3})
	}
    }
}

function updateUser(id, data) {
    let userIndex = getUserIndex(id)
    game.users[userIndex] = data
    game.users[userIndex].id = id
}

function userDied(target) {
    if (getUser(target) == undefined)
	return
    if (game.rooms[getUser(target).roomid] == undefined)
	return
    if (game.rooms[getUser(target).roomid].foodchain.find(element => element.target == target) == undefined)
	return
    if (game.rooms[getUser(target).roomid].foodchain[game.rooms[getUser(target).roomid].foodchain.findIndex(element => element.hunter == target)].hunter == undefined)
        return

    let hunter = game.rooms[getUser(target).roomid].foodchain.find(element => element.target == target).hunter

    if (getUser(hunter) == undefined)
	return
    if (getUser(hunter).isDead == true)
	return

    emitMessagesToUsers(getRoomSUserList(getUser(target).roomid), "died", {id: target, x: getUser(target).x, y: getUser(target).y})
    chatPosted(getUser(target).roomid, {username: "[System]", description: getUser(target).username + " was slained"})

    if(game.rooms[getUser(target).roomid].userInfo[game.rooms[getUser(target).roomid].userInfo.findIndex(element => element.id == hunter)] != undefined)
	game.rooms[getUser(target).roomid].userInfo[game.rooms[getUser(target).roomid].userInfo.findIndex(element => element.id == hunter)].kill++
    
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
    if (roomid < 0) return
    game.rooms[roomid].chat.push(data)
    if(game.rooms[roomid].chat.length > 6)
	game.rooms[roomid].chat.shift()
}

function monitoring() {
    console.log(game)
}

function sendGameData() {
    game.users.filter(element => element.roomid >= 0 ).forEach(element => emitMessageToTheUser(element.id, "update", { 
	users: getRoomSUserList(getUser(element.id).roomid),
	room: game.rooms[element.roomid]
    }))
}

function checkGameOver() {
    game.rooms.forEach((element, index) => {	
	if (index >= 0 && isGameOver(index)) userWon(game.users.find(element => element.roomid == index && element.roomid >= 0 && element.isDead == false))	
    })
}

function userWon(winner) {
    if (winner.roomid < 0)
    	return

    if (game.rooms[winner.roomid] != undefined)
	emitMessagesToUsers(getRoomSUserList(winner.roomid), "gameEnd", {winner: winner, userInfo: game.rooms[winner.roomid].userInfo})
    
    clearRoom(winner.roomid)
    createNewRoom()
    
    game.users.filter(element => element.roomid == winner.roomid).forEach(element => game.users[getUserIndex(element.id)].roomid = -2)
    sendGameData()
}

function startGame(numberOfObjects, roomid) {
    if (game.rooms[roomid] == undefined)
	return

    game.rooms[roomid].foodchain = makeFoodchain(game.users, roomid)
    setObjects(numberOfObjects, roomid, game.rooms[roomid].map)
	game.rooms[roomid].status = 1
	emitMessagesToUsers(getRoomSUserList(roomid), "gameStart", game.rooms[roomid])
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
        x = getRandomNumber(0, game.rooms[roomid].option.mapSize)
        y = getRandomNumber(0, game.rooms[roomid].option.mapSize)
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
	game.users[game.users.findIndex(element => element.roomid == -1)].roomid = -4

    game.users.splice(getUserIndex(id), 1)
}

function emitMessagesToUsers(userList, messageName, messageData) {
    userList.forEach(element => emitMessageToTheUser(element.id, messageName, messageData))
}

function emitMessageToTheUser(userid, messageName, messageData) {
    io.to(userid).emit(messageName, messageData)
}

function addMessage(roomid, userid, message) {
    game.rooms[roomid].push({userid: userid, message: message})
}

function createNewRoom() {
    game.rooms.push({status: 0, objects: [], foodchain: [], chat: [], userInfo: [], option: {access: 1, numberOfUsers: 6, numberOfObjects: 30, mapCodeFixed: false, password: null, mapSize: 2400}, map: getRandomNumber(1, 5)})
    return game.rooms.length - 1
}

function createNewCustomRoom(option) {
    let roomIndex = createNewRoom()
    game.rooms[roomIndex].option = option
    game.rooms[roomIndex].option.access = 0
    game.rooms[roomIndex].option.password = getRandomNumber(1, 100000)
    if (option.mapCodeFixed)
	game.rooms[roomIndex].map = option.map
    return {roomid: roomIndex, password: game.rooms[roomIndex].option.password}
}

function clearRoom(roomid) {
    let access = game.rooms[roomid].option.access
    if (game.rooms[roomid].option.mapCodeFixed == false)
	game.rooms[roomid].map = getRandomNumber(1, 5)   

    game.rooms[roomid].status = 0
    game.rooms[roomid].foodchain = []
    game.rooms[roomid].objects = []
    game.rooms[roomid].userInfo = []
    game.rooms[roomid].chat = []
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
    return game.users.filter(element => element.roomid == roomid && element.isDead == false).length == 1 && game.rooms[roomid].status == 1 && roomid >= 0
}

function getRandomNumber(number1, number2) {
    return Math.floor((Math.random() * Math.abs(number1 - number2)) + (number1 > number2 ? number2 : number1))
}

function getDistanceBetween(x1, y1, x2, y2) {
    return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2))
}
