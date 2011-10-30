# Kinect 3D Modeling Tool #

## Introduction ##
Experimental Kinect 3D modeling tool


## How it work? ##
	1.Kinect --> 2.OpenNI App --[TCP]--> 3.Node.js App(local server) --[WebSocket/Comet]--> 4.Browser <--[WebSocket/Comet]--> 5.Node.js App(remote server) <--[WebSocket/Comet]--> 6.Browser

## How to use? ##

### Windows ###
#### Ready ####
- Install Node.js and some modules
- Install web server

#### Run ####
- 1. Start device server
-- > cd js\device_server
-- > node.exe device_server.js
- 2. Start UserTracker
-- > NiUserTracker\NiUserTracker.exe
- 3. Start remote server 
-- > cd js\remote_server
-- > node.exe remote_server.js
- 4. Open player
-- Open [url]/js/client/client.htm by Chrome
- 5. Open controller
-- Open [url]/js/client/controller.htm by Chrome

## License ##
MIT

### Used library ###
This repository includes following library's source code. These own license applies to the source code.

- glMatrix.js
- SceneJS
- underscore

