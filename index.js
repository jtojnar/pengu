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
var serveStatic = require('serve-static');
app.use('/content', serveStatic(__dirname + '/content'));
app.use('/client', serveStatic(__dirname + '/client'));

var env = process.env.NODE_ENV || 'development';
if(env == 'development') {
	app.use(require('morgan')());
}


app.get('/', function(req, res){
	res.send('<script>window.location.href = "/client/client.html?u=" + encodeURIComponent(prompt("Zadej jmeno"));</script>');
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
var rooms = JSON.parse(require('fs').readFileSync(__dirname + '/content/world/map.json', 'utf8'), function (key, value) {
    var type;
    if(value && typeof value === 'object') {
        type = value._class;
        if (typeof type === 'string' && typeof poly[type] === 'function') {
            return new (poly[type])(value);
        }
    }
    return value;
});


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