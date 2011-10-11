#!/bin/bash

#rsync -zr --delete -e ssh --exclude '*.oni' --exclude='*.git*' * snow@www2.syspri.org:/var/www/html/test/kinect-modeling-tool
rsync -zr --delete -e ssh --exclude '*.oni' --exclude='*.git*' * snow@www.syspri.org:/var/www/html/test/kinect-modeling-tool

