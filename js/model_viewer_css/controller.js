/*global console, Class, quat4, myModules */

(function(module) {
var myc = myModules.myc;
var mycs = myModules.mycs;

module.ManuallyRotation = Class.extend({
	init: function(target) {
		this._userActionDownX = null;
		this._userActionDownY = null;
		this._isDragging = false;
		this._oldRotation = null;
		this._target = target;
		this.currentQuatanion = null;
		this.currentRotation = null;
		
		this.resetRotation();

		var self = this;
		document.body.addEventListener('mousedown', function(e){
			e.preventDefault();
			self.handleUserActionDown(e);
		}, false);
		document.body.addEventListener('mouseup', function(e){
			e.preventDefault();
			self.handleUserActionUp(e);
		}, false);
		document.body.addEventListener('mousemove', function(e){
			e.preventDefault();
			self.handleUserActionMove(e);
		}, false);
		document.body.addEventListener('touchstart', function(e){	// Don't call e.preventDefault(). The default action is necessary to fire click event.
			self.handleUserActionDown(e);
		}, false);
		document.body.addEventListener('touchend', function(e){
			self.handleUserActionUp(e);
		}, false);
		document.body.addEventListener('touchmove', function(e){
			e.preventDefault();
			self.handleUserActionMove(e);
		}, false);
	},
	_rotate: function(diffVector, diffAngle) {
		var initialQuta = mycs.axisAndAngleToQuta(quat4, this._oldRotation.vector, this._oldRotation.angle);
		var diffQuta = mycs.axisAndAngleToQuta(quat4, diffVector, diffAngle);
		quat4.multiply(diffQuta, initialQuta, this.currentQuatanion);
		this.currentRotation = mycs.quatToAxisAndAngle(this.currentQuatanion);
	
		this._target.style.webkitTransform = 'rotate3d(' + this.currentRotation.vector[0]
			+ ', ' + this.currentRotation.vector[1]
			+ ', ' + this.currentRotation.vector[2]
			+ ', '+ this.currentRotation.angle + 'rad)';
	},
	resetRotation: function() {
		this._oldRotation = {
			vector: [0, 0, 0],
			angle: 0
		};
		this.currentRotation = {
			vector: [0, 0, 0],
			angle: 0
		};
		this.currentQuatanion = [0, 0, 0, 1];
		this._target.style.webkitTransform = 'rotate3d(0, 0, 0, 0rad)';
	},
	handleUserActionDown: function(e) {
		this._isDragging = true;
		if (e.touches) {
			e = e.touches[0];
		}
		this._userActionDownX = e.clientX;
		this._userActionDownY = e.clientY;
	},
	handleUserActionUp: function(e) {
		this._isDragging = false;
		this._oldRotation = mycs.deepCopy(this.currentRotation);
	},
	handleUserActionMove: function(e) {
		if (!this._isDragging) {
			return;
		}
		if (e.changedTouches) {
			e = e.changedTouches[0];
		}
		var yDiff = this._userActionDownY - e.clientY;
		var xDiff = e.clientX - this._userActionDownX;
		var length = Math.sqrt(yDiff * yDiff + xDiff * xDiff);
		
		var normalizeVector = [yDiff / length, xDiff / length, 0];
		var angle = length / 250;
		
		this._rotate(normalizeVector, angle);
	}
});

})(this);
