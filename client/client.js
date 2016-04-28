'use strict';
/* eslint-env browser, jquery */

function removeItemNamed(object, key) {
	if (!object.hasOwnProperty(key)){
		return;
	}
	if (isNaN(parseInt(key)) || !(object instanceof Array)) {
		delete object[key];
	} else {
		object.splice(key, 1);
	}
}

function findById(arr, id) {
	for (var i = 0; i < arr.length; i++) {
		if (arr[i].id === id) {
			return arr[i];
		}
	}
	return false;
}

$(function () {
	var debugMode = localStorage.getItem('debug') === '1';

	var view = $('#view');
	var overlay = $('<div id="overlay"><div class="spinner">Načítání…</div></div>');
	view.parent().append(overlay);
	var map = null;
	var items = null;
	var itemsLoaded = new $.Deferred();
	var myName = null;
	var myRoom = 'plaza';
	var myCloset = [];
	var audio = $('<audio loop="loop"></audio>');
	view.append(audio);
	var canvas = $('<canvas width="800" height="600"></canvas>');
	var ctx = canvas.get(0).getContext('2d');
	view.append(canvas);

	var log = $('<div class="log dialogue"><h2 class="dialogue-header">Záznam chatu</h2><a href="#" class="close">×</a><div class="dialogue-inner"></div></div>');
	view.append(log);
	$('.log .dialogue-inner').vertiscroll({ width: 5, color: '#f07', footer: 0 });
	log.hide();
	$('.log').click(function stopPropagation(e) {
		e.preventDefault();
		e.stopPropagation();
	});
	$('.log .close').click(function hideLog(e) {
		$(this).parent().hide();
	});
	$('#toggleLog').click(function toggleLog(e) {
		$('.log').toggle();
		e.preventDefault();
		e.stopPropagation();
	});

	var inventory = $('<div class="inventory dialogue"><h2 class="dialogue-header">Šatník</h2><a href="#" class="close">×</a><div class="dialogue-inner"></div></div>');
	view.append(inventory);
	$('.inventory .dialogue-inner').vertiscroll({ width: 5, color: '#f07', footer: 0 });
	itemsLoaded.done(fillInventory);
	$('.inventory .dialogue-inner').delegate('img', 'click', function inventoryItemClicked(e) {
		connection.send(JSON.stringify({type: 'dress', itemId: $(this).attr('data-item')}));
	});
	inventory.hide();
	$('.inventory').click(function stopPropagation(e) {
		e.preventDefault();
		e.stopPropagation();
	});
	$('.inventory .close').click(function hideInventory(e) {
		$(this).parent().hide();
	});
	$('#toggleInventory').click(function toggleInventory(e) {
		$('.inventory').toggle();
		e.preventDefault();
		e.stopPropagation();
	});

	var draggedDialogue = null;
	var dragOffset = {top: 0, left: 0};

	$(document.body).on('mousemove', function(e) {
		if (draggedDialogue) {
			draggedDialogue.offset({
				top: e.pageY - dragOffset.top,
				left: e.pageX - dragOffset.left
			});
		}
	});


	$(document.body).on('mousedown', '.dialogue-header', function (e) {
		draggedDialogue = $(e.target).parents('.dialogue');
		dragOffset = {
			top:e.pageY -  draggedDialogue.offset().top,
			left: e.pageX - draggedDialogue.offset().left
		}
	});

	$(document.body).on('mouseup', function (e) {
		draggedDialogue = null;
	});

	$('#toggleMusic').click(function toggleMusic(e) {
		audio.get(0).muted = !audio.get(0).muted;
		if (audio.get(0).muted) {
			$(this).find('img').attr('src', '/client/unmute-button.png');
		} else {
			$(this).find('img').attr('src', '/client/mute-button.png');
		}
		e.preventDefault();
		e.stopPropagation();
	});

	var myLayers = [];
	var speed = 150; // px per sec
	var players = {};
	var msgTimeouts = {};

	window.WebSocket = window.WebSocket || window.MozWebSocket;

	if (!window.WebSocket) {
		view.html('Smůla, tvůj prohlížeč nepodporuje WebSockets.');
		return;
	}

	var connection = new WebSocket('ws://' + window.location.hostname + (window.location.port === '' ? '' : ':' + window.location.port));

	connection.onopen = function () {
		connection.send(JSON.stringify({type: 'init'}));
		var mapLoaded = $.getJSON('/content/world/map.json').done(function(data){
			map = data;
		});
		$.getJSON('/content/items/items.json').done(function(data){
			items = data;
		}).done(itemsLoaded.resolve);
		$.when(mapLoaded, itemsLoaded).done(function() {
			loadRoom();
		}).fail(function() {
			alert('Načítání selhalo. Zkus prosím obnovit stránku.');
		});
	};

	connection.onclose = function(e) {
		clearInterval(monitor);
		alert(e.reason);
		if (e.code === 4001 || e.code === 4002) {
			window.location.href = '/';
		}
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
		} catch (e) {
			console.log('This doesn\'t look like a valid JSON: ', message.data);
			return;
		}
		console.log(json);
		if (json.type === 'sync') {
			myName = json.name;
			for (var key in json.data) {
				if (json.data.hasOwnProperty(key)){
					addPlayer(key, json.data[key].room, json.data[key].x, json.data[key].y);
					itemsLoaded.done(function() {
						dressPlayer(key, json.data[key].clothing);
					});
				}
			}
		} else if (json.type === 'enter') {
			addPlayer(json.name, json.room, json.x, json.y);
			itemsLoaded.done(function() {
				dressPlayer(json.name, json.clothing);
			});
		} else if (json.type === 'exit') {
			removePlayer(json.name);
		} else if (json.type === 'move') {
			if (json.travel) {
				movePlayer(json.name, json.x, json.y, json.travel, json.newX, json.newY);
			} else {
				movePlayer(json.name, json.x, json.y);
			}
		} else if (json.type === 'say') {
			var scrollDown = false;
			if (($('.log .dialogue-inner').scrollTop() + $('.log .dialogue-inner').height()) === $('.log .dialogue-inner').get(0).scrollHeight) {
				scrollDown = true;
			}
			$('.log .dialogue-inner').append($('<p><strong>' + json.name + '</strong> </p>').append(document.createTextNode(json.text)));
			if (scrollDown) {
				$('.log .dialogue-inner').scrollTop($('.log .dialogue-inner').get(0).scrollHeight);
			}

			speakForPlayer(json.name, json.text);
		} else if (json.type === 'dress') {
			itemsLoaded.done(function() {
				dressPlayer(json.name, json.clothing);
			});
		} else if (json.type === 'syncCloset') {
			itemsLoaded.done(function() {
				myCloset = json.closet;
				fillInventory();
			});
		} else if (json.type === 'error') {
			alert(json.message);
		} else {
			console.log('Hmm..., I\'ve never seen JSON like this: ', json);
		}
	};

	view.click(function(e) {
		connection.send(JSON.stringify({type: 'move', x: e.pageX - $(this).offset().left, y: e.pageY - $(this).offset().top}));
	});

	$('#message').keydown(function(e) {
		if (e.keyCode === 13 && $(this).val().trim() !== ''){
			connection.send(JSON.stringify({type: 'message', text: $(this).val().trim()}));
			$(this).val('');
		}
	});

	var monitor = setInterval(function() {
		if (connection.readyState !== 1) {
			clearInterval(monitor);
			alert('Nelze komunikovat s WebSocket serverem.');
		}
	}, 3000);

	function addPlayer(name, room, x, y) {
		players[name] = $('<div data-name="' + name + '" data-room="' + room + '" class="penguin"><div class="message"><p>I am a penguin eating zebra filled with bubblegum</p></div></div>');
		if (typeof x !== 'undefined') {
			changePlayerPosition(name, x, y);
		}
		if (room === myRoom) {
			showPlayer(name);
		}
	}
	function showPlayer(name) {
		view.append(players[name]);
	}
	function movePlayer(name, x, y, room, newX, newY) {
		// if (16 <= x && x <= view.width() - 16 && 16 <= y && y <= view.height() - 16)
		var left = players[name].position().left;
		var top = players[name].position().top;
		var distance = Math.sqrt(Math.pow(left - x, 2) + Math.pow(top - y, 2));

		var handler = function() {};
		if (typeof room !== 'undefined') {
			players[name].attr('data-room', room);
			if (name === myName) {
				handler = function() {
					myRoom = room;
					loadRoom();
					changePlayerPosition(myName, newX, newY);
					for (var key in players) {
						if (players.hasOwnProperty(key)){
							if (players[key].attr('data-room') === myRoom) {
								showPlayer(key);
							} else {
								hidePlayer(key);
							}
						}
					}
				};
			} else {
				if (room === myRoom) {
					handler = false;
					changePlayerPosition(name, newX, newY);
					showPlayer(name);
				} else {
					handler = function() {
						changePlayerPosition(name, newX, newY);
						hidePlayer(name);
					};
				}
			}
		}
		if (handler !== false) {
			players[name].animate({top: y, left: x}, distance / speed * 1000, 'linear', handler);
		}
	}
	function removePlayer(name) {
		hidePlayer(name);
		removeItemNamed(players, name);
	}
	function hidePlayer(name) {
		players[name].remove();
	}
	function speakForPlayer(name, message) {
		if (msgTimeouts[name]) {
			clearTimeout(msgTimeouts[name]);
		}
		msgTimeouts[name] = setTimeout(function() {
			players[name].find('.message').hide();
		}, 5000);
		players[name].find('.message').show().find('p').text(message);
	}
	function changePlayerPosition(name, x, y) {
		players[name].css({top: y, left: x});
	}
	function dressPlayer(name, clothing) {
		players[name].find('img.clothing').remove();
		console.log(clothing);
		for (var i = 0; i < clothing.length; i++) {
			var item = findById(items, clothing[i]);
			var offset = {};

			if (item.offset) {
				if (item.offset.left) {
					offset.left = item.offset.left;
				}
				if (item.offset.top) {
					offset.top = item.offset.top;
				}
			}

			players[name].append($('<img src="/content/items/' + item.file + '" class="clothing">').css(offset));
		}
	}
	function fillInventory() {
		$('.inventory .dialogue-inner img').remove();
		for (var item in myCloset) {
			if (myCloset.hasOwnProperty(item)) {
				var itemData = findById(items, parseInt(item));
				var item = $('<img src="/content/items/paper/' + itemData.id + '.png" width="50" height="50" alt="" title="' + itemData.title + '" data-item="' + itemData.id + '">');
				$('.inventory .dialogue-inner').append(item);
			}
		}
		$('.inventory .dialogue-inner').vertiscroll({ width: 5, color: '#f07' });
	}

	function loadRoom() {
		var promises = [];
		overlay.show();
		audio.get(0).pause();
		if (typeof map[myRoom].ambiance !== 'undefined') {
			audio.attr('src', '/content/world/' + map[myRoom].ambiance);
			audio.get(0).play();
		}
		for (var layer in myLayers) {
			myLayers[layer].remove();
		}
		myLayers = [];
		for (var layerdata in map[myRoom].layers) {
			var layerdata = map[myRoom].layers[layerdata];
			var layer = $('<img class="layer">');
			layer.css({
				'width': layerdata.width,
				'height': layerdata.height,
				'left': layerdata.x,
				'top': layerdata.y,
				'z-index': typeof layerdata.z !== 'undefined' ? layerdata.z : 200
			});

			var p = $.Deferred();
			layer.on('load', p.resolve);
			layer.on('error', p.resolve);
			promises.push(p);

			layer.attr('src', '/content/world/' + layerdata.file);

			if (layerdata.alternate) {
				layer.hide();
			}

			if (layerdata.item) {
				layer.addClass('item');
				layer.attr('data-item', layerdata.item);
				layer.click(function itemClicked(e) {
					var itemId = $(this).attr('data-item');
					if (confirm('Opravdu chceš získat ' + findById(items, parseInt(itemId)).title)) {
						connection.send(JSON.stringify({type: 'addItem', itemId: itemId}));
					}
					e.stopPropagation();
				});
			}

			myLayers.push(layer);
			view.append(layer);
		}

		if (debugMode) {
			ctx.lineWidth = 3;
			ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
			for (var zonedata in map[myRoom].zones) {
				var zonedata = map[myRoom].zones[zonedata];
				ctx.beginPath();
				ctx.strokeStyle = {floor: '#a6d924', door: '#a924d9', obstacle: '#d92463', sound: '#0075ff', animate: '#ffd200'}[zonedata[1]];
				ctx.moveTo(zonedata[0].points[0].x, zonedata[0].points[0].y);
				for (var i = 0; i < zonedata[0].points.length; i++) {
					ctx.lineTo(zonedata[0].points[i].x, zonedata[0].points[i].y);
				}
				if (zonedata[0]._class === 'Polygon') {
					ctx.lineTo(zonedata[0].points[0].x, zonedata[0].points[0].y);
				}
				ctx.stroke();
				ctx.closePath();
			}
			ctx.beginPath();
			ctx.strokeStyle = '#06d2d4';
			ctx.moveTo(map[myRoom].spawn.x, map[myRoom].spawn.y - 6);
			ctx.lineTo(map[myRoom].spawn.x + Math.sqrt(45), map[myRoom].spawn.y + 3);
			ctx.lineTo(map[myRoom].spawn.x - Math.sqrt(45), map[myRoom].spawn.y + 3);
			ctx.lineTo(map[myRoom].spawn.x, map[myRoom].spawn.y - 6);
			ctx.stroke();
		}

		$.when.apply($, promises).then(function() {
			overlay.hide();
		});
	}
});
