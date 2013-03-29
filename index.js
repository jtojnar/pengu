#!/usr/bin/env node
"use strict";

process.title = 'pengu';

var WebSocketServer = require('websocket').server;
var http = require('http');
var fs = require('fs');
var url = require('url');
var host = process.env.SUBDOMAIN ? process.env.SUBDOMAIN + '.nodejitsu.com' : 'localhost';
var  port = 8080;

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

var server = http.createServer(function(request, response) {
	var path = url.parse(request.url).pathname;
	if(path == '/') {
		response.writeHead(200, { 'Content-Type': 'text/html' });
		response.end('<script>window.location.href = "/chat?u=" + encodeURIComponent(prompt("Zadej jmeno"));</script>', 'utf-8');
	} else if(path == '/chat') {
		fs.readFile(__dirname + '/client.html', function(error, content) {
			if(error) {
				console.error(error);
				response.writeHead(500);
				response.end();
			} else {
				response.writeHead(200, { 'Content-Type': 'text/html' });
				response.end(content, 'utf-8');
			}
		});
	} else if(path == '/client.js') {
		fs.readFile(__dirname + '/client.js', function(error, content) {
			if(error) {
				console.error(error);
				response.writeHead(500);
				response.end();
			} else {
				response.writeHead(200, { 'Content-Type': 'text/javascript' });
				response.end(content.toString().replace('%url%', host + ':' + port), 'utf-8');
			}
		});
	} else if(path == '/tux.png') {
		fs.readFile(__dirname + '/tux.png', function(error, content) {
			if(error) {
				console.error(error);
				response.writeHead(500);
				response.end();
			} else {
				response.writeHead(200, { 'Content-Type': 'image/png' });
				response.end(content, 'utf-8');
			}
		});
	} else {
		console.log((new Date()) + ' Received request for ' + path);
		response.writeHead(404);
		response.end();
	}
});
server.listen(port, function() {
	console.log((new Date()) + ' Server is listening on port ' + port);
});

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