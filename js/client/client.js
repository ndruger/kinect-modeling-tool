/*global DP, io, cs, SceneJS, ASSERT, DPD, LOG, BlenderExport, myModules, KeyEvent, dummyDeviceData */
/*global render, handleDeviceMessage, $, _ */
(function(){
var DEBUG = true;
var cs = myModules.cs;
var mycs = myModules.mycs;
var myc = myModules.myc;
var deviceProxy, remoteProxy, field, myPlayerId = -1, counter, myEnemyId, renderingTimer = -1, nobindConrollers;
var viewerEye;
var FPS = 30;
var SCALE = 0.008;
var EYE_Z = 70;	// todo: check SCALE
var LOOK_AT_EYE = { x: 0.0, y: 10, z: EYE_Z };

var useVR920 = false;
var query = myc.parseQuery();
var devicePort = query.port || cs.DEVICE_PORT;
var useDummyRemote = (query.use_dummy_remote === 'true');

// todo: create objects
function chainSimpleRotate(id, nodes, type){
	var wrapper = [{
		type: 'rotate',
		id: id + '-rotate-' + type,
		angle: 0.0,
		y: 1.0,
		nodes: nodes
	}];
	wrapper[0][type] = 1.0;
	return wrapper;
}
function chainSimpleRotateX(id, nodes){
	return chainSimpleRotate(id, nodes, 'x');
}
function chainSimpleRotateY(id, nodes){
	return chainSimpleRotate(id, nodes, 'y');
}
function chainSimpleRotateZ(id, nodes){
	return chainSimpleRotate(id, nodes, 'z');
}

function setNodeXYZ(id, pos){
	var node = SceneJS.withNode(id);
	node.set('x', pos.x);
	node.set('y', pos.y);
	node.set('z', pos.z);
}
function createAndMountNodes(node, id){
	SceneJS.Message.sendMessage({
		command: 'create',
		nodes: [{
			type: 'node',
			id: id,
			nodes: node
		}]
	});
	SceneJS.Message.sendMessage({
		command: 'update',
		target: 'mount-node',
		add: {
			node: id
		}
	});
}
function removeNode(id){
	SceneJS.Message.sendMessage({
		command: 'update',
		target: 'mount-node',
		remove: {
			node: id
		}
	});
}

function NobindControllers(){
	$('#controller_list').delegate('button', 'click', function() {
		remoteProxy.send({type: 'binding_request', arg:{id: this.textContent}});
		this.parentNode.innerHTML = '';	// todo: too fast
	});
}
NobindControllers.prototype.update = function(idList){
	LOG('NobindControllers.prototype.update: list: ' + idList);
	var listNode = $('#controller_list');
	listNode.text('');
	idList.forEach(function(id) {
		listNode.append($('<button/>').html(id));
	});
};

function ClientField(aspect){
	mycs.superClass(ClientField).constructor.apply(this, []);
	this.blockCount = 0;
	SceneJS.createNode({
		type: 'scene',
		id: 'the-scene',
		canvasId: 'main_canvas',
		loggingElementId: 'theLoggingDiv',
		nodes: [{
			type: 'lookAt',
			eye : LOOK_AT_EYE, 
			look : { x:0, y:0, z:0 },
			up : { y: 1.0 },
			id: 'eye',
			nodes: [{
				type: 'camera',
				optics: {
					type: 'perspective',
					fovy : 25.0,
					aspect : aspect,
					near : 0.10,
					far : 300.0
				},
				nodes: [{
					type: 'light',
					mode: 'dir',
					color: { r: 0.9, g: 0.9, b: 0.9 },
					diffuse: true,
					specular: true,
					dir: { x: 0.0, y: 10.0, z: 0.0 },
					pos: { x: 0.0, y: 0.0, z: 0.0}
				},
				{
					type: 'light',
					mode: 'dir',
					color: { r: 0.3, g: 0.3, b: 0.3 },
					diffuse: true,
					specular: true,
					dir: { x: 0.0, y: 0.0, z: EYE_Z - 1 },
					pos: { x: 0.0, y: 10.0, z: EYE_Z }
				},
				{
					type: 'light',
					mode: 'dir',
					color: { r: 0.3, g: 0.3, b: 0.3 },
					diffuse: true,
					specular: true,
					dir: { x: 0.0, y: 0.0, z: -EYE_Z - 1 },
					pos: { x: 0.0, y: 10.0, z: -EYE_Z }
				},
				{
				    type: 'material',
				    id: 'floor',
				    baseColor: { r: 0.2, g: 0.2, b: 0.2 },
				    shine: 6.0,
				    nodes: [{
			            type: 'texture',
			            layers: [{
		                    uri: 'img/wall.png',
		                    minFilter: 'linearMipMapLinear',
		                    wrapS: 'repeat',
		                    wrapT: 'repeat',
		                    scale : { x: 100.0, y: 100.0, z: 10.0 }
			            }],
			            nodes: [{
							type: 'translate',
							y: -1,
							nodes: [{
			                    type: 'scale',
			                    x: cs.FIELD_X_WIDTH / 2,
			                    y: 1.0,
			                    z : cs.FIELD_Z_WIDTH / 2,
			                    nodes: [{
			                    	type: 'cube'
			                    }]
							}]
			            }]
				    }]
				},
				{
					id: 'base',
		            type: 'cube',
					xSize: 0.1,
					ySize : 0.1,
					zSize : 0.1
				},
				{
					type: 'translate',
					id: 'debug_cube-translate',
				    nodes: [{
			            id: '_cube',
						type: 'cube',
						xSize: 0.1,
						ySize : 0.1,
						zSize : 0.1
					}]
				},
				{
					type: 'node',
					id: 'mount-node'
				}]
			}]
		}]
	});
}
mycs.inherit(ClientField, cs.Field);
ClientField.prototype.destroyPiecesByType = function(type){
	var pieces = this.getPiecesByType(type);
	pieces.forEach(function(piece) {
		piece.destroy();
	});
};

function Unit(pos, type, opt_id){
	if (opt_id !== undefined) {
		this.id = opt_id;
	} else {
		this.id = type + mycs.createId(cs.ID_SIZE);
	}
	this.pos = mycs.deepCopy(pos);
	this.type = type;
	this.idDirty = false;
	field.addPiece(this, this.id);
}
Unit.prototype.destroy = function(){
	field.removePiece(this.id);
	removeNode(this.id);
};
Unit.prototype._createNode = function(node){
	var nodes = [];

	nodes.push({
		type: 'translate',
		id: this.id + '-translate',
		x: this.pos.x,
		y: this.pos.y,
		z: this.pos.z,
		nodes: chainSimpleRotateY(this.id, 
			chainSimpleRotateX(this.id,
				chainSimpleRotateZ(this.id, [{
					type: 'scale',
					id: this.id + '-scale',
					nodes: [node]
				}])
			)
		)
	});
	
	createAndMountNodes(nodes, this.id);
};
Unit.prototype.updateScale = function(x, y, z) {
	var scale = SceneJS.withNode(this.id + '-scale');
	scale.set('x', x);	
	scale.set('y', y);	
	scale.set('z', z);
	this.idDirty = true;
};
Unit.prototype.updatePosition = function(pos) {
	this.pos = pos;
	this.idDirty = true;
};
Unit.prototype.render = function(pos){
	if (this.pos && this.idDirty) {
		setNodeXYZ(this.id + '-translate', this.pos);
		this.idDirty = false;
	}
};


function ClientJoint(type, player){
	mycs.superClass(ClientJoint).constructor.apply(this, [type, player]);
			
	function createEdge(id) {
		return {
			type: 'translate',
			id: id + '-translate',
			nodes: chainSimpleRotateY(id, [{
				type: 'material',
				baseColor: { r: 0.0, g: 1.0, b: 0.0 },
				nodes: [{
					type : 'cube',
					xSize: cs.Joint.H_SIZE,
					ySize: cs.Joint.H_SIZE,
					zSize: cs.Joint.H_SIZE
				}]
			}])
		};
	}

	this._createNode(createEdge);
}
window.addEventListener('click', function(e) {
    SceneJS.withNode('the-scene').pick(e.clientX, e.clientY);	
});
mycs.inherit(ClientJoint, cs.Joint);
ClientJoint.prototype.destroy = function(){
	removeNode(this.id);
};
ClientJoint.prototype._createNode = function(factory){
	var nodes = [];
	nodes.push(factory(this.id));
	createAndMountNodes(nodes, this.id);
};
ClientJoint.prototype.render = function(angleY){
	if (this.pos) {
		setNodeXYZ(this.id + '-translate', this.pos);
		SceneJS.withNode(this.id + '-rotate-y').set('angle', angleY);
	}
};

function ClientEdgePoints(type){
	mycs.superClass(ClientEdgePoints).constructor.apply(this, [type]);
	this._createNode();
}
mycs.inherit(ClientEdgePoints, cs.EdgePoints);
ClientEdgePoints.prototype.destroy = function(){
	removeNode(this.id);
};
ClientEdgePoints.prototype._createNode = function(){
	var nodes = [];
	for (var i = 0; i < cs.EdgePoints.NUM; i++) {
		nodes.push({
			type: 'translate',
			id: this.id + '-' + i + '-translate',
			nodes: [{
				type: 'material',
				baseColor:	  { r: 0.0, g: 1.0, b: 0.0 },
				shine:          4.0,
				nodes: [{
					type : 'cube',
					xSize: cs.EdgePoints.H_SIZE,
					ySize : cs.EdgePoints.H_SIZE,
					zSize : cs.EdgePoints.H_SIZE
				}]
			}]
		});
	}
	createAndMountNodes(nodes, this.id);
};
ClientEdgePoints.prototype.render = function(){
	for (var i = 0; i < cs.EdgePoints.NUM; i++) {
		if (this.poss[i]) {
			setNodeXYZ(this.id + '-' + i + '-translate', this.poss[i]);
		}
	}
};

function Block(id, pos, r, color){
	mycs.superClass(Block).constructor.apply(this, [pos, 'block', id]);
	this.r = r;
	this.color = mycs.deepCopy(color);
	this._createNode();
}
mycs.inherit(Block, Unit);
Block.prototype._createNode = function(){
	mycs.superClass(Block)._createNode.apply(this, [{
		type: 'material',
		baseColor: this.color,
		shine: 4.0,
		nodes: [{
			type : 'cube'
		}]
	}]);
	this.updateScale(this.r, this.r, this.r);
	var self = this;
	SceneJS.withNode(this.id).bind('picked', function(e) {
		remoteProxy.send({
			type: 'destroy_block_request',
			arg: {
				id: self.id
			}
		});
	});
};
var EYE_Y = 15;
var EYE_LOOK_Y = 10;
function ViewerEye(){
	this.pos = {x:0, z:0};
	this.angleY = 0;
}
ViewerEye.prototype.move = function(dir){
	var angle = this.angleY;
	if (dir === 'up') {
		angle -= 180;
	}
	var diff = cs.calcRoatatePosition({
		x: 0,
		y: angle,
		z: 0
	}, 2);
	this.pos.x += diff[0];
	this.pos.y += diff[1];
	this.pos.z += diff[2];

	this.updateEye();
};
ViewerEye.prototype.turn = function(diff){
	this.angleY += diff;
	this.updateEye();
};
ViewerEye.prototype.updateEye = function(){
	var eye = SceneJS.withNode('eye');
	var newPos = cs.calcRoatatePosition({x:0, y:this.angleY, z:0}, 30);
	eye.set('eye', {x: this.pos.x + newPos[0], y: EYE_Y, z: this.pos.z + newPos[2]});
	eye.set('look', {x: this.pos.x, y: EYE_LOOK_Y, z: this.pos.z});
};

function ClientPlayer(id, opt_basePos, opt_angleY){
	this.type = 'player';
	this.id = id;
	this.noPos = true;
	this.HMDAngle = null;
	this.lastBlockPos = null;
	this.paintingMode = false;
	var factory = {
		createJoint: function(type, player){
			return new ClientJoint(type, player);
		},
		createEdgePoints: function(type){
			return new ClientEdgePoints(type);
		}
	};
	mycs.superClass(ClientPlayer).constructor.apply(this, [factory, opt_basePos, opt_angleY]);
	field.addPiece(this, this.id);
}
mycs.inherit(ClientPlayer, cs.Player);
ClientPlayer.prototype.destroy = function(){
	for (var k in this.joints) {
		var joint = this.joints[k];
		if (!joint) {
			continue;
		}
		joint.destroy();
	}
	for (k in this.edgePoints) {
		var edgePoint = this.edgePoints[k];
		if (!edgePoint) {
			continue;
		}
		edgePoint.destroy();
	}
	field.removePiece(this.id);
};
ClientPlayer.prototype.setJointPosition = function(positions){
	mycs.superClass(ClientPlayer).setJointPosition.apply(this, [positions]);
	if (this.noPos) {
		this.updateEye();
		this.noPos = false;
	}
};
ClientPlayer.prototype.updateEye = function(){
	if (this.isMyPlayer() && this.joints['HEAD'].pos) {
		var headPos = this.joints['HEAD'].pos;
		var eye = SceneJS.withNode('eye');
		if (useVR920) {
			if (!this.HMDAngle) {
				return;
			}
			var angleY = this.HMDAngle.yaw * (180.0 / 32768) + 180;
			var angleX = this.HMDAngle.pitch * (90.0 / 16384);
			var angleZ = this.HMDAngle.roll * (180.0 / 32768);
			
			var diff = cs.calcRoatatePosition({x: angleX, y: angleY + this.angleY, z: angleZ}, 10);	// todo: fix bug
			
			var p = (Math.sqrt(Math.pow(cs.Joint.H_SIZE, 2) * 2) + 0.1) / 10;
			eye.set('eye', {x: headPos.x + diff[0] * p, y: headPos.y + diff[1] * p, z: headPos.z + diff[2] * p});
			eye.set('look', {x: headPos.x + diff[0], y: headPos.y + diff[1], z: headPos.z + diff[2]});
		} else {
			var newPos = cs.calcRoatatePosition({x:0, y:this.angleY, z:0}, 30);
			eye.set('eye', {x: headPos.x + newPos[0], y: EYE_Y, z: headPos.z + newPos[2]});
			eye.set('look', {x: headPos.x, y: EYE_LOOK_Y, z: headPos.z});
		}
	}
};
ClientPlayer.prototype.turn = function(diff){
	mycs.superClass(ClientPlayer).turn.apply(this, [diff]);
	this.updateEye();
};
ClientPlayer.prototype.setBasePosition = function(pos){
	mycs.superClass(ClientPlayer).setBasePosition.apply(this, [pos]);
	this.updateEye();
};
ClientPlayer.prototype.isMyPlayer = function(){
	return (this.id === myPlayerId);
};
ClientPlayer.prototype.render = function(){
	for (var k in this.joints) {
		var joint = this.joints[k];
		if (!joint) {
			continue;
		}
		joint.render(this.angleY);
	}
	for (var i = 0, len = this.edgePoints.length; i < len; i++) {
		var points = this.edgePoints[i];
		points.render();
	}
	if (this.paintingMode) {
		this.createBlock();
	}
	
	if (useVR920) {
		this.updateEye();
	}
};
ClientPlayer.prototype.createBlock = function() {
	var rightHand = this.joints['RIGHT_HAND'];
	if (!rightHand || !rightHand.pos) {
		return;
	}
	if (!this.lastBlockPos || (this.lastBlockPos && cs.calcDistance(this.lastBlockPos, rightHand.pos) > 0.4)) {
		remoteProxy.send({
			type: 'create_block_request',
			arg: {
				pos: rightHand.pos
			}
		});
		this.lastBlockPos = mycs.deepCopy(rightHand.pos);
	}
};
ClientPlayer.prototype.setHMDAngle = function(angle){
	this.HMDAngle = angle;
};
ClientPlayer.prototype.startPaint = function(){
	this.paintingMode = true;
};
ClientPlayer.prototype.endPaint = function(){
	this.paintingMode = false;
};

function Counter(){
	this.fpsCounter = new mycs.XPSCounter();
	this.remotePacketCounter = new mycs.XPSCounter();
	this.devicePacketCounter = new mycs.XPSCounter();
}
Counter.FPS = 0;
Counter.REMOTE_PACKET = 1;
Counter.DEVIDE_PACKET = 2;
Counter.prototype.render = function(){
	if (this.fpsCounter.update() ||
		this.remotePacketCounter.update() ||
		this.devicePacketCounter.update()) {
		$('#packet_per_second_from_remote').text(this.remotePacketCounter.prevCount + ' packet frames / second from remote');
		$('packet_per_second_from_device').text(this.devicePacketCounter.prevCount + ' packet frames / second from device');
		$('#fps').text(this.fpsCounter.prevCount + ' / ' + FPS + ' fps (Exclude Event\'s update)');
		$('#block_number').text(field.getPiecesByType('block').length + ' blocks');
	}
};
Counter.prototype.increment = function(type){
	switch (type) {
	case Counter.FPS:
		this.fpsCounter.increment();
		break;
	case Counter.REMOTE_PACKET:
		this.remotePacketCounter.increment();
		break;
	case Counter.DEVIDE_PACKET:
		this.devicePacketCounter.increment();
		break;
	}
};

function RenderingTimer(){
	this.timer = -1;
}
RenderingTimer.prototype.start = function(){
//	var requestAnimationFrame = window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame;
	var requestAnimationFrame = null;
	if (requestAnimationFrame) {
		window.webkitRequestAnimationFrame(function step() {
			render();
			requestAnimationFrame(step);
		});
	} else {
		if (this.timer === -1) {
			this.timer = setInterval(function(){ render(); }, 1000 / FPS);
		}
	}
};
RenderingTimer.prototype.stop = function(){
	if (this.timer !== -1) {
		clearInterval(this.timer);
		this.timer = -1;
	}
};

function switchHMDMode(){
	useVR920 = !useVR920;
	var ele = $('#swith_VR920_mode');
	if (useVR920) {
		ele.text('VR920 off');
	} else {
		var player = field.getPiece(myPlayerId);
		if (player) {
			player.updateEye();
		}
		ele.text('VR920 on');
	}
}

function createUnit(data) {
	switch(data.arg.type){
	case 'player':
		new ClientPlayer(data.arg.id, data.arg.basePos, data.arg.angleY);
		break;
	case 'block':
		new Block(data.arg.id, data.arg.pos, data.arg.r, data.arg.color);
		break;
	default:
		ASSERT(false);
		break;
	}
}
var remoteMessageHandlers = {
	start_paint: handleDeviceMessage,
	end_paint: handleDeviceMessage,
	switch_hmd_mode: function(data) {
		switchHMDMode();
	},
	controller_list: function(data) {
		nobindConrollers.update(data.arg.list);
	},
	set_player_id: function(data) {
		$('#player_info').css('display', 'block');
		myPlayerId = data.arg.id;
	},
	kinect_joint_postion: function(data) {
		var player = field.getPiece(data.arg.id);
		if (!player) {
			return;
		}
		player.setJointPosition(data.arg.positions);
	},
	set_base_position: function(data) {
		var player = field.getPiece(data.arg.id);
		if (!player) {
			return;
		}
		player.setBasePosition(data.arg.pos);
	},
	turn: function(data) {
		var player = field.getPiece(data.arg.id);
		if (!player) {
			return;
		}
		player.turn(data.arg.diff);
	},
	move: function(data) {
		var player = field.getPiece(data.arg.id);
		if (!player) {
			return;
		}
		player.move(data.arg.dir);
	},
	send_map: createUnit,
	create: createUnit,
	destroy: function(data) {
		var piece = field.getPiece(data.arg.id);
		if (piece) {
			piece.destroy();
		}
	},
	echo_response: function(data) {
		$('#echo_info').text('Echo TAT: ' + (Date.now() - data.arg.timestamp) + ' ms');
	},
	clear_all_blocks: function(data) {
		field.destroyPiecesByType('block');
	},
	/*
	joint_pos: function(data) {
		var player = field.getPiece(data.arg.id);
		if (!player) {
			return;
		}
		player.joints[data.arg.type].setPosition(data.arg.pos);
	},
	edge_point_pos: function(data) {
		var player = field.getPiece(data.arg.id);
		if (!player) {
			return;
		}
		player.edge_points[data.arg.type].setPosition(data.arg.index, data.arg.pos);
	},
	*/
	browser_count: function(data) {
		$('#browser_count').text(data.arg.count + ' browsers connected.');
	}
};

var kinectBasePosX = -1;
var kinectBasePosZ = -1;
function updateKinectBasePosition(positions){
	var sumX = 0, sumZ = 0;
	for (var i = 0, len = positions.length; i < len; i++) {
		sumX += positions[i].x;
		sumZ += positions[i].z;
	}
	kinectBasePosX = sumX / len;
	kinectBasePosZ = sumZ / len;
}

function adjustKinectPositions(positions){
	for (var i = 0, len = positions.length; i < len; i++) {
		positions[i].x -= kinectBasePosX;
		positions[i].z -= kinectBasePosZ;
	}
}

var deviceMessageHandlers = {
	kinect_joint_postion: function(data) {
		if (myPlayerId === -1) {
			remoteProxy.send({	// todo: fix duplication of invoking
				type: 'create_player_request',
				arg: {
					id: myEnemyId
				}
			});
			updateKinectBasePosition(data.arg.positions);
		} else {
			adjustKinectPositions(data.arg.positions);
			var player = field.getPiece(myPlayerId);
			if (player) {
				player.setJointPosition(data.arg.positions);
			}
		}
	},
	vr920: function(data) {
		var player = field.getPiece(myPlayerId);
		if (player) {
			player.setHMDAngle({yaw: data.arg.yaw, pitch: data.arg.pitch, roll: data.arg.roll});
		}
	},
	start_paint: function(data) {
		var player = field.getPiece(myPlayerId);
		if (player) {
			player.startPaint();
		}
	},
	end_paint: function(data) {
		var player = field.getPiece(myPlayerId);
		if (player) {
			player.endPaint();
		}
	}
};

function handleDeviceMessage(data) {
	counter.increment(Counter.DEVIDE_PACKET);
	var handler = deviceMessageHandlers[data.type];
	if (handler) {
		handler(data);
	} else {
		ASSERT('Unexpected command from device server: ' + data);
	}
}

function render() {
	var pieces = field.getAllPieces();
	for (var i = 0, len = pieces.length; i < len; i++) {
		pieces[i].render();
	}
	counter.increment(Counter.FPS);
	counter.render();
	if (DEBUG) {
//		$('#pieces_count').text(field.getAllPieces().length);
	}
	SceneJS.withNode('the-scene').render();
}

function DummyRemoteProxy(port, openProc, messageProc, closeProc, opt_fullDomain){
	mycs.superClass(DummyRemoteProxy).constructor.apply(this, [port, openProc, messageProc, closeProc, opt_fullDomain]);
	setTimeout(function() {
		openProc();
	}, 0);
	this.createRequested = false;
}
mycs.inherit(DummyRemoteProxy, myc.Proxy);
DummyRemoteProxy.prototype.send = function(message) {
	var self = this;
	var newMesssage = mycs.deepCopy(message);
	switch(message.type) {	// todo: fix move and turn
	case 'move_request':
		newMesssage.type = 'move';
		newMesssage.arg.id = myPlayerId;
		setTimeout(function() {
			self.messageProc(newMesssage);
		}, 0);
		break;
	case 'turn_request':
		newMesssage.type = 'turn';
		newMesssage.arg.id = myPlayerId;
		setTimeout(function() {
			self.messageProc(newMesssage);
		}, 0);
		break;
	case 'create_player_request':
		if (this.createRequested) {
			return;
		}
		this.createRequested = true;
		var id = mycs.createId(cs.ID_SIZE);
		setTimeout(function() {
			self.messageProc({
				type: 'set_player_id',
				arg: {
					id: id
				}
			});
			setTimeout(function() {
				self.messageProc({
					type: 'create',
					arg: {
						type: 'player',
						id: id
					}
				});
			}, 0);
		}, 0);
		break;
	}
};

function DummyDeviceProxy(port, openProc, messageProc, closeProc, opt_fullDomain){
	mycs.superClass(DummyDeviceProxy).constructor.apply(this, [port, openProc, messageProc, closeProc, opt_fullDomain]);
	var len = dummyDeviceData.length;
	var count = 0;
	setTimeout(function() {
		openProc();
		var timer = setInterval(function() {
			var data = dummyDeviceData[count];
			messageProc(mycs.deepCopy(data));
			count++;
			if (count >= len) {
				clearInterval(timer);
			}
		}, 20);
	}, 0);
}
mycs.inherit(DummyDeviceProxy, myc.Proxy);

function startDeviceProcy() {
	var deviceProxyClass;
	if (window.dummyDeviceData !== undefined) {
		deviceProxyClass = DummyDeviceProxy;
	} else {
		deviceProxyClass = myc.SocketIoProxy;
	}
	deviceProxy = new deviceProxyClass(
		devicePort,
		function(){
			LOG('device proxy open');
		},
		function(data) {
			handleDeviceMessage(data);
		},
		function(){
			LOG('device proxy close');
		},
		'127.0.0.1'
	);
}

function startRemoteProcy() {
	var remoteProxyClass;
	if (useDummyRemote) {
		remoteProxyClass = DummyRemoteProxy;
	} else {
		remoteProxyClass = myc.SocketIoProxy;
	}
	var echoTimer = -1;
	remoteProxy = new remoteProxyClass(
		cs.REMOTE_PORT,
		function(){
			LOG('remote proxy open');
			startDeviceProcy();
			nobindConrollers = new NobindControllers();
			echoTimer = setInterval(function() {
				remoteProxy.send({
					type: 'echo_request',
					arg: {
						timestamp: Date.now()
					}
				});
			}, 10000);
		},
		function(data) {
			counter.increment(Counter.REMOTE_PACKET);
			if (data.type !== 'kinect_joint_postion' && data.arg && data.arg.type === 'player') {
				LOG(data.type);
			}
			var handler = remoteMessageHandlers[data.type];
			if (handler) {
				handler(data);
			} else {
				ASSERT('Unexpected command from remote server: ' + data);
			}
		},
		function(){
			clearInterval(echoTimer);
			LOG('remote proxy close');
		}
	);
}

window.addEventListener('load', function() {
	counter = new Counter();
	var canvas = $('#main_canvas')
		.prop('width', document.body.clientWidth)
		.prop('height', document.body.clientHeight);

	var canvasOffset = canvas.offset();
	var info = $('#info')
		.css('left', canvasOffset.left + window.scrollX + 10)
		.css('top', canvasOffset.top + window.scrollY + 10);
	
	field = new ClientField(canvas.prop('width') / canvas.prop('height'));
	viewerEye = new ViewerEye();
	viewerEye.updateEye();
	startRemoteProcy();
	$('#swith_VR920_mode').bind('click', switchHMDMode);

	renderingTimer = new RenderingTimer();
	renderingTimer.start();
}, false);

window.addEventListener('keydown', function(e) {
	var eye_pos;
	switch(e.keyCode){
	case KeyEvent.DOM_VK_P:
		eye_pos = mycs.deepCopy(LOOK_AT_EYE);
		eye_pos.z = -eye_pos.z;
		SceneJS.withNode('eye').set('eye', eye_pos);
		e.preventDefault();
		break;
	case KeyEvent.DOM_VK_UP:
	case KeyEvent.DOM_VK_DOWN:
		var dir = myc.keyCodeToDir[e.keyCode];
		if (myPlayerId === -1) {
			viewerEye.move(dir);
		} else {
			remoteProxy.send({
				type: 'move_request',
				arg: {
					dir: dir
				}
			});
		}
		e.preventDefault();
		break;
	case KeyEvent.DOM_VK_RIGHT:
	case KeyEvent.DOM_VK_LEFT:
		var diff = {'right': -10, 'left': 10}[myc.keyCodeToDir[e.keyCode]];
		if (myPlayerId === -1) {
			viewerEye.turn(diff);
		} else {
			remoteProxy.send({
				type: 'turn_request',
				arg: {
					diff: diff
				}
			});
		}
		e.preventDefault();
		break;
	}
}, false);

})();

