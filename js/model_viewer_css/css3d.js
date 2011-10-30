/*global ASSERT, Class, myModules, xyz, Class */

(function(module) {

var myc = myModules.myc;
var mycs = myModules.mycs;
var MASS_R = 16;

module.Field = Class.extend({
	init: function(mount) {
		this._pieces = {};
		this._mount = mount;
	},
	get: function(id, optDescendant) {
		return this._pieces[id];
	},
	add: function(piece) {
		this._pieces[piece.id] = piece;
		this._mount.appendChild(piece.ele);
	},
	remove: function(piece) {
		delete this._pieces[piece.id];
		this._mount.removeChild(piece.ele);
	},
	clear: function() {
		for (var p in this._pieces) {
			var piece = this._pieces[p];
			var ele = piece.ele;
			piece.destroy();
			this._mount.removeChild(ele);
		}
		this._pieces = {};	// todo: call destroy()
	}
});

var Piece = Class.extend({
	init: function(pos){
		this.pos = mycs.deepCopy(pos);
		this.id = module.Piece.createId();
		this.ele = null;
		this.children = {};
	},
	_setPos: function(pos) {
		this.pos = window.deepCopy(pos);
	},
	destroy: function() {
		this.children = {};
	},
	add: function(piece) {
		this.children[piece.id] = piece;
		this.ele.appendChild(piece.ele);
	},
	get: function(id) {
		return this.children[id];
	}
});
module.Piece = Piece;
Piece.createId = function() {
	return mycs.createId(10);
};
Piece.TYPE_BOX = 0x1;
Piece.TYPE_FLOOR = 0x2;
Piece.TYPE_QUAD = 0x20;
Piece.TYPE_CUBIC = 0x40;
Piece.TYPE_PYRAMID = 0x80;
Piece.TYPE_POINT = 0x200;

function createSurfaceElement(x, y, z, width, height, opt_color, opt_rotate, opt_imageUrl) {
	var rotate = (opt_rotate === undefined) ? '':  opt_rotate;
	var ele = document.createElement('div');
	ele.className = 'surface';
	var style = '-webkit-transform: translateX(' + x + 'px) translateY(' + y + 'px) translateZ(' + z + 'px) ' + rotate + ';';
	if (opt_color) {
		style += 'background-color: ' + opt_color + ';';
	}
	if (opt_imageUrl) {
		style += 'background-image: url("' + opt_imageUrl + '");';
	}
	style += 'width: ' + width + 'px;';
	style += 'height: ' + height + 'px;';
	style += 'position: absolute;';
	style += 'top: 0px;';
	style += 'left: 0px;';
	ele.setAttribute('style', style);
	return ele;
}

var Point = Piece.extend({
	init: function(opts) {
		if (opts[0] !== undefined) {
			ASSERT(opts.length === 3);
			opts = {pos: {x: opts[0], y: opts[1], z: opts[2]}};
		}
		mycs.checkArgs(opts, ['pos']);
		this._super(opts.pos);
		this.type = Piece.TYPE_POINT;
		this.ele = document.createElement('div');
		this.ele.className = 'point';
		var style = '-webkit-transform: translateX(' + opts.pos.x + 'px) translateY(' + opts.pos.y + 'px) translateZ(' + opts.pos.z + 'px);';
		style += 'position: absolute;';
		this.ele.setAttribute('style', style);
	}
});
module.Point = Point;

var Cubic = Piece.extend({
	init: function(opts) {
		mycs.checkArgs(opts, ['pos'], ['optR', 'optNoMedium']);
		this._super(opts.pos);
		this.type = Piece.TYPE_CUBIC;
		this.rotateX = 0;
		this.rotateY = 0;
		this.r = (opts.optR === undefined) ? {
			x: MASS_R,
			y: MASS_R,
			z: MASS_R
		}: mycs.deepCopy(opts.optR);
		this.ele = this.createBase(opts.pos);
		if (!opts.optNoMedium) {
			var medium = document.createElement('div');
			medium.className = 'polygon_medium';
			this.ele.appendChild(medium);
			this.mediumElement = medium;
		}
	},
	move: function(pos) {
		this._setPos(pos);
		var transform = 'translateX(' + pos.x + 'px) translateY(' + pos.y + 'px) translateZ(' + pos.z + 'px) '
			+ 'rotateX(' + this.rotateX + 'deg) '
			+ 'rotateY(' + this.rotateY + 'deg) ';
		this.ele.style.webkitTransform = transform;
	},
	getRange: function(optPos) {
		var pos = (optPos === undefined) ? this.pos: optPos;
		return {
			startX: pos.x - this.r.x, endX: pos.x + this.r.x,
			startY: pos.y - this.r.y, endY: pos.y + this.r.y,
			startZ: pos.z - this.r.z, endZ: pos.z + this.r.z
		};
	},
	setRotation: function(x, y) {
		this.rotateX = x;
		this.rotateY = y;
	},
	createBase: function() {
		var ele = document.createElement('div');
		var pos = this.pos;
		var style = '-webkit-transform: translateX(' + pos.x + 'px) translateY(' + pos.y + 'px) translateZ(' + pos.z + 'px) '
			+ 'rotateX(' + this.rotateX + 'deg) '
			+ 'rotateY(' + this.rotateY + 'deg);';
		ele.setAttribute('style', style);
		ele.className = 'polygon_base';
		return ele;
	}
});
module.Cubic = Cubic;

var Box = Cubic.extend({
	init: function(opts) {
		mycs.checkArgs(opts, ['pos'], ['optColor', 'optImageUrl', 'optR', 'optNoMedium']);
		this._super({pos: opts.pos, optR: opts.optR, optNoMedium: opts.optNoMedium});
		this.type = Piece.TYPE_BOX;
		this.eles = [];
		this.surfaces = [];	// todo: refactoring
		this._imageUrl = opts.optImageUrl;
		this._createSurfaces(opts.optColor);
	},
	createSurface: function(parent, x, y, z, w, h, imageUrl, opt_rotate, opt_color) {
		var ele = createSurfaceElement(
			x, y, z, w, h,
			opt_color,
			opt_rotate,
			imageUrl
		);
		parent.appendChild(ele);
		this.eles.push(ele);
		this.surfaces.push({
			pos: {
				x: x,
				y: y,
				z: z
			},
			width: w,
			height: h,
			rotate: (opt_rotate === undefined) ? '':  opt_rotate,	//todo: fix
			ele: ele
		});
	},
	_createSurfaces: function(opt_color) {
		var parent = (this.mediumElement) ? this.mediumElement: this.ele;
		var imageUrl = this._imageUrl;
		var self = this;
		var create = function(x, y, z, w, h, opt_rotate) {
			self.createSurface(parent, x, y, z, w, h, imageUrl, opt_rotate, opt_color);
		};
		var ar = this.r;
		create(-ar.x, -ar.y, -ar.z, ar.x * 2, ar.y * 2);
		create(-ar.x, -ar.y, ar.z, ar.x * 2, ar.y * 2);
		create(-ar.x, -2*ar.y + ar.y - ar.z, 0, ar.x * 2, ar.z * 2, 'rotateX(90deg)');
		create(-ar.x, ar.y - ar.z, 0, ar.x * 2, ar.z * 2, 'rotateX(90deg)');
		create(-ar.x - ar.z, -ar.y, 0, ar.z * 2, ar.y * 2, 'rotateY(90deg)');
		create(ar.x - ar.z, -ar.y, 0, ar.z * 2, ar.y * 2, 'rotateY(90deg)');
	},
	explode: function() {
		// todo: use getComputedStyle(ele, '').webkitTransform
		for (var i = this.eles.length - 1; i >= 0; i--) {
			var s = this.surfaces[i];
			s.pos.x += 100;
			this.eles[i].style.webkitTransform = 'translateX(' + (s.pos.x + 10) + 'px) ' +
				'translateY(' + s.pos.y + 'px) translateZ(' + s.pos.z + 'px) ' + s.rotate;
		}
	}
});
module.Box = Box;

var Pyramid = Cubic.extend({
	init: function(opts) {
		mycs.checkArgs(opts, ['pos'], ['optColor', 'optImageUrl', 'optR', 'optMedium']);
		this._super({pos: opts.pos, optR: opts.optR, optMedium: opts.optMedium});
		this.type = Piece.TYPE_BOX;
		this.eles = [];
		this._imageUrl = opts.optImageUrl;
		this._createSurfaces(opts.color);
	},
	_createSurfaces: function(opt_color) {
		var parent = (this.mediumElement) ? this.mediumElement: this.ele;
		var imageUrl = this._imageUrl;
		var create = function(x, y, z, w, h, opt_rotate, opt_imageUrl) {
			var ele = createSurfaceElement(
				x, y, z, w, h,
				opt_color,
				opt_rotate,
				opt_imageUrl
			);
			parent.appendChild(ele);
		};
		var ar = this.r;
		var degree = 60;
		create(-ar.x, -ar.y, -ar.z, ar.x * 2, ar.y * 2);

		ASSERT(ar.x === ar.y);
		var sh = ar.y;
		var a = Math.sin(degree * (Math.PI / 180.0)) * sh;
		var b = Math.cos(degree * (Math.PI / 180.0)) * sh;
		create(-ar.x, -ar.y + (ar.y - b), -ar.z + a, ar.x * 2, sh * 2, 'rotateX(-60deg)', this._imageUrl);
		create(-ar.x, -ar.y - (ar.y - b), -ar.z + a, ar.x * 2, sh * 2, 'rotateZ(180deg) rotateX(-60deg)', this._imageUrl);
		// "- (ar.y - ar.x)" is a difference of rotation base
		create(-ar.x - (ar.y - ar.x) - (ar.x - b), -ar.y, -ar.z + a, ar.y * 2, sh * 2, 'rotateZ(90deg) rotateX(-60deg)', this._imageUrl); 
		create(-ar.x - (ar.y - ar.x) + (ar.x - b), -ar.y, -ar.z + a, ar.y * 2, sh * 2, 'rotateZ(270deg) rotateX(-60deg)', this._imageUrl); 
	}
});
module.Pyramid = Pyramid;

})(this);
