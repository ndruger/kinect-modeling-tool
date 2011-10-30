
/*!
 * socket.io-node
 * Copyright(c) 2011 LearnBoost <dev@learnboost.com>
 * MIT Licensed
 */

/**
 * Test dependencies.
 */

var io = require('socket.io')
  , parser = io.parser
  , http = require('http')
  , https = require('https')
//  , WebSocket = require('../support/node-websocket-client/lib/websocket').WebSocket;
  , WebSocket = require('websocket-client').WebSocket;

/**
 * Exports.
 */

var should = module.exports = require('should');

should.HTTPClient = HTTPClient;

/**
 * Client utility.
 *
 * @api publiC
 */

function HTTPClient (host, port) {
  this.host = host;
  this.port = port;
  this.agent = new http.Agent({
      host: host
    , port: port
  });
};

/**
 * Issue a request
 *
 * @api private
 */

HTTPClient.prototype.request = function (path, opts, fn) {
  if ('function' == typeof opts) {
    fn = opts;
    opts = {};
  }

  opts = opts || {};
  opts.agent = this.agent;
  opts.host = this.host;
  opts.port = this.port;
  opts.path = path.replace(/{protocol}/g, io.protocol);

  opts.headers = opts.headers || {};
  opts.headers.Host = this.host;
  opts.headers.Connection = 'keep-alive';

  var req = http.request(opts, function (res) {
    if (false === opts.buffer)
      return fn && fn(res);

    var buf = '';

    res.on('data', function (chunk) {
      buf += chunk;
    });

    res.on('end', function () {
      fn && fn(res, opts.parse ? opts.parse(buf) : buf);
    });
  });

  req.on('error', function (err) { });

  if (undefined !== opts.data)
    req.write(opts.data);

  req.end();

  return req;
};

/**
 * Terminates the client and associated connections.
 *
 * @api public
 */

HTTPClient.prototype.end = function () {
  this.agent.sockets.forEach(function (socket) {
    socket.end();
  });
};

/**
 * Issue a GET request
 *
 * @api public
 */

HTTPClient.prototype.get = function (path, opts, fn) {
  if ('function' == typeof opts) {
    fn = opts;
    opts = {};
  }

  opts = opts || {};
  opts.method = 'GET';

  // override the parser for transport requests
  if (/\/(xhr-polling|htmlfile|jsonp-polling)\//.test(path)) {
    // parser that might be necessary for transport-specific framing
    var transportParse = opts.parse;
    opts.parse = function (data) {
      if (data === '') return data;

      data = transportParse ? transportParse(data) : data;
      return parser.decodePayload(data);
    };
  } else {
    opts.parse = undefined;
  }

  return this.request(path, opts, fn);
};

/**
 * Issue a POST request
 *
 * @api private
 */

HTTPClient.prototype.post = function (path, data, opts, fn) {
  if ('function' == typeof opts) {
    fn = opts;
    opts = {};
  }

  opts = opts || {};
  opts.method = 'POST';
  opts.data = data;

  return this.request(path, opts, fn);
};

/**
 * Issue a HEAD request
 *
 * @api private
 */

HTTPClient.prototype.head = function (path, opts, fn) {
  if ('function' == typeof opts) {
    fn = opts;
    opts = {};
  }

  opts = opts || {};
  opts.method = 'HEAD';

  return this.request(path, opts, fn);
};

/**
 * Performs a handshake (GET) request
 *
 * @api private
 */

HTTPClient.prototype.handshake = function (opts, fn) {
  if ('function' == typeof opts) {
    fn = opts;
    opts = {};
  }

  return this.get('/socket.io/{protocol}', opts, function (res, data) {
    fn && fn.apply(null, data.split(':'));
  });
};

/**
 * Generates a new client for the given port.
 *
 * @api private
 */

client = function (host, port) {
  return new HTTPClient(host, port);
};

/**
 * Create a socket.io server.
 */

create = function (cl) {
  var manager = io.listen(cl.port);
  manager.set('client store expiration', 0);
  return manager;
};

/**
 * WebSocket socket.io client.
 *
 * @api private
 */

function WSClient (host, port, sid, transport) {
  this.sid = sid;
  this.port = port;
  this.transportName = transport || 'websocket';
  WebSocket.call(
      this
    , 'ws://' + host + ':' + port + '/socket.io/' 
        + io.protocol + '/' + this.transportName + '/' + sid
  );
};

/**
 * Inherits from WebSocket.
 */

WSClient.prototype.__proto__ = WebSocket.prototype;

/**
 * Overrides message event emission.
 *
 * @api private
 */

WSClient.prototype.emit = function (name) {
  var args = arguments;

  if (name == 'message' || name == 'data') {
    args[1] = parser.decodePacket(args[1].toString());
  }

  return WebSocket.prototype.emit.apply(this, arguments);
};

/**
 * Writes a packet
 */

WSClient.prototype.packet = function (pack) {
  this.write(parser.encodePacket(pack));
  return this;
};

/**
 * Creates a websocket client.
 *
 * @api public
 */

websocket = function (cl, sid, transport) {
  return new WSClient(cl.host, cl.port, sid, transport);
};
