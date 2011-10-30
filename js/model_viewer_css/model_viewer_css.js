/*global DP, Class, KeyEvent, ASSERT */
/*global $, ManuallyRotation, modelData, _, myModules */
/*global Box, Point, Field */

(function() {
var myc = myModules.myc;

var MAX_SCALE = 500;

function display(field, fieldWidth, fieldHeight){
	var base = new Point([0, 0, 0]);
	var scale = MAX_SCALE;
	
	var big = _.reduce(modelData, function(memo, block){
		return {
			minX: Math.min(memo.minX, block.pos.x),
			minY: Math.min(memo.minY, block.pos.y),
			minZ: Math.min(memo.minZ, block.pos.z),
			maxX: Math.max(memo.maxX, block.pos.x),
			maxY: Math.max(memo.maxY, block.pos.y),
			maxZ: Math.max(memo.maxZ, block.pos.z)
		};
	}, {
		minX: 1000,
		minY: 1000,
		minZ: 1000,
		maxX: 0,
		maxY: 0,
		maxZ: 0
	});
	var MARGIN = 3 / 4;
	var xWidth = Math.abs(big.minX - big.maxX);
	if ((fieldWidth * MARGIN) < xWidth * scale) {
		scale = (fieldWidth * MARGIN) / xWidth;
	}
	var zWidth = Math.abs(big.minZ - big.maxZ);
	if ((fieldWidth * MARGIN) < zWidth * scale) {
		scale = (fieldWidth * MARGIN) / zWidth;
	}
	var yWidth = Math.abs(big.minY - big.maxY);
	if ((fieldHeight * MARGIN) < yWidth * scale) {
		scale = (fieldHeight * MARGIN) / yWidth;
	}
	var normalzedData = _.map(modelData, function(block){
		return {
			x: ~ ~ (block.pos.x * scale),
			y: ~ ~ (-block.pos.y * scale),
			z: ~ ~ (block.pos.z * scale),
			color: myc.sceneColorToCSSClor(block.color),
			r: ~ ~ (block.r * scale)
		};
	});
	var minifiedData = [];
	for (var i = 0, iLen = normalzedData.length; i < iLen; i++) {
		var b1 = normalzedData[i];
		var remove = false;
		for (var j = i + 1, jLen = normalzedData.length; j < iLen; j++) {
			var b2 = normalzedData[j];
			var r = Math.sqrt(Math.pow(b1.x - b2.x, 2) + Math.pow(b1.y - b2.y, 2) + Math.pow(b1.z - b2.z, 2));
			if (r < 5 && b1.color === b2.color) {
				remove = true;
				break;
			}
		}
		if (!remove) {
			minifiedData.push(b1);
		}
	}
	$('#block_number').html(modelData.length + ' -> ' + minifiedData.length + ' blocks');
	var sum = _.reduce(minifiedData, function(memo, block){
		return {
			x: memo.x + block.x,
			y: memo.y + block.y,
			z: memo.z + block.z
		};
	}, {
		x: 0,
		y: 0,
		z: 0
	});
	var len = minifiedData.length;
	var baseX = sum.x / len;
	var baseY = sum.y / len;
	var baseZ = sum.z / len;
	
	minifiedData.forEach(function(block){
		var box = new Box({
			pos: {
				x: ~ ~ (block.x - baseX + fieldWidth / 2),
				y: ~ ~ (block.y - baseY + fieldHeight / 2),
				z: ~ ~ (block.z - baseZ)
			},
			optR: {
				x: block.r,
				y: block.r,
				z: block.r
			},
			optColor: block.color,
			optNoMedium: true
		});
		base.add(box);
	}, this);
	field.add(base);
}

function start() {
	var fieldHeight = window.innerHeight;
	var fieldWidth = window.innerWidth;
	var mount = $('#mount')
		.css('width', fieldWidth + 'px')
		.css('height', fieldHeight + 'px');

	var field = new Field(mount[0]);
	display(field, fieldWidth, fieldHeight);
	new ManuallyRotation(mount[0]);

	$('#mount').addClass('animation');
	
	$('#animation_switch').bind('click', function() {
		var mount = $('#mount');
		if (mount.hasClass('animation')) {
			this.textContent = 'Start Animation';
			mount.removeClass('animation');
		} else {
			this.textContent = 'Stop Animation';
			mount.addClass('animation');
		}
	});

	window.addEventListener('dblclick', function(e){
		myc.switchFullscreen(document.body);
		e.preventDefault();
	}, false);
}


window.addEventListener('load', function() {
	myc.hideAddressBar(true, start);	
}, false);
})();
