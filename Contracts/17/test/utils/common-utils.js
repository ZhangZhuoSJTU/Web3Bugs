'use strict'

const { BN, toBN } = require('web3-utils')
const abi = require('ethereumjs-abi')
const chai = require('chai')
chai.use(require('chai-bn')(BN))
chai.use(require('chai-as-promised'))
chai.should()
const expect = chai.expect
const ZERO = '0x0000000000000000000000000000000000000000';

const thousandBaseNum = toBN(10).pow(toBN(3)),
  millionBaseNum = toBN(10).pow(toBN(6)),
  billionBaseNum = toBN(10).pow(toBN(8)),
  lgBaseNum = toBN(10).pow(toBN(18)),
  daiBaseNum = toBN(10).pow(toBN(18)),
  usdcBaseNum = toBN(10).pow(toBN(6)),
  usdtBaseNum = toBN(10).pow(toBN(6))

const sumTotal = function (nums) {
  let total = new BN(0)
  nums.forEach((element) => {
    total = total.add(element)
  })
  return total
}

const wait = function (ms) {
  new Promise((resolve) => setTimeout(resolve, ms))
}

const stableCoinsRatios = {
  daiRatio: toBN(3800),
  usdcRatio: toBN(2600),
  usdtRatio: toBN(3600),
}

const encodeCall = function (name, args, values) {
  const methodId = abi.methodID(name, args).toString('hex')
  const params = abi.rawEncode(args, values).toString('hex')
  return '0x' + methodId + params
}

// start and end need be bigNumber
function expectBignumberBetween(actual, start, end) {
  const [max, min] = start.gt(end) ? [start, end] : [end, start]
  console.log('actual : ' + actual.toString())
  console.log('start : ' + start.toString())
  console.log('end : ' + end.toString())
  expect(actual).to.be.a.bignumber.above(min)
  expect(actual).to.be.a.bignumber.most(max)
}

// start and end need be bigNumber
function expectBignumberBetweenInclude(actual, start, end) {
  const [max, min] = start.gte(end) ? [start, end] : [end, start]
  console.log('actual : ' + actual.toString())
  console.log('start : ' + start.toString())
  console.log('end : ' + end.toString())
  expect(actual).to.be.a.bignumber.least(min)
  expect(actual).to.be.a.bignumber.most(max)
}

function decodeLogs(logs, emitter, address, eventName) {
  let abi;
  abi = emitter.abi;

  let eventABI = abi.filter(x => x.type === 'event' && x.name === eventName);
  if (eventABI.length === 0) {
    throw new Error(`No ABI entry for event '${eventName}'`);
  } else if (eventABI.length > 1) {
    throw new Error(`Multiple ABI entries for event '${eventName}', only uniquely named events are supported`);
  }

  eventABI = eventABI[0];

  // The first topic will equal the hash of the event signature
  const eventSignature = `${eventName}(${eventABI.inputs.map(input => input.type).join(',')})`;
  const eventTopic = web3.utils.sha3(eventSignature);

  // Only decode events of type 'EventName'
  return logs
    .filter(log => log.topics.length > 0 && log.topics[0] === eventTopic && (!address || log.address === address))
    .map(log => web3.eth.abi.decodeLog(eventABI.inputs, log.data, log.topics.slice(1)))
    .map(decoded => ({ event: eventName, args: decoded }));
}

async function expectBignumberPromiseCloseTo(
  promise,
  expect,
  approximationFactor,
  desc,
) {
  await expect(promise).to.eventually.be.a.bignumber.closeTo(
    expect,
    approximationFactor,
    desc,
  )
}

async function expectBignumberPromiseEqual(promise, expect, desc) {
  await expect(promise).to.eventually.be.a.bignumber.equal(expect, desc)
}

module.exports = {
  expectBignumberBetween,
  expectBignumberBetweenInclude,
  expectBignumberPromiseCloseTo,
  expectBignumberPromiseEqual,
  decodeLogs,
  sumTotal,
  chai,
  expect,
  wait,
  encodeCall,
  thousandBaseNum,
  millionBaseNum,
  billionBaseNum,
  ZERO,
}
