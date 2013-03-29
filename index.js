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

var clients = [];
var players = {};

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
	connection.on('message', function(message) {
		if(message.type === 'utf8') {
			try {
				var json = JSON.parse(message.utf8Data);
				if(json.type == 'init' && name == null) {
					name = json.name;
					connection.sendUTF(JSON.stringify({type: 'sync', data: players}));
					players[name] = [0, 0];
					console.info('Initial handshake with ' + name);
					for(var i=0; i < clients.length; i++) {
						clients[i].sendUTF(JSON.stringify({type: 'enter', name: name}));
					}
				} else if(json.type == 'move') {
					console.log('Moving ' + name + ' to [' + json.x + ',' + json.y + ']');
					players[name] = [json.x, json.y];
					for(var i=0; i < clients.length; i++) {
						clients[i].sendUTF(JSON.stringify({type: 'move', name: name, x: json.x, y: json.y}));
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