#!/bin/bash

i=0
while [ $i -lt 10 ];
do
	node test.js &
	i=`expr $i + 1`
done

