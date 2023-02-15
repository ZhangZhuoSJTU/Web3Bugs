let zeroAddress = exports.zeroAddress = "0x0000000000000000000000000000000000000000";
let kovan = exports.kovan = 'kovan';
let bscTestnet = exports.bscTestnet = 'bscTestnet';
let bscIntegrationTest = exports.bscIntegrationTest = 'bscIntegrationTest';
let mainnet = exports.mainnet = 'mainnet';


exports.isSkip = function (network) {
  return network == ('development') ||
    network == ('soliditycoverage') ||
    network == ('local') ||
    network == ('huobiMainest') ||
    network == ('huobiTest');
}
exports.deployOption = function (accounts) {
  return {from: accounts[0], overwrite: false}
}
exports.getAdmin = function (accounts) {
  return accounts[0];
}
exports.uniswapV2Address = function (network) {
  switch (network){
    case bscIntegrationTest:
    case bscTestnet:
      return '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
    case kovan:
    case mainnet:
      return '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
    default:
      return zeroAddress;
  }
}

exports.uniswapV3Address = function (network) {
  switch (network){
    case kovan:
    case mainnet:
      return '0x1f98431c8ad98523631ae4a59f267346ea31f984';
    default:
      return zeroAddress;
  }
}

exports.getDepositTokens = function (network) {
  switch (network){
    case mainnet:
      return [
        "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",//wbtc
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",//usdc
        "0xdac17f958d2ee523a2206206994597c13d831ec7",//usdt
        "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",//weth
        "0x6b175474e89094c44da98b954eedeac495271d0f",//dai
        "0x956f47f50a910163d8bf957cf5846d573e7f87ca",//fei
        "0xa47c8bf37f92abed4a126bda807a7b7498661acd",//ust
        "0x853d955acef822db058eb8505911ed77f175b99e"//frax
      ];
    case kovan:
      return [
        "0xd0A1E359811322d97991E03f863a0C30C2cF029C",//weth9
        "0xc58854ce3a7d507b1ca97fa7b28a411956c07782",//weth(test)
        "0xf894289f63b0b365485cee34aa50681f295f84b4",//usdt
        "0x9278bf26744d3c98b8f24809fe8ea693b9aa4cf6",//wbtc
        "0x5c95482b5962b6c3d2d47dc4a3fd7173e99853b0",//dai
        "0x7a8bd2583a3d29241da12dd6f3ae88e92a538144"//usdc
      ];
    case bscIntegrationTest:
      return [
        "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",//WBNB
        "0xe9e7cea3dedca5984780bafc599bd69add087d56"//BUSD
      ];
    case bscTestnet:
      return [
        "0x094616f0bdfb0b526bd735bf66eca0ad254ca81f",//WBNB
        "0x8301f2213c0eed49a7e28ae4c3e91722919b8b47"//BUSD
      ]
    default:
      return [];
  }
}

exports.blocksPerYear = function (network) {
  switch (network){
    case kovan:
    case mainnet:
      return 2102400;
    case bscIntegrationTest:
    case bscTestnet:
      return 10512000;
  }
}

exports.tokenName = function (network) {
  switch (network){
    case bscIntegrationTest:
    case bscTestnet:
      return "ELO";
    default:
      return "OpenLeverage";
  }
}

exports.tokenSymbol = function (network) {
  switch (network){
    case bscIntegrationTest:
    case bscTestnet:
      return "ELO"
    default:
      return "OLE";
  }
}

exports.getWChainToken = function (network) {
  switch (network){
    case mainnet:
      //WETH9
      return "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2"
    case kovan:
      //WETH9
      return "0xd0A1E359811322d97991E03f863a0C30C2cF029C";
    case bscIntegrationTest:
      return "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
    case bscTestnet:
      return "0x094616f0bdfb0b526bd735bf66eca0ad254ca81f";
    default:
      return zeroAddress;
  }
}

exports.getLpoolStartTime = function () {
  //now+120s
  return parseInt((new Date().getTime() + 120 * 1000).toString().substr(0, 10));
}
exports.getFarmingStartTime = function () {
  //now+1h
  return parseInt((new Date().getTime() + 60 * 60 * 1000).toString().substr(0, 10));
}
exports.getFarmingDuration = function () {
  //8 weeks
  return 8 * 7 * 24 * 60 * 60;
}

exports.getUniV2DexData = function (network){
  switch (network){
    case kovan:
    case mainnet:
      return "0x01";
    case bscIntegrationTest:
    case bscTestnet:
      return "0x03";
    default:
      return zeroAddress;
  }
}

// const UniswapV2Router = artifacts.require("IUniswapV2Router");
// const uniRouterV2Address_kovan = exports.uniRouterV2Address_kovan = "0x7a250d5630b4cf539739df2c5dacb4c659f2488d";

// exports.createUniPair_kovan = async (token0, token1, account, amount) => {
//   console.log("starting create pair ", await token0.name(), '-', await token1.name())
//   let router = await UniswapV2Router.at(uniRouterV2Address_kovan);
//   await token0.approve(uniRouterV2Address_kovan, amount);
//   await token1.approve(uniRouterV2Address_kovan, amount);
//   let transaction = await router.addLiquidity(token0.address, token1.address, amount, amount,
//     amount, amount, account, amount);
//   console.log("finished create pair ", await token0.name(), '-', await token1.name(), ",tx=", transaction.tx);
//   return router;
// }
