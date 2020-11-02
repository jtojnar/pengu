
// function isInRect(door, x, y) {
// 	return x >= door[0][0] && x <= door[1][0] && y >= door[0][1] && y <= door[1][1];
// }

function getTarget(room, line) {
	let gap = 5;
	let intersections = [];
	for (let zone of room.zones) {
		if (zone.type[0] === 'floor' || zone.type[0] === 'obstacle') {
			intersections.push(...zone.area.getIntersections(line));
		}
	}
	let target;
	if (intersections.length > 0){
		let targetDistance = Infinity;
		for (let intersection of intersections) {
			let distance = Math.abs(line.start.x - intersection.x);
			if (targetDistance > distance) {
				targetDistance = distance;
				target = intersection;
			}
		}

		target.x += gap / line.getLength() * (line.start.x - line.end.x);
		target.y += gap / line.getLength() * (line.start.y - line.end.y);
	} else {
		target = line.end;
	}

	target.x = Math.round(target.x);
	target.y = Math.round(target.y);
	return target;
}

module.exports = { getTarget };
