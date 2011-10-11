/*global global, console, exports, myModules, JSON */
(function(){
var module;
if (typeof exports == 'undefined') {
	exports = {};
}
if (typeof myModules != 'undefined') {
	module = myModules.mycs = {};
} else {
	module = exports;
}

module.dirToDiff = {
	down: {dx: 0, dy: 1},
	up: {dx: 0, dy: -1},
	left: {dx: -1, dy: 0},
	right: {dx: 1, dy: 0}
};
module.reverseDir = {	
	down: 'up',
	up: 'down',
	left: 'right',
	right: 'left'
};

var DP = function(var_args){
	if (typeof console != 'undefined') {
		console.log.apply(console, arguments);
	}
};
module.DIR = function(var_args){
	if (typeof console != 'undefined') {
		console.dir.apply(console, arguments);
	}
};
module.DP = DP;
module.LOG = function(var_args){
	DP.apply(this, arguments);
};
module.DPD = function(var_args){
	DP(JSON.stringify(var_args));
};
var ASSERT = function(exp, var_args){
	if (!exp) {
		if (typeof console != 'undefined') {
			debugger;
//			console.assert.apply(console, arguments);
		}
	}
};
module.ASSERT = ASSERT;
function mixin(subClass, superClass){
	for (var prop in superClass.prototype) {
		subClass.prototype[prop] = superClass.prototype[prop];
	}
	subClass.prototype.constructor = subClass;
}
module.mixin = mixin;
module.inherit = function(subClass, superClass){
	mixin(subClass, superClass);
	subClass.prototype.superClass = superClass;
};
module.superClass = function(subClass){
	return subClass.prototype.superClass.prototype;
};

function XPSCounter(){
	this.countFrame = 0;
	this.oldTime = -1;
	this.prevCount = 0;
}
XPSCounter.prototype.update = function(opt_proc){
	if (this.oldTime !== -1) {
		var current = Date.now();
		if (current - this.oldTime > 1000) {
			if (opt_proc) {
				opt_proc(this.countFrame);
			}
			this.prevCount = this.countFrame;
			this.countFrame = 0;
			this.oldTime += 1000;
			return true;
		}
		return false;
	} else {
		this.oldTime = Date.now();
		return false;
	}
};
module.XPSCounter = XPSCounter;
XPSCounter.prototype.increment = function(proc){
	this.update(proc);
	this.countFrame++;
};

function deepCopy(o){
	if (o instanceof Array) {
		var new_array = [];
		var len = o.length;
		for (var i = 0; i < len; i++) {
			new_array[i] = deepCopy(o[i]);
		}
		return new_array;
	} else if (typeof o === 'object') {
		var new_o = {};
		for (var k in o) {
			new_o[k] = deepCopy(o[k]);
		}
		return new_o;
	} else {
		return o;
	}
}

module.deepCopy = deepCopy;

// IntervalTimer
function IntervalTimer(){
	this.timer = -1;
	this.start = 0;
	this.proc = null;
}
IntervalTimer.prototype.setInterval = function(proc, limit, unit){
	this.start = (new Date()).getTime();
	this.proc = proc;
	var self = this;
	this.timer = setInterval(function(){
		var current = (new Date()).getTime();
		var progress = (current - self.start) / limit;
		progress = (progress > 1) ? 1: progress;
		if (!self.proc(progress) || current > self.start + limit) {
			clearInterval(self.timer);
			self.timer = -1;
		}
	}, unit);
};
IntervalTimer.prototype.IsEnd = function(){
	return (this.timer === -1);
};
IntervalTimer.prototype.clearInterval = function(do_last_action){
	if (do_last_action && this.timer !== -1) {
		this.proc(1);
	}
	clearInterval(this.timer);
	this.timer = -1;
};
module.IntervalTimer = IntervalTimer;

// IndexPool
function IndexPool(start, end){	// slow
	this.pool = {};
	this.start = start;
	this.end = end;
	for (var i = start; i <= end; i++) {
		this.pool[i] = true;
	}
}
IndexPool.prototype.hold = function(){
	for (var k in this.pool) {
		delete this.pool[k];
		return k;
	}
	ASSERT(true);
};
IndexPool.prototype.release = function(index){
	ASSERT(!(index in this.pool));
	ASSERT(this.start <= index && index <= this.end);
	this.pool[index] = true;
};
module.IndexPool = IndexPool;

module.createId = function(n){
	var table = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
	var id = '';
	for (var i = 0; i < n; i++) {
		id += table.charAt(Math.floor(table.length * Math.random()));
	}
	return id;
};
module.randomColor = function() {
	return '#' + Math.floor((0xffffff + 1) * Math.random()).toString(16);
};

module.checkArgs = function(obj, essenticalNames, validNames) {
	var name;
	for (var i = essenticalNames.length - 1; i >= 0; i--) {
		name = essenticalNames[i];
		ASSERT(obj[name] !== undefined);
	}
	for (name in obj) {
		if (essenticalNames.indexOf(name) !== -1) {
			continue;
		}
		if (validNames.indexOf(name) !== -1) {
			continue;
		}
		ASSERT(false, name);
	}
};

/*global DP, LOG, ASSERT, DIR, DPD */
module.setShorthands = function(namespace){
	var shorthands = ['DP', 'LOG', 'ASSERT', 'DIR', 'DPD'];
	for (var i = 0, len = shorthands.length; i < len; i++) {
		namespace[shorthands[i]] = module[shorthands[i]];
	}
};

module.isOverlappingBox = function(box1, box2) {
	return (
		box1.startX <= box2.endX &&
		box1.endX >= box2.startX &&
		box1.startY <= box2.endY &&
		box1.endY >= box2.startY &&
		box1.startZ <= box2.endZ &&
		box1.endZ >= box2.startZ
	);
};

module.axisAndAngleToQuta = function(quat4, vec, angle) {	// todo: fix quat4
    var sinBase = Math.sin(angle * 0.5);
	
	return quat4.create([
		vec[0] * sinBase,
		vec[1] * sinBase,
		vec[2] * sinBase,
		Math.cos(angle * 0.5)
	]);
};

module.quatToAxisAndAngle = function(quat) {
	var angle = 2 * Math.acos(quat[3]);
	var sinBase = Math.sin(angle * 0.5);
	
	return {
		vector: [
			1 / sinBase * quat[0],
			1 / sinBase * quat[1],
			1 / sinBase * quat[2]
		],
		angle: angle
	};
};

module.isSafeFilename = function(name) {
	return name.match(/^([a-zA-Z_0-9\.]+$)/);
};

})();
