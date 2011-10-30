/*global require, process, global, JSON */
/*global DP, LOG, ASSERT, DIR, DPD, client, websocket */
var sio = require('socket.io');
var should = require('./lib/common');
var mycs = require('../lib/my/my_client_and_server');
var mys = require('../lib/my/my_server');
var cs = require('../client_and_server/client_and_server');
mycs.setShorthands(global);

function Client() {
	this.count = 0;
	var self = this;
	
	var cl = client('www2.syspri.org', cs.REMOTE_PORT)
	  , ws;
	cl.handshake(function (sid) {
		ws = websocket(cl, sid);
		ws.on('open', function (socket) {
	        	DP('open');
		});
		ws.on('message', function (msg) {
			if (msg.name === 'message') {
				if (msg.args[0].type === 'send_map') {
					self.count ++;
					if (self.count > 100) {
						DP(self.count / 100);
						ws.close();
						cl.end();
					}
				}
			}
		});
	});
}

for (var i = 0; i < 4; i++) {
	new Client();
}
