/*global KeyEvent, WebSocket, io, myModules, exports, JSON, LOG, ASSERT, Image, xyz */
/*global Class */
(function(){
var module;
if (typeof exports == 'undefined') {
	exports = {};
}
var mycs;
if (typeof myModules != 'undefined') {
	mycs = myModules.mycs;
	module = myModules.myc = {};
} else {
	module = exports;
}

if (typeof KeyEvent == 'undefined') {
	this.KeyEvent = {
		DOM_VK_CANCEL: 3,
		DOM_VK_HELP: 6,
		DOM_VK_BACK_SPACE: 8,
		DOM_VK_TAB: 9,
		DOM_VK_CLEAR: 12,
		DOM_VK_RETURN: 13,
		DOM_VK_ENTER: 14,
		DOM_VK_SHIFT: 16,
		DOM_VK_CONTROL: 17,
		DOM_VK_ALT: 18,
		DOM_VK_PAUSE: 19,
		DOM_VK_CAPS_LOCK: 20,
		DOM_VK_ESCAPE: 27,
		DOM_VK_SPACE: 32,
		DOM_VK_PAGE_UP: 33,
		DOM_VK_PAGE_DOWN: 34,
		DOM_VK_END: 35,
		DOM_VK_HOME: 36,
		DOM_VK_LEFT: 37,
		DOM_VK_UP: 38,
		DOM_VK_RIGHT: 39,
		DOM_VK_DOWN: 40,
		DOM_VK_PRINTSCREEN: 44,
		DOM_VK_INSERT: 45,
		DOM_VK_DELETE: 46,
		DOM_VK_0: 48,
		DOM_VK_1: 49,
		DOM_VK_2: 50,
		DOM_VK_3: 51,
		DOM_VK_4: 52,
		DOM_VK_5: 53,
		DOM_VK_6: 54,
		DOM_VK_7: 55,
		DOM_VK_8: 56,
		DOM_VK_9: 57,
		DOM_VK_SEMICOLON: 59,
		DOM_VK_EQUALS: 61,
		DOM_VK_A: 65,
		DOM_VK_B: 66,
		DOM_VK_C: 67,
		DOM_VK_D: 68,
		DOM_VK_E: 69,
		DOM_VK_F: 70,
		DOM_VK_G: 71,
		DOM_VK_H: 72,
		DOM_VK_I: 73,
		DOM_VK_J: 74,
		DOM_VK_K: 75,
		DOM_VK_L: 76,
		DOM_VK_M: 77,
		DOM_VK_N: 78,
		DOM_VK_O: 79,
		DOM_VK_P: 80,
		DOM_VK_Q: 81,
		DOM_VK_R: 82,
		DOM_VK_S: 83,
		DOM_VK_T: 84,
		DOM_VK_U: 85,
		DOM_VK_V: 86,
		DOM_VK_W: 87,
		DOM_VK_X: 88,
		DOM_VK_Y: 89,
		DOM_VK_Z: 90
	};
}
var keyToDir = {};
module.keyToDir = keyToDir;
keyToDir[KeyEvent.DOM_VK_UP] = 'up';
keyToDir[KeyEvent.DOM_VK_DOWN] = 'down';
keyToDir[KeyEvent.DOM_VK_LEFT] = 'left';
keyToDir[KeyEvent.DOM_VK_RIGHT] = 'right';


var keyCodeToDir = {};
keyCodeToDir[KeyEvent.DOM_VK_LEFT] = 'left';
keyCodeToDir[KeyEvent.DOM_VK_RIGHT] = 'right';
keyCodeToDir[KeyEvent.DOM_VK_UP] = 'up';
keyCodeToDir[KeyEvent.DOM_VK_DOWN] = 'down';
module.keyCodeToDir = keyCodeToDir;

function Proxy(port, openProc, messageProc, closeProc, opt_fullDomain) {
	this.messageProc = messageProc;
	this.openProc = openProc;
	this.closeProc = closeProc;
	if (typeof opt_fullDomain == 'undefined') {
		this.fullDomain = location.href.split('/')[2].split(':')[0];
	} else {
		this.fullDomain = opt_fullDomain;
	}
	this.heartbeatTimer = -1;
}
module.Proxy = Proxy;
Proxy.prototype.handleMessage = function(message) {
	if (this.messageProc) {
		this.messageProc(message);
	}
};
Proxy.prototype.handleOpen = function(){
	var self = this;
	this.heartbeatTimer = setInterval(function() {
		/*
		self.send({
			type: '_heartbeat'
		});
		*/
	}, 5000);
	this.openProc();
};
Proxy.prototype.handleClose = function(){
	clearInterval(this.heartbeatTimer);
	this.closeProc();
};
Proxy.prototype.send = function(data){
	this._send(data);
};
Proxy.prototype._send = function(data){
	ASSERT(false);
};

function SocketIoProxy(port, openProc, messageProc, closeProc, opt_fullDomain){
	mycs.superClass(SocketIoProxy).constructor.apply(this, [port, openProc, messageProc, closeProc, opt_fullDomain]);

	this._socket = new io.connect(this.fullDomain + ':' + port); 
	var self = this;
	this._socket.on('connect', function() {
		self.handleOpen();
	});
	this._socket.on('message', function(message){
		self.handleMessage(message);
	});
	this._socket.on('disconnect', function(){
		self.handleClose();
	});
}
mycs.inherit(SocketIoProxy, Proxy);
module.SocketIoProxy = SocketIoProxy;
SocketIoProxy.prototype._send = function(data){
	this._socket.emit('message', data);
};
SocketIoProxy.prototype.close = function(){
};

module.switchFullscreen = function(target) {
	var query, request, cancel;
	['fullScreen', 'webkitIsFullScreen','mozFullScreen'].forEach(function(p) {
		if (document[p] !== undefined) {
			query = p;
		}
	});
	['requestFullScreen', 'webkitRequestFullScreen', 'mozRequestFullScreen'].forEach(function(p) {
		if (target[p] !== undefined) {
			request = p;
		}
	});
	['cancelFullScreen', 'webkitCancelFullScreen', 'mozCancelFullScreen'].forEach(function(p) {
		if (document[p] !== undefined) {
			cancel = p;
		}
	});
	if (query && request && cancel) {
		if (document[query]) {
			document[cancel]();
		} else {
			target[request]();
		}
	}
};

module.parseQuery = function(){
	var query = {};
	var queryString = location.href.split('?')[1];
	if (!queryString) {
		return query;
	}
	var words = queryString.split('&');
	for (var i = 0, iLen = words.length; i < iLen; i++) {
		var word = words[i];	
		if(word.indexOf('=') !== -1) {
			var ts = word.split('=');
			if (ts[1]) {
				query[ts[0]] = ts[1];
			}
		}
	}
	return query;
};

module.sceneColorToCSSClor = function(color) {
	function cssColorPart(value) {
		return ('00' + (0xFF * value).toString(16)).slice(-2);
	}
	return '#' + cssColorPart(color.r) + cssColorPart(color.g) + cssColorPart(color.b);
};


// if body element doesn't have the scroll bar, can't hide the address bar on android.
module.hideAddressBar = function(opt_force, opt_proc) {
	setTimeout(function() {
		if (opt_force || window.pageYOffset === 0) {
			window.scrollTo(0, 1);
		}
		if (opt_proc) {
			opt_proc();
		}
	}, 0);
};

module.preLoadImages = function(urls, optProc) {
	var images = {};
	var count = urls.length;
	var err = false;
	for (var i = 0, len = urls.length; i < len; i++) {
		var url = urls[i];
		var img = new Image();
		img.addEventListener('load', function() {
			count--;
			if (count === 0 && optProc) {
				optProc(err);
			}
		}, false);
		img.addEventListener('error', function() {
			err = true;
			count--;
			if (count === 0 && optProc) {
				optProc(err);
			}
		}, false);
		img.src = url;
		images[url] = img;
	}
	if (urls.length === 0 && optProc) {
		optProc(err);
	}
};

/* Simple JavaScript Inheritance
 * By John Resig http://ejohn.org/
 * MIT Licensed.
 */
// Inspired by base2 and Prototype
// Some jsLint warnings are fixed by snow */
(function(){
  var initializing = false, fnTest = /xyz/.test(function(){return xyz;}) ? (/\b_super\b/) : (/.*/);
 
  // The base Class implementation (does nothing)
  this.Class = function(){};
 
  // Create a new Class that inherits from this class
  Class.extend = function(prop) {
    var _super = this.prototype;
   
    // Instantiate a base class (but only create the instance,
    // don't run the init constructor)
    initializing = true;
    var prototype = new this();
    initializing = false;
   
    // Copy the properties over onto the new prototype
    for (var name in prop) {
      // Check if we're overwriting an existing function
      prototype[name] = typeof prop[name] == "function" &&
        typeof _super[name] == "function" && fnTest.test(prop[name]) ?
        (function(name, fn){
          return function() {
            var tmp = this._super;
           
            // Add a new ._super() method that is the same method
            // but on the super-class
            this._super = _super[name];
           
            // The method only need to be bound temporarily, so we
            // remove it when we're done executing
            var ret = fn.apply(this, arguments);       
            this._super = tmp;
           
            return ret;
          };
        })(name, prop[name]) :
        prop[name];
    }
   
    // The dummy class constructor
    function Class() {
      // All construction is actually done in the init method
      if ( !initializing && this.init ) {
        this.init.apply(this, arguments);
	  }
    }
   
    // Populate our constructed prototype object
    Class.prototype = prototype;
   
    // Enforce the constructor to be what we expect
    Class.constructor = Class;

    // And make this class extendable
    Class.extend = arguments.callee;
   
    return Class;
};
})();

})();
