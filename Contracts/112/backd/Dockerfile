FROM ubuntu:20.04

RUN apt-get update && apt-get install -y build-essential git curl python3 python3-pip
RUN curl -sL https://deb.nodesource.com/setup_12.x | bash
RUN apt-get install -y nodejs
RUN mkdir /root/.npm && chown -R 65534:0 /root/.npm
RUN npm install -g ganache@alpha
RUN pip3 install wheel brownie-token-tester
RUN pip3 install -U --force-reinstall git+https://github.com/danhper/brownie.git
RUN brownie networks modify development evm_version=london
