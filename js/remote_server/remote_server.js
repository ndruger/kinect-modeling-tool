/*global require, process, global, JSON */
/*global DP, LOG, ASSERT, DIR, DPD */
/*global Enemy */
var http = require('http');
var sys = require('sys');
var fs = require('fs');
var mycs = require('../lib/my/my_client_and_server');
var mys = require('../lib/my/my_server');
var cs = require('../client_and_server/client_and_server');
var _ = require("underscore");
mycs.setShorthands(global);

var DEBUG = false;
var field, proxy, bindManager, controllerProxy, clientCount = 0, recorder;

function BindManager(){
	this.noboundMainBrowsers = {};
	this.noboundControllers = {};
	this.boundMainBrowsers = {};
	this.boundControllers = {};
}
BindManager.prototype.addMainBrowser = function(conn){
	LOG('BindManager.prototype.addMainBrowser');
	this.noboundMainBrowsers[conn.id] = conn;
	this._sendControllerList(conn);
	this.__broadcastMainBrowserCount();
};
BindManager.prototype.removeMainBrowser = function(conn){
	LOG('BindManager.prototype.removeMainBrowser');
	delete this.noboundMainBrowsers[conn.id];
	var boundController = this.boundControllers[conn.id]; 
	if (boundController) {
		this.noboundControllers[boundController.id] =  boundController;
		delete this.boundMainBrowsers[boundController.id];
		delete this.boundControllers[conn.id];
		this._broadcastControllerList();
	}
	this.__broadcastMainBrowserCount();
};
BindManager.prototype.addController = function(conn){
	LOG('BindManager.prototype.addController');
	this.noboundControllers[conn.id] = conn;
	this._broadcastControllerList();
};
BindManager.prototype.removeController = function(conn){
	LOG('BindManager.prototype.removeController');
	delete this.noboundControllers[conn.id];
	var boundMainBrowser = this.boundMainBrowsers[conn.id]; 
	if (boundMainBrowser) {
		this.noboundMainBrowsers[boundMainBrowser.id] =  boundMainBrowser;
		delete this.boundControllers[boundMainBrowser.id];
		delete this.boundMainBrowsers[conn.id];
	}
	this._broadcastControllerList();
};
BindManager.prototype._sendControllerList = function(conn){
	this._sendControllerListImp([conn]);
};
BindManager.prototype._broadcastControllerList = function(){
	var targets = _.map(this.noboundMainBrowsers, function(v) {
		return v;
	});
	this._sendControllerListImp(targets);
};
BindManager.prototype._sendControllerListImp = function(targets){
	var list = _.map(this.noboundControllers, function(v) {
		return v.id;
	});
	targets.forEach(function(conn) {
		proxy.send(conn, {type: 'controller_list', arg:{list: list}});
	});
};
BindManager.prototype.bind = function(mainBrowser, controllerId){
	delete this.noboundMainBrowsers[mainBrowser.id];
	var controller = this.noboundControllers[controllerId];
	delete this.noboundControllers[controllerId];
	this.boundMainBrowsers[controllerId] = mainBrowser;
	this.boundControllers[mainBrowser.id] = controller;
	this._broadcastControllerList();
};

BindManager.prototype.getBoundMainBrowser = function(controllerId){
	return this.boundMainBrowsers[controllerId] || null;
};
BindManager.prototype.getBoundController = function(browser){
	return this.boundControllers[browser.id] || null;
};
BindManager.prototype.__broadcastMainBrowserCount = function() {
	proxy.broadcast({
		type: 'browser_count',
		arg: {
			count: _.size(this.noboundMainBrowsers) + _.size(this.boundMainBrowsers)
		}
	});
};

function ServerField(){
	mycs.superClass(ServerField).constructor.apply(this, []);
	this.canDestroyBlock = true;
}
mycs.inherit(ServerField, cs.Field);
ServerField.prototype.sendMap = function(conn){
	_.map(this._pieces, function(piece) {
		piece.sendMap(conn);
	});
};

function Unit(point, type){
	this.id = type + mycs.createId(cs.ID_SIZE);
	this.pos = point;
	this.type = type;
	field.addPiece(this, this.id);
}
Unit.prototype.destroy = function(){
	field.removePiece(this.id);
	proxy.broadcast(this.makeSendData('destroy', {
		type: this.type,
		id: this.id
	}));
};
Unit.prototype.updatePosition = function(pos) {
	this.pos = pos;
	proxy.broadcast(this.makeSendData('update_position', {
		type: this.type,
		id: this.id,
		pos: this.pos
	}));
};
Unit.prototype.sendMap = function(conn){
	proxy.send(conn, this.makeSendData('send_map', {
		type: this.type,
		id: this.id,
		pos: this.pos
	}));
};
Unit.prototype.makeSendData = function(type, arg){
	return {
		type: type,
		arg: arg
	};
};
Unit.prototype.serialize = function(){
	return {
		type: this.type,
		id: this.id,
		pos: this.pos
	};
};

function Block(pos, palette){
	mycs.superClass(Block).constructor.apply(this, [pos, 'block']);
	this.color = palette.color;
	this.r = palette.r;

	var s = this.makeSendData('create', {
		type: this.type,
		id: this.id,
		pos: this.pos,
		r: this.r,
		color: this.color
	});
	proxy.broadcast(s);
}
mycs.inherit(Block, Unit);
Block.prototype.sendMap = function(conn){
	proxy.send(conn, this.makeSendData('send_map', {
		type: this.type,
		id: this.id,
		pos: this.pos,
		r: this.r,
		color: this.color
	}));
};
Block.prototype.serialize = function(){
	return {
		id: this.id,
		pos: this.pos,
		r: this.r,
		color: this.color
	};
};

function ServerPlayer(client, opt_basePos, opt_angleY){
	var factory = {
		createJoint: function(type, player){
			return new cs.Joint(type, player);
		},
		createEdgePoints: function(type){
			return new cs.EdgePoints(type);
		}
	};
	mycs.superClass(ServerPlayer).constructor.apply(this, [factory, opt_basePos, opt_angleY]);
	this.type = 'player';
	this.id = this.type + mycs.createId(cs.ID_SIZE);
	proxy.send(client, {
		type: 'set_player_id',
		arg: {
			id: this.id
		}
	});
	proxy.broadcast({
		type: 'create',
		arg: {
			type: this.type,
			id: this.id,
			basePos: opt_basePos,
			angleY: opt_angleY
		}
	});
	field.addPiece(this, this.id);
	
}
mycs.inherit(ServerPlayer, cs.Player);
ServerPlayer.prototype.destroy = function(){
	field.removePiece(this.id);
	proxy.broadcast({
		type: 'destroy',
		arg: {
			type: this.type,
			id: this.id
		}
	});
};
ServerPlayer.prototype.sendMap = function(client){
	proxy.send(client, {
		type: 'send_map',
		arg: {
			id: this.id,
			type: this.type,
			basePos: this.basePos,
			angleY: this.angleY
		}
	});
};

ServerPlayer.prototype.move = function(dir){
	mycs.superClass(ServerPlayer).move.apply(this, [dir]);
	proxy.broadcast({
		type: 'move',
		arg: {
			id: this.id,
			dir: dir
		}
	});
};
ServerPlayer.prototype.turn = function(diff){
	mycs.superClass(ServerPlayer).turn.apply(this, [diff]);
	proxy.broadcast({
		type: 'turn',
		arg: {
			id: this.id,
			diff: diff
		}
	});
};

var messageHandlers = {
	binding_request: function (data, client) {
		if (!client.playerId) {
			return;
		}
		bindManager.bind(client, data.arg.id);
	},
	create_player_request: function(data, client) {
		if (client.playerId) {
			return;
		}
		client.playerId = (new ServerPlayer(client)).id;
	},
	kinect_joint_postion: function(data, client) {
		recorder.record(data);
		var player = field.getPiece(client.playerId);
		if (!player) {
			return;
		}
		player.setJointPosition(data.arg.positions);
		data.arg.id = client.playerId;
		proxy.broadcastExceptFor(client, data);
	},
	move_request: function(data, client) {
		var player = field.getPiece(client.playerId);
		if (!player) {
			return;
		}
		player.move(data.arg.dir);
	},
	turn_request: function(data, client) {
		var player = field.getPiece(client.playerId);
		if (!player) {
			return;
		}
		player.turn(data.arg.diff);
	},
	echo_request: function(data, client) {
		proxy.send(client, {
			type: 'echo_response',
			arg: {
				timestamp: data.arg.timestamp
			}
		});
	},
	create_block_request: function(data, client){
		var controller = bindManager.getBoundController(client);
		if (!controller || !controller.myPalette) {
			return;
		}
		new Block(data.arg.pos, controller.myPalette);
	},
	destroy_block_request: function(data, client){
		if (!field.canDestroyBlock) {
			return;
		}
		var block = field.getPiece(data.arg.id);
		if (block) {
			block.destroy();
		}
	}
};

proxy = new mys.SocketIoProxy(cs.REMOTE_PORT, function(client){
		LOG('client connected');
		field.sendMap(client);
		bindManager.addMainBrowser(client);
	}, function(data, client) {
		var handler = messageHandlers[data.type];
		if (!handler) {
			LOG('Undefined main browser command: ' + data);
		}
		handler(data, client);
	}, function(client){
		LOG('client disconnected');
		bindManager.removeMainBrowser(client);
		if (client.playerId != -1) {
			var player = field.getPiece(client.playerId);
			if (player) {
				player.destroy();
			}
		}
	}
);

function Palette(){
	this.color = {r: 1.0, g: 0.0, b: 0.0};
	this.r = cs.DEFAULT_BLOCK_SIZE;
}
Palette.prototype.setValues = function(params) {
	this.color = params.color;
	this.r = params.r;
};

function Recorder(){
	this.fd = null;
	this.recoding = false;
}
Recorder.prototype.start = function() {
	var self = this;
	this.recoding = true;
	fs.open(Recorder.PATH, 'w', function(err, fd){
		if (err) {
			LOG('Can\'t open a recorder file.' + err);
			return;
		} 
		self.fd = fd;
	});
};
Recorder.prototype.stop = function() {
	this.recoding = false;
	if (this.fd !== null) {
		fs.close(this.fd);
		this.fd = null;
	}
};
Recorder.prototype.record = function(data) {
	if (this.fd === null || !this.recoding) {
		return;
	}
	fs.write(this.fd, JSON.stringify(data) + ',', null, null, function(err) {
		if (err) {
			LOG('Can\'t write to recorder file.' + err);
			return;
		}
	});
};
Recorder.PATH = 'record.json';

function saveModel(name) {
	if (!name || !mycs.isSafeFilename(name)) {
		return;
	}
	var blocks = field.getPiecesByType('block');
	fs.open('save/'  + name + '.json', 'w', undefined, function(err, fd){
		if (err) {
			LOG('Can\'t open the model file.' + err);
			return;
		}
		var data = _.map(blocks, function(block) {
			return block.serialize();
		});
		fs.write(fd, 'var modelData = ' + JSON.stringify(data) + ';', null, null, function(err) {
			if (err) {
				LOG('Can\'t write to the model file.' + err);
			}
			fs.close(fd);
		});
	});
}

function clearAllBlocks() {
	field.removePiecesByType('block');
	proxy.broadcast({
		type: 'clear_all_blocks'
	});
}

function recordAndForward(data, client, browserClient) {
	recorder.record(data);
	proxy.send(browserClient, {
		type: data.type
	});
}
var controllerMessageHandlers = {
	switch_hmd_mode: recordAndForward,
	start_paint: recordAndForward,
	end_paint: recordAndForward,
	start_record: function(){
		recorder.start();
	},
	end_record: function(){
		recorder.stop();
	},
	update_palette: function(data, client) {
		if (!client.myPalette) {
			return;
		}
		client.myPalette.setValues({
			color: data.arg.color,
			r: data.arg.r
		});
	},
	save_model: function(data, client){
		saveModel(data.arg.name);
	},
	clear_all_blocks: function(){
		clearAllBlocks();
	},
	set_inhibit_destroy_block_flag: function(data, client) {
		field.canDestroyBlock = !data.arg.flag;
	}
};

controllerProxy = new mys.SocketIoProxy(cs.CONTROLLER_PORT, function(client){
		LOG('controller connected');
		bindManager.addController(client);
		client.myPalette = new Palette();
		proxy.send(client, {
			type: 'notify_id',
			arg: {
				id: client.id
			}
		});
	}, function(data, client){
		var handler = controllerMessageHandlers[data.type];
		if (!handler) {
			LOG('Undefined controller command: ' + data);
		}
		var browserClient = bindManager.getBoundMainBrowser(client.id);
		if (!browserClient || browserClient.playerId === -1) {
			return;
		}
		handler(data, client, browserClient);
	}, function(client){
		LOG('controller disconnected');
		bindManager.removeController(client);
	}
);

recorder = new Recorder();
field = new ServerField();
bindManager = new BindManager();

