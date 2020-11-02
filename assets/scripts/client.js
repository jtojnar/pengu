import React from 'jsx-dom'; // eslint-disable-line no-unused-vars

import muteIcon from 'url:../images/mute-button.png';
import unmuteIcon from 'url:../images/unmute-button.png';

function removeItemNamed(object, key) {
	if (!Object.keys(object).includes(key)){
		return;
	}
	if (isNaN(parseInt(key)) || !(object instanceof Array)) {
		delete object[key];
	} else {
		object.splice(key, 1);
	}
}

function findById(arr, id) {
	for (let item of arr) {
		if (item.id === id) {
			return item;
		}
	}
	return null;
}

function json(response) {
	return response.json();
}

function finishTransition(anim) {
	// Make sure finish() seeks to the target effect end
	// https://github.com/w3c/csswg-drafts/issues/5394
	anim.effect.updateTiming({ fill: 'both' }); // Or 'forwards'
	anim.commitStyles();
	anim.cancel();
}

document.addEventListener('DOMContentLoaded', () => {
	const debugMode = localStorage.getItem('debug') === '1';

	const view = document.getElementById('view');
	const overlay = <div class="overlay"><div class="spinner">Načítání…</div></div>;
	view.parentNode.appendChild(overlay);

	let map = null;
	let items = null;
	let socketMonitor = null;
	let itemsLoadedResolve;
	let itemsLoaded = new Promise((resolve) => {
		itemsLoadedResolve = resolve;
	});
	let myName = null;
	let myRoom = 'plaza';
	let myCloset = {};

	const audio = <audio loop="loop"></audio>;
	view.appendChild(audio);

	const canvas = <canvas width="800" height="600"></canvas>;
	const ctx = canvas.getContext('2d');
	view.appendChild(canvas);

	const log = (
		<div class="log dialogue">
			<h2 class="dialogue-header">Záznam chatu</h2>
			<a href="#" class="close">×</a>
			<div class="dialogue-inner"></div>
		</div>
	);
	view.appendChild(log);
	log.classList.add('hidden');
	document.querySelector('.log').addEventListener('click', function stopPropagation(event) {
		event.preventDefault();
		event.stopPropagation();
	});
	document.querySelector('.log .close').addEventListener('click', function hideLog() {
		this.parentNode.classList.add('hidden');
	});
	document.getElementById('toggleLog').addEventListener('click', function toggleLog(event) {
		document.querySelector('.log').classList.toggle('hidden');
		event.preventDefault();
		event.stopPropagation();
	});

	const inventory = (
		<div class="inventory dialogue">
			<h2 class="dialogue-header">Šatník</h2>
			<a href="#" class="close">×</a>
			<div class="dialogue-inner"></div>
		</div>
	);
	view.appendChild(inventory);
	itemsLoaded.then(fillInventory);
	inventory.classList.add('hidden');

	document.querySelector('.inventory').addEventListener('click', function stopPropagation(event) {
		event.preventDefault();
		event.stopPropagation();
	});
	document.querySelector('.inventory .close').addEventListener('click', function hideInventory() {
		this.parentNode.classList.add('hidden');
	});
	document.getElementById('toggleInventory').addEventListener('click', function toggleInventory(event) {
		document.querySelector('.inventory').classList.toggle('hidden');
		event.preventDefault();
		event.stopPropagation();
	});

	/** Currently dragged dialogue element. */
	let draggedDialogue = null;
	/** Position of the mouse cursor from the top-left of the dragged dialogue. */
	let dragOffset = {top: 0, left: 0};

	document.body.addEventListener('mousemove', function(event) {
		if (draggedDialogue) {
			const viewRect = view.getBoundingClientRect();
			// Bounding rectangle is relative to the viewport so we need to correct it by scroll offset.
			const viewOffset = {
				top: viewRect.top + window.scrollY,
				left: viewRect.left + window.scrollX,
			};
			draggedDialogue.style.top = (event.pageY - viewOffset.top - dragOffset.top) + 'px';
			draggedDialogue.style.left = (event.pageX - viewOffset.left - dragOffset.left) + 'px';
		}
	});


	document.querySelectorAll('.dialogue-header').forEach((header) => {
		header.addEventListener('mousedown', function(event) {
			// Parent node with class .dialogue
			draggedDialogue = header.parentNode;

			const rect = draggedDialogue.getBoundingClientRect();
			// Bounding rectangle is relative to the viewport so we need to correct it by scroll offset.
			const offset = {
				top: rect.top + window.scrollY,
				left: rect.left + window.scrollX,
			};

			dragOffset = {
				top: event.pageY - offset.top,
				left: event.pageX - offset.left
			};
		});
	});

	document.body.addEventListener('mouseup', function() {
		draggedDialogue = null;
	});

	document.getElementById('toggleMusic').addEventListener('click', function toggleMusic(event) {
		audio.muted = !audio.muted;
		if (audio.muted) {
			this.querySelector('img').setAttribute('src', unmuteIcon);
		} else {
			this.querySelector('img').setAttribute('src', muteIcon);
		}
		event.preventDefault();
		event.stopPropagation();
	});

	let myLayers = [];
	let speed = 150; // px per sec
	let players = {};
	let msgTimeouts = {};

	window.WebSocket = window.WebSocket || window.MozWebSocket;

	if (!window.WebSocket) {
		view.html('Smůla, tvůj prohlížeč nepodporuje WebSockets.');
		return;
	}

	let connection = new WebSocket('ws://' + window.location.hostname + (window.location.port === '' ? '' : ':' + window.location.port));

	connection.onopen = async function () {
		connection.send(JSON.stringify({type: 'init'}));
		try {
			const [mapData, itemsData] = await Promise.all([
				fetch('/content/world/map.json').then(json),
				fetch('/content/items/items.json').then(json),
			]);
			map = mapData;
			items = itemsData;
			itemsLoadedResolve();
			loadRoom();
		} catch (error) {
			alert('Načítání selhalo. Zkus prosím obnovit stránku.');
			console.trace(error);
		}
	};

	connection.onclose = function(event) {
		clearInterval(socketMonitor);
		alert(event.reason);
		if (event.code === 4001 || event.code === 4002) {
			window.location.href = '/';
		}
	};

	connection.onerror = function () {
		view.innerHTML = <p>Promiň, nefunguje server nebo tvé připojení.</p>;
	};

	// most important part - incoming messages
	connection.onmessage = function (message) {
		// try to parse JSON message. Because we know that the server always returns
		// JSON this should work without any problem but we should make sure that
		// the massage is not chunked or otherwise damaged.
		let json;
		try {
			json = JSON.parse(message.data);
		} catch (error) {
			console.log('This doesn\'t look like a valid JSON: ', message.data);
			return;
		}
		console.log(json);
		if (json.type === 'sync') {
			myName = json.name;
			for (let [key, value] of Object.entries(json.data)) {
				addPlayer(key, value.room, value.x, value.y);
				itemsLoaded.then(function() {
					dressPlayer(key, value.clothing);
				});
			}
		} else if (json.type === 'enter') {
			addPlayer(json.name, json.room, json.x, json.y);
			itemsLoaded.then(function() {
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
			const logInner = document.querySelector('.log .dialogue-inner');
			// If we are almost at the bottom, keep scrolling when new messages arrive.
			// Otherwise the player is probably reading history so let’s leave them at it.
			const scrollDown = (logInner.scrollTop + logInner.offsetHeight) + 10 > logInner.scrollHeight;

			logInner.appendChild(<p><strong>{json.name}</strong> {json.text}</p>);

			if (scrollDown) {
				logInner.scrollTo({ top: logInner.scrollHeight });
			}

			speakForPlayer(json.name, json.text);
		} else if (json.type === 'dress') {
			itemsLoaded.then(function() {
				dressPlayer(json.name, json.clothing);
			});
		} else if (json.type === 'syncCloset') {
			itemsLoaded.then(function() {
				myCloset = json.closet;
				fillInventory();
			});
		} else if (json.type === 'error') {
			alert(json.message);
		} else {
			console.log('Hmm..., I\'ve never seen JSON like this: ', json);
		}
	};

	view.addEventListener('click', function(event) {
		const rect = view.getBoundingClientRect();
		// Bounding rectangle is relative to the viewport so we need to correct it by scroll offset.
		const offset = {
			top: rect.top + window.scrollY,
			left: rect.left + window.scrollX,
		};
		connection.send(JSON.stringify({type: 'move', x: event.pageX - offset.left, y: event.pageY - offset.top}));
	});

	const messageBar = document.getElementById('message');
	messageBar.addEventListener('keydown', function(event) {
		let message = messageBar.value.trim();
		if (event.keyCode === 13 && message !== '') {
			connection.send(JSON.stringify({type: 'message', text: message}));
			messageBar.value = '';
		}
	});

	socketMonitor = setInterval(function() {
		if (connection.readyState !== 1) {
			clearInterval(socketMonitor);
			alert('Nelze komunikovat s WebSocket serverem.');
		}
	}, 3000);

	function addPlayer(name, room, x, y) {
		const style = {
			'background-image': 'url(/content/penguin/black-small.png)',
		};
		players[name] = {
			element: (
				<div data-name={name} data-room={room} class="penguin" style={style}>
					<div class="message hidden">
						<p>I am a penguin eating zebra filled with bubblegum</p>
					</div>
				</div>
			),
			animation: null,
		};

		if (typeof x !== 'undefined') {
			changePlayerPosition(name, x, y);
		}
		if (room === myRoom) {
			showPlayer(name);
		}
	}
	function showPlayer(name) {
		view.appendChild(players[name].element);
	}
	function movePlayer(name, x, y, room, newX, newY) {
		let handler = function() {};
		if (typeof room !== 'undefined') {
			players[name].element.setAttribute('data-room', room);
			if (name === myName) {
				handler = function() {
					myRoom = room;
					loadRoom();
					changePlayerPosition(myName, newX, newY);
					for (let [key, player] of Object.entries(players)) {
						if (player.element.getAttribute('data-room') === myRoom) {
							showPlayer(key);
						} else {
							hidePlayer(key);
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
			if (players[name].element.parentNode) {
				if (players[name].animation !== null) {
					// We should only have a single walking animation at a time.
					players[name].animation.commitStyles();
					players[name].animation.cancel();
				}

				const oldX = parseInt(players[name].element.style.left.replace(/px$/, ''), 10);
				const oldY = parseInt(players[name].element.style.top.replace(/px$/, ''), 10);
				const distance = Math.sqrt(Math.pow(oldX - x, 2) + Math.pow(oldY - y, 2));

				let animation = players[name].element.animate([
					{top: `${oldY}px`, left: `${oldX}px`},
					{top: `${y}px`, left: `${x}px`},
				], {
					duration: distance / speed * 1000,
					easing: 'linear',
				});
				players[name].animation = animation;
				animation.onfinish = () => {
					finishTransition(animation);
					handler();
				};
			} else {
				// We should not animate players out of the screen.
				players[name].element.style.top = `${y}px`;
				players[name].element.style.left = `${x}px`;
			}
		}
	}
	function removePlayer(name) {
		hidePlayer(name);
		removeItemNamed(players, name);
	}
	function hidePlayer(name) {
		players[name].element.remove();
	}
	function speakForPlayer(name, message) {
		const messageBubble = players[name].element.querySelector('.message');
		if (msgTimeouts[name]) {
			clearTimeout(msgTimeouts[name]);
		}
		msgTimeouts[name] = setTimeout(function() {
			messageBubble.classList.add('hidden');
		}, 5000);
		messageBubble.classList.remove('hidden');
		messageBubble.querySelector('p').textContent = message;
	}
	function changePlayerPosition(name, x, y) {
		players[name].element.style.top = `${y}px`;
		players[name].element.style.left = `${x}px`;
	}
	function dressPlayer(name, clothing) {
		players[name].element.querySelectorAll('img.clothing').forEach((item) => item.remove());
		for (let itemId of clothing) {
			let item = findById(items, itemId);
			let style = {};

			if (item.offset) {
				if (item.offset.left) {
					style.left = `${item.offset.left}px`;
				}
				if (item.offset.top) {
					style.top = `${item.offset.top}px`;
				}
			}

			players[name].element.appendChild(<img src={'/content/items/' + item.file} class="clothing" style={style} />);
		}
	}
	function fillInventory() {
		document.querySelectorAll('.inventory .dialogue-inner img').forEach((item) => item.remove());
		for (let itemId of Object.keys(myCloset)) {
			let itemData = findById(items, parseInt(itemId));
			let item = (
				<img
					src={'/content/items/paper/' + itemData.id + '.png'}
					width="50"
					height="50"
					alt=""
					title={itemData.title}
					data-item={itemData.id}
					onClick={() => {
						connection.send(JSON.stringify({type: 'dress', itemId: itemData.id}));
					}}
				/>
			);
			document.querySelector('.inventory .dialogue-inner').appendChild(item);
		}
	}

	function loadRoom() {
		let promises = [];
		overlay.classList.remove('hidden');
		audio.pause();
		if (typeof map[myRoom].ambiance !== 'undefined') {
			audio.setAttribute('src', '/content/world/' + map[myRoom].ambiance);
			audio.play();
		}
		myLayers.forEach((layer) => layer.remove());
		myLayers = [];
		for (let layerdata of map[myRoom].layers) {
			const style = {
				'width': `${layerdata.width}px`,
				'height': `${layerdata.height}px`,
				'left': `${layerdata.x}px`,
				'top': `${layerdata.y}px`,
				'z-index': `${typeof layerdata.z !== 'undefined' ? layerdata.z : 200}`,
			};
			const layer = <img class="layer" style={style} />;

			let p = new Promise((resolve) => {
				layer.addEventListener('load', resolve);
				layer.addEventListener('error', resolve);
			});
			promises.push(p);

			layer.setAttribute('src', '/content/world/' + layerdata.file);

			if (layerdata.alternate) {
				layer.classList.add('hidden');
			}

			if (layerdata.item) {
				layer.classList.add('item');
				layer.setAttribute('data-item', layerdata.item);
				layer.addEventListener('click', (event) => {
					const itemId = layerdata.item;
					if (confirm('Opravdu chceš získat ' + findById(items, parseInt(itemId)).title)) {
						connection.send(JSON.stringify({type: 'addItem', itemId: itemId}));
					}
					event.stopPropagation();
				});
			}

			myLayers.push(layer);
			view.appendChild(layer);
		}

		if (debugMode) {
			ctx.lineWidth = 3;
			ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
			for (let zonedata of map[myRoom].zones) {
				ctx.beginPath();
				ctx.strokeStyle = {floor: '#a6d924', door: '#a924d9', obstacle: '#d92463', sound: '#0075ff', animate: '#ffd200'}[zonedata.type[0]];
				ctx.moveTo(zonedata.area.points[0].x, zonedata.area.points[0].y);
				for (let point of zonedata.area.points) {
					ctx.lineTo(point.x, point.y);
				}
				if (zonedata.area._class === 'Polygon') {
					ctx.lineTo(zonedata.area.points[0].x, zonedata.area.points[0].y);
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

		Promise.all(promises).then(function() {
			overlay.classList.add('hidden');
		});
	}
});
