#!/usr/bin/env node
"use strict";

process.title = 'pengu';

var WebSocketServer = require('websocket').server;
var http = require('http');
var fs = require('fs');
var url = require('url');
var express = require('express');

Object.prototype.removeItem = function (key) {
	if(!this.hasOwnProperty(key)){
		return;
	}
	if(isNaN(parseInt(key)) || !(this instanceof Array)) {
		delete this[key];
	} else {
		this.splice(key, 1);
	}
};

var app = express();

app.configure(function(){
	app.set('port', process.env.PORT || 8080);
	app.use(express.static(__dirname));
});
app.configure('development', function(){
	app.use(express.logger());
});


app.get('/', function(req, res){
	res.send('<script>window.location.href = "/client.html?u=" + encodeURIComponent(prompt("Zadej jmeno"));</script>');
});

var server = http.createServer(app).listen(app.get('port'));
console.log('Started app on port %d', app.get('port'));

var wsServer = new WebSocketServer({
	httpServer: server,
	port: 1337,
	autoAcceptConnections: false
});

function originIsAllowed(origin) {
	return true;
}

function isInPolygon(door, x, y) {
	return x >= door[0][0] && x <= door[1][0] && y >= door[0][1] && y <= door[1][1];
}
var clients = [];
var players = {};
var rooms = {
	plaza: {
		image: 'plaza.png',
		doors: [
			[[132,241], [182,322], 'bar']
		],
		zones: [
		[[19,270], [9,270], [17,263], [19,265], [83,253], [82,320], [125,320], [131,243], [189,242], [183,323], [227,325], [240,229], [315,244], [300,341], [365,334], [368,261], [428,257], [417,339], [455,342], [473,237], [546,259], [485,341], [585,304], [611,365], [665,345], [733,403], [772,391], [732,277], [800,294], [784,296], [797,599], [788,589], [786,594], [776,599], [781,586], [792,581], [785,579], [780,581], [359,589], [366,577], [445,528], [393,457], [309,466], [234,510], [235,546], [287,598], [277,581], [281,599], [18,590], [17,583], [13,273], [17,278]]
		]
	},
	bar: {
		image: 'bar.png',
		doors: [
			[[417,138], [516,309], 'plaza']
		],
		zones: [
		[[19,270], [9,270], [17,263], [19,265], [83,253], [82,320], [125,320], [131,243], [189,242], [183,323], [227,325], [240,229], [315,244], [300,341], [365,334], [368,261], [428,257], [417,339], [455,342], [473,237], [546,259], [485,341], [585,304], [611,365], [665,345], [733,403], [772,391], [732,277], [800,294], [784,296], [797,599], [788,589], [786,594], [776,599], [781,586], [792,581], [785,579], [780,581], [359,589], [366,577], [445,528], [393,457], [309,466], [234,510], [235,546], [287,598], [277,581], [281,599], [18,590], [17,583], [13,273], [17,278]]
		]
	}
}

wsServer.on('request', function(request) {
	if (!originIsAllowed(request.origin)) {
		request.reject();
		console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
		return;
	}

	var connection = request.accept(null, request.origin);
	var index = clients.push(connection) - 1;
	console.log((new Date()) + ' Connection accepted.');
	var name = null;
	var room = 'plaza';
	connection.on('message', function(message) {
		if(message.type === 'utf8') {
			try {
				var json = JSON.parse(message.utf8Data);
				if(json.type == 'init' && name == null) {
					name = json.name;
					connection.sendUTF(JSON.stringify({type: 'sync', name: name, data: players}));
					players[name] = [0, 0];
					console.info('Initial handshake with ' + name);
					for(var i=0; i < clients.length; i++) {
						clients[i].sendUTF(JSON.stringify({type: 'enter', name: name}));
					}
				} else if(json.type == 'move') {
					var travel = false;
					for(var key in rooms[room].doors){
						if(!rooms[room].doors.hasOwnProperty(key)) continue;
						var door = rooms[room].doors[key];
						if(isInPolygon(door, json.x, json.y)) {
							travel = true;
							console.log(name + ' jumped to ' + door[2]);
							room = door[2];
							players[name] = [json.x, json.y, door[2]];
							for(var i=0; i < clients.length; i++) {
								clients[i].sendUTF(JSON.stringify({type: 'travel', name: name, room: door[2], image: rooms[door[2]].image}));
							}
						}
					}
					if(!travel){
						console.log('Moving ' + name + ' to [' + json.x + ',' + json.y + ']');
						players[name] = [json.x, json.y, players[name][2]];
						for(var i=0; i < clients.length; i++) {
							clients[i].sendUTF(JSON.stringify({type: 'move', name: name, x: json.x, y: json.y}));
						}
					}
				}
			} catch(ex) {
				console.error(ex);
			}
			// connection.sendUTF(message.utf8Data);
		}
	});
	connection.on('close', function(reasonCode, description) {
		clients.removeItem(index);
		players.removeItem(name);
		console.log((new Date()) + ' Peer ' + connection.remoteAddress + '(' + name + ') disconnected.');
		for(var i=0; i < clients.length; i++) {
			clients[i].sendUTF(JSON.stringify({type: 'exit', name: name}));
		}
	});
});