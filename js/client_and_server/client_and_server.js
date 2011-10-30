/*global exports, console, DP, JSON, mat4, ASSERT, myModules, require */
(function(){
if (typeof exports == 'undefined') {
	exports = {};
}
var mycs;
if (typeof myModules != 'undefined') {
	myModules.cs = exports;
	mycs = myModules.mycs;
} else {
	eval(require('fs').readFileSync('../client_and_server/lib/glMatrix-0.9.4.min.js', 'utf8'));
	mycs = require('../lib/my/my_client_and_server');
}
var ASSERT = mycs.ASSERT;
var DP = mycs.DP;
exports.REMOTE_PORT = 8761;
exports.DEVICE_PORT = 8869;
exports.CONTROLLER_PORT = 8254;
exports.FIELD_SIZE = 100;
exports.ENEMY_SIZE = 10;

exports.FIELD_X_WIDTH = 200.0;
exports.FIELD_Z_WIDTH = 200.0;
exports.FIELD_Y_WIDTH = 30.0;

exports.DEFAULT_BLOCK_SIZE = 0.3;

exports.paletteColors = {
	red: {r: 1.0, g: 0.0, b: 0.0},
	lime: {r: 0.0, g: 1.0, b: 0.0},
	blue: {r: 0.0, g: 0.0, b: 1.0},
	yellow: {r: 1.0, g: 1.0, b: 0.0},
	aqua: {r: 0.0, g: 1.0, b: 1.0},
	magenta: {r: 1.0, g: 0.0, b: 1.0},
	white: {r: 1.0, g: 1.0, b: 1.0},
	black: {r: 0.0, g: 0.0, b: 0.0}
};

var ID_SIZE = 10;
exports.ID_SIZE = ID_SIZE;

var SCALE = 0.008;
exports.SCALE = SCALE;

exports.PLAYER_BULLET_R = 0.8;
exports.ENEMY_BULLET_R = 0.3;

var calcRoatatePosition = function(angle, r){
	var modelView = mat4.create();
	
	mat4.identity(modelView);
	mat4.rotate(modelView, angle.x * (Math.PI / 180.0), [1, 0, 0]);
	mat4.rotate(modelView, angle.y * (Math.PI / 180.0), [0, 1, 0]);
	mat4.rotate(modelView, angle.z * (Math.PI / 180.0), [0, 0, 1]);

	var basePos = [0, 0, r];
	var newPos = [0, 0, 0];
	mat4.multiplyVec3(modelView, basePos, newPos);
	
	return newPos;
};
exports.calcRoatatePosition = calcRoatatePosition;

function normalize(pos){
	var l = Math.sqrt(Math.pow(pos.x, 2) + Math.pow(pos.y, 2) + Math.pow(pos.z, 2));
	var normalized = mycs.deepCopy(pos);
	normalized.x = normalized.x / l;
	normalized.y = normalized.y / l;
	normalized.z = normalized.z / l;
	return normalized;
}
exports.normalize = normalize;

exports.isOverlapped = function(pos1, r1, pos2, r2){
	if (Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2) + Math.pow(pos1.z - pos2.z, 2) < Math.pow(r1 + r2, 2)) {
		return true;
	}
	return false;
};

exports.calcAngle = function(edge1, edge2, edge_point){
	var edge_point_base_edge1 = {x: edge1.x - edge_point.x, y: edge1.y - edge_point.y, z: edge1.z - edge_point.z};
	var edge_point_base_edge2 = {x: edge2.x - edge_point.x, y: edge2.y - edge_point.y, z: edge2.z - edge_point.z};
	var normalized_edge1 = normalize(edge_point_base_edge1);
	var normalized_edge2 = normalize(edge_point_base_edge2);
	return Math.acos(normalized_edge1.x * normalized_edge2.x +
		normalized_edge1.y * normalized_edge2.y +
		normalized_edge1.z * normalized_edge2.z
	) * 180 / Math.PI;
};

exports.calcDistance = function(pos1, pos2){
	return Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2) + Math.pow(pos1.z - pos2.z, 2));
};

function EdgePoints(type){
	this.type = type;
	this.poss = [];
	this.id = this.type + mycs.createId(ID_SIZE);
}
EdgePoints.H_SIZE = 0.05;
EdgePoints.NUM = 2;
EdgePoints.types = [
	{from:'HEAD', to:'NECK'},
	{from:'NECK', to:'LEFT_SHOULDER'},
	{from:'LEFT_SHOULDER', to:'LEFT_ELBOW'},
	{from:'LEFT_ELBOW', to:'LEFT_HAND'},
	{from:'NECK', to:'RIGHT_SHOULDER'},
	{from:'RIGHT_SHOULDER', to:'RIGHT_ELBOW'},
	{from:'RIGHT_ELBOW', to:'RIGHT_HAND'},
	{from:'LEFT_SHOULDER', to:'TORSO'},
	{from:'RIGHT_SHOULDER', to:'TORSO'},
	{from:'TORSO', to:'LEFT_HIP'},
	{from:'LEFT_HIP', to:'LEFT_KNEE'},
	{from:'LEFT_KNEE', to:'LEFT_FOOT'},
	{from:'TORSO', to:'RIGHT_HIP'},
	{from:'RIGHT_HIP', to:'RIGHT_KNEE'},
	{from:'RIGHT_KNEE', to:'RIGHT_FOOT'},
	{from:'LEFT_HIP', to:'RIGHT_HIP'}
];
EdgePoints.calcPosition = function(from_pos, to_pos, index){
	return {
		x: from_pos.x + (to_pos.x - from_pos.x) / (EdgePoints.NUM + 1) * (index + 1),
		y: from_pos.y + (to_pos.y - from_pos.y) / (EdgePoints.NUM + 1) * (index + 1),
		z: from_pos.z + (to_pos.z - from_pos.z) / (EdgePoints.NUM + 1) * (index + 1)
	};
};
EdgePoints.prototype.setPosition = function(fromPos, toPos){
	for (var i = 0; i < EdgePoints.NUM; i++) {
		var pos = EdgePoints.calcPosition(fromPos, toPos, i);
		this.poss[i] = pos;
	}
};
exports.EdgePoints = EdgePoints;

function Field(){
	this._pieces = {};
}
exports.Field = Field;
Field.prototype.getPiece = function(id){
	return this._pieces[id];
};
Field.prototype.addPiece = function(piece, id){
	ASSERT(!this._pieces[id]);
	this._pieces[id] = piece;
};
Field.prototype.removePiece = function(id){
	ASSERT(this._pieces[id]);
	delete this._pieces[id];
};
Field.prototype.removePiecesByType = function(type){
	var pieces = [];
	for (var id in this._pieces) {
		var piece = this._pieces[id];
		if (piece.type === type) {
			delete this._pieces[id];
		}
	}
};
Field.prototype.getPiecesByType = function(type){
	var pieces = [];
	for (var id in this._pieces) {
		var piece = this._pieces[id];
		if (piece.type === type) {
			pieces.push(piece);
		}
	}
	return pieces;
};
Field.prototype.getAllPieces = function(){
	var pieces = [];
	for (var id in this._pieces) {
		pieces.push(this._pieces[id]);
	}
	return pieces;
};

function Joint(type, player){
	this.type = type;
	this.pos = null;
	this.origPos = null;
	this.id = this.type + mycs.createId(ID_SIZE);
	if (this.type === 'LEFT_HAND') {
		this.harfSize = Joint.SIELD_H_SIZE;
	} else {
		this.harfSize =  Joint.H_SIZE;
	}
}
exports.Joint = Joint;
Joint.types = [
	'HEAD',
	'NECK',
	'LEFT_SHOULDER',
	'RIGHT_SHOULDER', 
	'LEFT_ELBOW',
	'RIGHT_ELBOW',
	'LEFT_HAND',
	'RIGHT_HAND',	
	'TORSO',
	'LEFT_HIP',
	'RIGHT_HIP',	
	'LEFT_KNEE',
	'RIGHT_KNEE',
	'LEFT_FOOT',
	'RIGHT_FOOT'
];
Joint.H_SIZE = 0.3;
Joint.SIELD_H_SIZE = 1.5;
Joint.prototype.setPosition = function(pos){
	this.pos = pos;
};
Joint.prototype.getPosition = function(){
	return this.pos;
};

function Player(factory, opt_basePos, opt_angleY){
	this.life = Player.LIFE_MAX;
	if (typeof opt_basePos !== 'undefined') {
		this.angleY = opt_angleY;
	} else {
		this.angleY = 0;
	}
	if (typeof opt_basePos !== 'undefined') {
		this.basePos = mycs.deepCopy(opt_basePos);
	} else {
		this.basePos = {x: 0, y: 0, z:0};
	}

	this.oldFootY = {
		LEFT_FOOT: 0,
		RIGHT_FOOT: 0
	};
	this.jointBaseY = 0;

	this.joints = {};
	var len = Joint.types.length;
	for (var i = 0; i < len; i++) {
		var type = Joint.types[i];
		this.joints[type] = factory.createJoint(type, this);
	}
	this.edgePoints = [];
	for (i = 0, len = EdgePoints.types.length; i < len; i++) {
		this.edgePoints.push(factory.createEdgePoints(EdgePoints.types[i]));
	}
}
exports.Player = Player;
Player.LIFE_MAX = 200;
Player.prototype.setJointPosition = function(positions){
	for (var j = 0, jLen = positions.length; j < jLen; j++) {
		var joint = mycs.deepCopy(positions[j]);
		joint.x *= SCALE; joint.y *= SCALE;	joint.z *= SCALE;
		
		if (joint.name === 'LEFT_FOOT' || joint.name === 'RIGHT_FOOT') {
			this.oldFootY[joint.name] = joint.y;
		}
		this.jointBaseY = -Math.min(this.oldFootY['LEFT_FOOT'] - Joint.H_SIZE, this.oldFootY['RIGHT_FOOT'] - Joint.H_SIZE);		
		joint.y += this.jointBaseY;
	
		this.joints[joint.name].origPos = joint;
	}
	this.updateJointsPosition();
};
Player.prototype.updateJointsPosition = function(){
	for (var k in this.joints) {
		var joint = this.joints[k];
		if (!joint) {
			continue;
		}
		if (joint.origPos) {
			var newPos = this.rotatePosition({x: joint.origPos.x, y: joint.origPos.y, z: joint.origPos.z});
			joint.setPosition({x: newPos[0] + this.basePos.x, y: newPos[1] + this.basePos.y, z: newPos[2] + this.basePos.z});
		}
	}
	for (var i = 0, len = this.edgePoints.length; i < len; i++) {
		var points = this.edgePoints[i];
		if (!this.joints[points.type.to].pos || !this.joints[points.type.from].pos) {
			continue;
		}
		points.setPosition(this.joints[points.type.from].pos, this.joints[points.type.to].pos);
	}
};
function pointToArray(point){
	return [point.x, point.y, point.z];
}
function arrayToPoint(array){
	return {
		x: array[0],
		y: array[1],
		z: array[2]
	};
}
Player.prototype.rotatePosition = function(pos){
	var modelView = mat4.create();
	mat4.identity(modelView);
	mat4.rotate(modelView, this.angleY * (Math.PI / 180.0), [0, 1, 0]);

	var newPos = [0, 0, 0];
	mat4.multiplyVec3(modelView, pointToArray(pos), newPos);

	return newPos;
};
Player.prototype.turn = function(diff){
	this.angleY += diff;
	this.updateJointsPosition();
};
Player.prototype.move = function(dir){
	var angle = this.angleY;
	if (dir === 'up') {
		angle -= 180;
	}
	var diff = calcRoatatePosition({
		x: 0,
		y: angle,
		z: 0
	}, 2);
	this.setBasePosition({
		x: this.basePos.x + diff[0],
		y: this.basePos.y + diff[1],
		z: this.basePos.z + diff[2]
	});
};
Player.prototype.setBasePosition = function(pos){
	this.basePos = mycs.deepCopy(pos);
	this.updateJointsPosition();
};

})();