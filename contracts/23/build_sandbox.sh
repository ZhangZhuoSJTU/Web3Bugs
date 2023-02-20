#!/bin/bash
brownie networks delete sandbox
brownie networks add development sandbox host=http://localhost cmd="ganache-cli" port=8646 db="chaindb" network_id=1337 mnemonic="owner dignity sense" default_balance=100000


rm -Rf chaindb
mkdir chaindb

brownie run sandbox.py --network sandbox

tag=`git rev-parse --short HEAD`
docker build -t jeffywu/sandbox2:$tag .
docker tag jeffywu/sandbox2:$tag jeffywu/sandbox2:latest
docker push jeffywu/sandbox2:$tag
docker push jeffywu/sandbox2:latest