"use strict";
function Polygon() {
	this.points = arguments;
}
Polygon.prototype.containsPoint = function(point) {
	if(!point instanceof Point) {
		throw new Error('point isn’t instance of Point');
	}
	var i, j, c = false;
	var points = this.points;
	var nvert = points.length;
	for(var i = 0, j = nvert-1; i < nvert; j = i++) {
		if(((points[i].y>point.y) != (points[j].y>point.y)) && (point.x < (points[j].x-points[i].x) * (point.y-points[i].y) / (points[j].y-points[i].y) + points[i].x)){
			c = !c;
		}
	}
	return c;
}
Polygon.prototype.getIntersections = function(line) {
	var lastCoords = this.points[this.points.length-1];
	var intersections = [];
	for(var i = 0; i < this.points.length; i++) {
		var coords = this.points[i];
		var currentLine = new Line(lastCoords, coords);
		var inter = line.getIntersection(currentLine);
		if(inter !== false) intersections.push(inter);
		lastCoords = coords;
	}
	return intersections;
}


function Line() {
	this.start = arguments[0];
	this.end = arguments[1];
}
Line.prototype.toString = function() {
	return this.start + '→' + this.end;
}
Line.prototype.getLength = function() {
	return Math.sqrt(Math.pow(this.start.x - this.end.x, 2) + Math.pow(this.start.y - this.end.y, 2));
}
Line.prototype.getIntersection = function(line2) {
	var line1 = this;
	var uline1_t = (line2.end.x - line2.start.x) * (line1.start.y - line2.start.y) - (line2.end.y - line2.start.y) * (line1.start.x - line2.start.x);
	var uline2_t = (line1.end.x - line1.start.x) * (line1.start.y - line2.start.y) - (line1.end.y - line1.start.y) * (line1.start.x - line2.start.x);
	var u_line2  = (line2.end.y - line2.start.y) * (line1.end.x - line1.start.x) - (line2.end.x - line2.start.x) * (line1.end.y - line1.start.y);

	if(u_line2 != 0) {
		var uline1 = uline1_t / u_line2;
		var uline2 = uline2_t / u_line2;

		if(0 <= uline1 && uline1 <= 1 && 0 <= uline2 && uline2 <= 1) {
			return new Point(line1.start.x + uline1 * (line1.end.x - line1.start.x), line1.start.y + uline1 * (line1.end.y - line1.start.y));
		} else {
			return false; // No Intersection
		}
	} else {
		if(uline1_t == 0 || uline2_t == 0) {
			return false; // Coincident
		} else {
			return false; // Parallel
		}
	}
}

function Point() {
	if(arguments.length != 2 || typeof arguments[0] !== 'number' || typeof arguments[1] !== 'number') {
		throw new Error('Invalid point definition');
	}
	this.x = arguments[0];
	this.y = arguments[1];
}
Point.prototype.toString = function() {
	return '[' + this.x + ',' + this.y + ']';
}
Point.prototype.getDistance = function(point) {
	if(!point instanceof Point) {
		throw new Error('point isn’t instance of Point');
	}
	return (new Line(this, point)).getLength();
}

exports.Point = Point;
exports.Polygon = Polygon;
exports.Line = Line;
