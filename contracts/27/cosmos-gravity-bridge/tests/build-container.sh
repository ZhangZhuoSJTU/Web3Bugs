#!/bin/bash
set -eux

# this directy of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
DOCKERFOLDER=$DIR/dockerfile
REPOFOLDER=$DIR/..

# change our directory sot hat the git arcive command works as expected
pushd $REPOFOLDER

#docker system prune -a -f
# Build base container
git archive --format=tar.gz -o $DOCKERFOLDER/gravity.tar.gz --prefix=gravity/ HEAD
pushd $DOCKERFOLDER
docker build -t gravity-base .
