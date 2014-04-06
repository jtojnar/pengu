#!/usr/bin/env node
"use strict";

process.title = 'pengu';

var WebSocketServer = require('websocket').server;
var http = require('http');
var fs = require('fs');
var url = require('url');
var express = require('express');
var poly = require('./poly');
var Point = poly.Point;
var Polygon = poly.Polygon;
var Line = poly.Line;

Object.prototype.removeItem = function(key) {
	if(!this.hasOwnProperty(key)){
		return;
	}
	if(isNaN(parseInt(key)) || !(this instanceof Array)) {
		delete this[key];
	} else {
		this.splice(key, 1);
	}
};
Array.prototype.pushArray = function(arr) {
	this.push.apply(this, arr);
};

var app = express();

app.set('port', process.env.PORT || 8080);
app.use(require('serve-static')(__dirname));

var env = process.env.NODE_ENV || 'development';
if(env == 'development') {
	app.use(require('morgan')());
}


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

// function isInRect(door, x, y) {
// 	return x >= door[0][0] && x <= door[1][0] && y >= door[0][1] && y <= door[1][1];
// }

function getTarget(room, line) {
	var gap = 5;
	var intersections = [];
	for(var i = room.zones.length - 1; i >= 0; i--) {
		var zone = room.zones[i];
		if(zone[1] == 'floor' || zone[1] == 'obstacle') {
			intersections.pushArray(zone[0].getIntersections(line));
		}
	}
	if(intersections.length > 0){
		var closest = null, closestDistance;
		for(var i = intersections.length - 1; i >= 0; i--) {
			var intersection = intersections[i];
			var distance = line.start.getDistance(intersection);
			if(!closest || closestDistance > distance) {
				closestDistance = distance;
				closest = intersection;
			}
		}
	} else {
		closest = line.end;
	}
	closest.x += gap / line.getLength() * (line.start.x - line.end.x);
	closest.y += gap / line.getLength() * (line.start.y - line.end.y);
	return closest;
}

var clients = [];
var players = {};
var rooms = {
	plaza: {
		image: 'plaza.png',
		spawn: new Point(270, 370),
		zones: [
			[new Polygon(new Point(0,267), new Point(248,225), new Point(537,253), new Point(799,291), new Point(799,599), new Point(0,599)), 'floor'],
			[new Polygon(new Point(120,314), new Point(119,329), new Point(186,334), new Point(188,316)), 'door', 'bar'],
			[new Polygon(new Point(358,327), new Point(354,342), new Point(425,345), new Point(426,328)), 'door', 'chom'],
			[new Polygon(new Point(243,526), new Point(263,487), new Point(341,457), new Point(395,465), new Point(441,501), new Point(428,551), new Point(311,579), new Point(264,562)), 'obstacle'], //fountain
			[new Polygon(new Point(84,255), new Point(77,318), new Point(225,319), new Point(235,228)), 'obstacle'], //house1
			[new Polygon(new Point(313,232), new Point(296,329), new Point(454,337), new Point(468,247)), 'obstacle'], //house2
			[new Polygon(new Point(549,254), new Point(492,306), new Point(489,344), new Point(534,332), new Point(592,292), new Point(608,363), new Point(635,372), new Point(659,334), new Point(711,391), new Point(740,393), new Point(774,386), new Point(733,310), new Point(737,284)), 'obstacle'], //blob
		],
	},
	bar: {
		image: 'bar.png',
		spawn: new Point(450, 330),
		zones: [
			[new Polygon(new Point(153,291), new Point(0,571), new Point(0,599), new Point(799,599), new Point(799,331)), 'floor'],
			[new Polygon(new Point(407,298), new Point(398,332), new Point(535,346), new Point(536,305)), 'door', 'plaza'],
			[new Polygon(new Point(594,315), new Point(596,348), new Point(698,348), new Point(689,312)), 'sound', 'piano'],
			[new Polygon(new Point(154,505), new Point(295,509), new Point(400,306), new Point(255,296)), 'obstacle'], //bar
		]
	},
	chom: {
		image: 'chom.png',
		spawn: new Point(360, 540),
		zones: [
			[new Polygon(new Point(0,470), new Point(256,471), new Point(296,521), new Point(426,527), new Point(391,476), new Point(799,469), new Point(799,599), new Point(0,599)), 'floor'],
			[new Polygon(new Point(298,508), new Point(292,543), new Point(441,555), new Point(438,512)), 'door', 'plaza'],
			[new Polygon(new Point(550,539), new Point(563,504), new Point(691,492), new Point(712,524)), 'obstacle'], //blue
			[new Polygon(new Point(70,508), new Point(179,511), new Point(196,543), new Point(48,546)), 'obstacle'], //pink
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
				console.log(json);
				if(json.type == 'init' && name == null) {
					name = json.name;
					connection.sendUTF(JSON.stringify({type: 'sync', name: name, data: players}));
					players[name] = [550, 500, 'plaza'];
					console.info('Initial handshake with ' + name);
					for(var i=0; i < clients.length; i++) {
						clients[i].sendUTF(JSON.stringify({type: 'enter', name: name, room: players[name][2], x: players[name][0], y:players[name][1]}));
					}
				} else if(json.type == 'move') {
					var travel = false;
					var target = getTarget(rooms[room], new Line(new Point(players[name][0], players[name][1]), new Point(json.x, json.y)));
					if(rooms[room].zones[0][0].containsPoint(target)) {
						console.log('Moving ' + name + ' to ' + target);
						players[name] = [target.x, target.y, players[name][2]];
						for(var i=0; i< rooms[room].zones.length; i++) {
							var zone = rooms[room].zones[i];
							if(zone[1] == 'door' && zone[0].containsPoint(target)) {
								room = travel = zone[2];
								console.log(name + ' goes to ' + travel);
								players[name][2] = travel;
								break;
							}
						}
						var msg = {type: 'move', name: name, x: players[name][0], y: players[name][1]};
						if(travel) {
							msg.travel = travel;
							players[name][0] = msg.newX = rooms[travel].spawn.x;
							players[name][1] = msg.newY = rooms[travel].spawn.y;
						}
						for(var i=0; i < clients.length; i++) {
							clients[i].sendUTF(JSON.stringify(msg));
						}
					}
				} else if(json.type == 'message') {
					console.log(name + ' said ' + json.text);
					for(var i=0; i < clients.length; i++) {
						clients[i].sendUTF(JSON.stringify({type: 'say', name: name, text: json.text}));
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