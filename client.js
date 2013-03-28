"use strict";
function getParameterByName(name) {
	name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
	var regexS = "[\\?&]" + name + "=([^&#]*)";
	var regex = new RegExp(regexS);
	var results = regex.exec(window.location.search);
	if(results == null) {
		return "";
	} else {
		return decodeURIComponent(results[1].replace(/\+/g, " "));
	}
}

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

$(function () {
	var view = $('#view');
	var myName = null;
	var players = {};

	window.WebSocket = window.WebSocket || window.MozWebSocket;

	if(!window.WebSocket) {
		name.html('Smůla, tvůj prohlížeč nepodporuje WebSockets.');
		return;
	}

	var connection = new WebSocket('ws://62.245.110.102:8080', 'pengu');

	connection.onopen = function () {
		connection.send(JSON.stringify({type: 'init', name: getParameterByName('u')}));
	};

	connection.onerror = function (error) {
		view.html('<p>Promiň, nefunguje server nebo tvé připojení.</p>');
	};

	// most important part - incoming messages
	connection.onmessage = function (message) {
		// try to parse JSON message. Because we know that the server always returns
		// JSON this should work without any problem but we should make sure that
		// the massage is not chunked or otherwise damaged.
		try {
			var json = JSON.parse(message.data);
		} catch(e) {
			console.log('This doesn\'t look like a valid JSON: ', message.data);
			return;
		}
		if(json.type === 'sync') { // first response from the server with user's color
			console.log(json.data);
			for(var key in json.data) {
				if(json.data.hasOwnProperty(key)){
					addPlayer(key, json.data[key][0], json.data[key][1]);
					movePlayer(key, json.data[key][0], json.data[key][1]);
				}
			}
		} else if(json.type === 'enter') {
			addPlayer(json.name);
		} else if(json.type === 'exit') {
			removePlayer(json.name);
		} else if(json.type === 'move') {
			movePlayer(json.name, json.x, json.y);
		} else {
			console.log('Hmm..., I\'ve never seen JSON like this: ', json);
		}
	};

	view.click(function(e) {
		connection.send(JSON.stringify({type: 'move', x: e.pageX - $(this).offset().left, y: e.pageY - $(this).offset().top}));
	});

	/**
	 * This method is optional. If the server wasn't able to respond to the
	 * in 3 seconds then show some error message to notify the user that
	 * something is wrong.
	 */
	var monitor = setInterval(function() {
		if(connection.readyState !== 1) {
			clearInterval(monitor);
			alert('Nelze komunikovat s WebSocket serverem.');
		}
	}, 3000);

	/**
	 * Add message to the chat window
	 */
	function addPlayer(name) {
		players[name] = $('<div data-name="'+name+'" class="penguin"></div>');
		view.append(players[name]);
	}
	function movePlayer(name, x, y) {
		if(16 <= x && x <= view.width() - 16 && 16 <= y && y <= view.height() - 16)
		players[name].css({top: y, left:x});
	}
	function removePlayer(name) {
		players[name].remove();
		players.removeItem(name);
	}
});