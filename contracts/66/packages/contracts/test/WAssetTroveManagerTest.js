const { artifacts, ethers, assert } = require("hardhat")
const deploymentHelper = require("../utils/deploymentHelpers.js")
const testHelpers = require("../utils/testHelpers.js")
const YUSDTokenTester = artifacts.require("./YUSDTokenTester.sol")
const TroveManagerTester = artifacts.require("./TroveManagerTester.sol")
const YetiTokenTester = artifacts.require("./YETITokenTester.sol")
const YetiFinanceTreasury = artifacts.require("./YetiFinanceTreasury.sol")
const {getWAVAX, getJOEContracts, wrapAVAX, zapForWAVAX_WETH_JLP, approveJLP} = require("../utils/joeHelper.js")

let joeRouter
let joeZap
let wavax
let jlp
let stabilityPool

const routerABI = [{ "inputs": [{ "internalType": "address", "name": "_factory", "type": "address" }, { "internalType": "address", "name": "_WAVAX", "type": "address" }], "stateMutability": "nonpayable", "type": "constructor" }, { "inputs": [], "name": "WAVAX", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "tokenA", "type": "address" }, { "internalType": "address", "name": "tokenB", "type": "address" }, { "internalType": "uint256", "name": "amountADesired", "type": "uint256" }, { "internalType": "uint256", "name": "amountBDesired", "type": "uint256" }, { "internalType": "uint256", "name": "amountAMin", "type": "uint256" }, { "internalType": "uint256", "name": "amountBMin", "type": "uint256" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "addLiquidity", "outputs": [{ "internalType": "uint256", "name": "amountA", "type": "uint256" }, { "internalType": "uint256", "name": "amountB", "type": "uint256" }, { "internalType": "uint256", "name": "liquidity", "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "token", "type": "address" }, { "internalType": "uint256", "name": "amountTokenDesired", "type": "uint256" }, { "internalType": "uint256", "name": "amountTokenMin", "type": "uint256" }, { "internalType": "uint256", "name": "amountAVAXMin", "type": "uint256" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "addLiquidityAVAX", "outputs": [{ "internalType": "uint256", "name": "amountToken", "type": "uint256" }, { "internalType": "uint256", "name": "amountAVAX", "type": "uint256" }, { "internalType": "uint256", "name": "liquidity", "type": "uint256" }], "stateMutability": "payable", "type": "function" }, { "inputs": [], "name": "factory", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amountOut", "type": "uint256" }, { "internalType": "uint256", "name": "reserveIn", "type": "uint256" }, { "internalType": "uint256", "name": "reserveOut", "type": "uint256" }], "name": "getAmountIn", "outputs": [{ "internalType": "uint256", "name": "amountIn", "type": "uint256" }], "stateMutability": "pure", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amountIn", "type": "uint256" }, { "internalType": "uint256", "name": "reserveIn", "type": "uint256" }, { "internalType": "uint256", "name": "reserveOut", "type": "uint256" }], "name": "getAmountOut", "outputs": [{ "internalType": "uint256", "name": "amountOut", "type": "uint256" }], "stateMutability": "pure", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amountOut", "type": "uint256" }, { "internalType": "address[]", "name": "path", "type": "address[]" }], "name": "getAmountsIn", "outputs": [{ "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amountIn", "type": "uint256" }, { "internalType": "address[]", "name": "path", "type": "address[]" }], "name": "getAmountsOut", "outputs": [{ "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }], "stateMutability": "view", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amountA", "type": "uint256" }, { "internalType": "uint256", "name": "reserveA", "type": "uint256" }, { "internalType": "uint256", "name": "reserveB", "type": "uint256" }], "name": "quote", "outputs": [{ "internalType": "uint256", "name": "amountB", "type": "uint256" }], "stateMutability": "pure", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "tokenA", "type": "address" }, { "internalType": "address", "name": "tokenB", "type": "address" }, { "internalType": "uint256", "name": "liquidity", "type": "uint256" }, { "internalType": "uint256", "name": "amountAMin", "type": "uint256" }, { "internalType": "uint256", "name": "amountBMin", "type": "uint256" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "removeLiquidity", "outputs": [{ "internalType": "uint256", "name": "amountA", "type": "uint256" }, { "internalType": "uint256", "name": "amountB", "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "token", "type": "address" }, { "internalType": "uint256", "name": "liquidity", "type": "uint256" }, { "internalType": "uint256", "name": "amountTokenMin", "type": "uint256" }, { "internalType": "uint256", "name": "amountAVAXMin", "type": "uint256" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "removeLiquidityAVAX", "outputs": [{ "internalType": "uint256", "name": "amountToken", "type": "uint256" }, { "internalType": "uint256", "name": "amountAVAX", "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "token", "type": "address" }, { "internalType": "uint256", "name": "liquidity", "type": "uint256" }, { "internalType": "uint256", "name": "amountTokenMin", "type": "uint256" }, { "internalType": "uint256", "name": "amountAVAXMin", "type": "uint256" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "removeLiquidityAVAXSupportingFeeOnTransferTokens", "outputs": [{ "internalType": "uint256", "name": "amountAVAX", "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "token", "type": "address" }, { "internalType": "uint256", "name": "liquidity", "type": "uint256" }, { "internalType": "uint256", "name": "amountTokenMin", "type": "uint256" }, { "internalType": "uint256", "name": "amountAVAXMin", "type": "uint256" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }, { "internalType": "bool", "name": "approveMax", "type": "bool" }, { "internalType": "uint8", "name": "v", "type": "uint8" }, { "internalType": "bytes32", "name": "r", "type": "bytes32" }, { "internalType": "bytes32", "name": "s", "type": "bytes32" }], "name": "removeLiquidityAVAXWithPermit", "outputs": [{ "internalType": "uint256", "name": "amountToken", "type": "uint256" }, { "internalType": "uint256", "name": "amountAVAX", "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "token", "type": "address" }, { "internalType": "uint256", "name": "liquidity", "type": "uint256" }, { "internalType": "uint256", "name": "amountTokenMin", "type": "uint256" }, { "internalType": "uint256", "name": "amountAVAXMin", "type": "uint256" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }, { "internalType": "bool", "name": "approveMax", "type": "bool" }, { "internalType": "uint8", "name": "v", "type": "uint8" }, { "internalType": "bytes32", "name": "r", "type": "bytes32" }, { "internalType": "bytes32", "name": "s", "type": "bytes32" }], "name": "removeLiquidityAVAXWithPermitSupportingFeeOnTransferTokens", "outputs": [{ "internalType": "uint256", "name": "amountAVAX", "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "address", "name": "tokenA", "type": "address" }, { "internalType": "address", "name": "tokenB", "type": "address" }, { "internalType": "uint256", "name": "liquidity", "type": "uint256" }, { "internalType": "uint256", "name": "amountAMin", "type": "uint256" }, { "internalType": "uint256", "name": "amountBMin", "type": "uint256" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }, { "internalType": "bool", "name": "approveMax", "type": "bool" }, { "internalType": "uint8", "name": "v", "type": "uint8" }, { "internalType": "bytes32", "name": "r", "type": "bytes32" }, { "internalType": "bytes32", "name": "s", "type": "bytes32" }], "name": "removeLiquidityWithPermit", "outputs": [{ "internalType": "uint256", "name": "amountA", "type": "uint256" }, { "internalType": "uint256", "name": "amountB", "type": "uint256" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amountOut", "type": "uint256" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "swapAVAXForExactTokens", "outputs": [{ "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }], "stateMutability": "payable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amountOutMin", "type": "uint256" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "swapExactAVAXForTokens", "outputs": [{ "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }], "stateMutability": "payable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amountOutMin", "type": "uint256" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "swapExactAVAXForTokensSupportingFeeOnTransferTokens", "outputs": [], "stateMutability": "payable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amountIn", "type": "uint256" }, { "internalType": "uint256", "name": "amountOutMin", "type": "uint256" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "swapExactTokensForAVAX", "outputs": [{ "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amountIn", "type": "uint256" }, { "internalType": "uint256", "name": "amountOutMin", "type": "uint256" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "swapExactTokensForAVAXSupportingFeeOnTransferTokens", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amountIn", "type": "uint256" }, { "internalType": "uint256", "name": "amountOutMin", "type": "uint256" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "swapExactTokensForTokens", "outputs": [{ "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amountIn", "type": "uint256" }, { "internalType": "uint256", "name": "amountOutMin", "type": "uint256" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "swapExactTokensForTokensSupportingFeeOnTransferTokens", "outputs": [], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amountOut", "type": "uint256" }, { "internalType": "uint256", "name": "amountInMax", "type": "uint256" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "swapTokensForExactAVAX", "outputs": [{ "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }], "stateMutability": "nonpayable", "type": "function" }, { "inputs": [{ "internalType": "uint256", "name": "amountOut", "type": "uint256" }, { "internalType": "uint256", "name": "amountInMax", "type": "uint256" }, { "internalType": "address[]", "name": "path", "type": "address[]" }, { "internalType": "address", "name": "to", "type": "address" }, { "internalType": "uint256", "name": "deadline", "type": "uint256" }], "name": "swapTokensForExactTokens", "outputs": [{ "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }], "stateMutability": "nonpayable", "type": "function" }, { "stateMutability": "payable", "type": "receive" }];
const zapABI = [{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"inputs":[],"name":"DAI","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"JOE","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"USDT","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"WAVAX","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_joe","type":"address"},{"internalType":"address","name":"_router","type":"address"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_address","type":"address"}],"name":"isLP","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"uint256","name":"i","type":"uint256"}],"name":"removeToken","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_address","type":"address"}],"name":"routePair","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"setNotLP","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"asset","type":"address"},{"internalType":"address","name":"route","type":"address"}],"name":"setRoutePairAddress","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"sweep","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"tokens","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"token","type":"address"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_to","type":"address"}],"name":"zapIn","outputs":[],"stateMutability":"payable","type":"function"},{"inputs":[{"internalType":"address","name":"_from","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"address","name":"_to","type":"address"}],"name":"zapInToken","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"_from","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"zapOut","outputs":[],"stateMutability":"nonpayable","type":"function"},{"stateMutability":"payable","type":"receive"}]
const wavaxABI = [{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"src","type":"address"},{"indexed":true,"internalType":"address","name":"guy","type":"address"},{"indexed":false,"internalType":"uint256","name":"wad","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"dst","type":"address"},{"indexed":false,"internalType":"uint256","name":"wad","type":"uint256"}],"name":"Deposit","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"src","type":"address"},{"indexed":true,"internalType":"address","name":"dst","type":"address"},{"indexed":false,"internalType":"uint256","name":"wad","type":"uint256"}],"name":"Transfer","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"src","type":"address"},{"indexed":false,"internalType":"uint256","name":"wad","type":"uint256"}],"name":"Withdrawal","type":"event"},{"payable":true,"stateMutability":"payable","type":"fallback"},{"constant":true,"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"guy","type":"address"},{"internalType":"uint256","name":"wad","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[],"name":"deposit","outputs":[],"payable":true,"stateMutability":"payable","type":"function"},{"constant":true,"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"dst","type":"address"},{"internalType":"uint256","name":"wad","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"address","name":"src","type":"address"},{"internalType":"address","name":"dst","type":"address"},{"internalType":"uint256","name":"wad","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"internalType":"uint256","name":"wad","type":"uint256"}],"name":"withdraw","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}]
const jlpABI = [{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"owner","type":"address"},{"indexed":true,"internalType":"address","name":"spender","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Approval","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1","type":"uint256"},{"indexed":true,"internalType":"address","name":"to","type":"address"}],"name":"Burn","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount0","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1","type":"uint256"}],"name":"Mint","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"sender","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount0In","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1In","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount0Out","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"amount1Out","type":"uint256"},{"indexed":true,"internalType":"address","name":"to","type":"address"}],"name":"Swap","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint112","name":"reserve0","type":"uint112"},{"indexed":false,"internalType":"uint112","name":"reserve1","type":"uint112"}],"name":"Sync","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"from","type":"address"},{"indexed":true,"internalType":"address","name":"to","type":"address"},{"indexed":false,"internalType":"uint256","name":"value","type":"uint256"}],"name":"Transfer","type":"event"},{"inputs":[],"name":"DOMAIN_SEPARATOR","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"MINIMUM_LIQUIDITY","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"PERMIT_TYPEHASH","outputs":[{"internalType":"bytes32","name":"","type":"bytes32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"address","name":"","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"}],"name":"burn","outputs":[{"internalType":"uint256","name":"amount0","type":"uint256"},{"internalType":"uint256","name":"amount1","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"factory","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getReserves","outputs":[{"internalType":"uint112","name":"_reserve0","type":"uint112"},{"internalType":"uint112","name":"_reserve1","type":"uint112"},{"internalType":"uint32","name":"_blockTimestampLast","type":"uint32"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_token0","type":"address"},{"internalType":"address","name":"_token1","type":"address"}],"name":"initialize","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"kLast","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"}],"name":"mint","outputs":[{"internalType":"uint256","name":"liquidity","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"nonces","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"},{"internalType":"uint256","name":"deadline","type":"uint256"},{"internalType":"uint8","name":"v","type":"uint8"},{"internalType":"bytes32","name":"r","type":"bytes32"},{"internalType":"bytes32","name":"s","type":"bytes32"}],"name":"permit","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"price0CumulativeLast","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"price1CumulativeLast","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"}],"name":"skim","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"amount0Out","type":"uint256"},{"internalType":"uint256","name":"amount1Out","type":"uint256"},{"internalType":"address","name":"to","type":"address"},{"internalType":"bytes","name":"data","type":"bytes"}],"name":"swap","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"sync","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"token0","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"token1","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"from","type":"address"},{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}],"name":"transferFrom","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"}]

const th = testHelpers.TestHelper
const dec = th.dec
const toBN = th.toBN
const getDifference = th.getDifference
const assertRevert = th.assertRevert
const mv = testHelpers.MoneyValues
const zeroAddress = "0x0000000000000000000000000000000000000000"
const timeValues = testHelpers.TimeValues


const YUSDToken = artifacts.require("YUSDToken")
const YetiToken = artifacts.require("YETIToken")
const sYETIToken = artifacts.require("./sYETIToken.sol")
const sYETITokenTester = artifacts.require("./sYETITokenTester.sol")

console.log("")
console.log("All tests will fail if mainnet not forked in hardhat.config.js")
console.log("Also may need to change hardhat.config.js file in the hardhat section under networks to enable forking ")
console.log("")

contract('WAssetTroveManagerTests', async accounts => {

  const [
    owner,
    alice, bob, carol, dennis, erin, freddy, greta, harry, ida,
    A, B, C, D, E,
    whale, defaulter_1, defaulter_2, defaulter_3, defaulter_4] = accounts;

  const [bountyAddress, lpRewardsAddress, multisig] = [defaulter_1, defaulter_2, defaulter_3]

  const openTrove = async (params) => th.openTrove(contracts, params)

  let yusdToken
  let yetiToken
  let sYetiToken
  let troveManager
  let borrowerOperations
  let WJLP
  let weth
  let treasury

  let contracts

  beforeEach(async () => {
    contracts = await deploymentHelper.deployLiquityCore()
    contracts.troveManager = await TroveManagerTester.new()
    contracts.yusdToken = await YUSDTokenTester.new(
      contracts.troveManager.address,
      contracts.troveManagerLiquidations.address,
      contracts.troveManagerRedemptions.address,
      contracts.stabilityPool.address,
      contracts.borrowerOperations.address
    )
    const YETIContracts = await deploymentHelper.deployYETITesterContractsHardhat(bountyAddress, lpRewardsAddress, multisig)
    await deploymentHelper.connectYETIContracts(YETIContracts)
    await deploymentHelper.connectCoreContracts(contracts, YETIContracts)
    await deploymentHelper.connectYETIContractsToCore(YETIContracts, contracts)

    await ethers.provider.send("hardhat_setBalance", [
      harry,
      "0x100000000000000000000",
    ]);

    WJLP = contracts.wJLP;

    joeRouter = new ethers.Contract("0x60aE616a2155Ee3d9A68541Ba4544862310933d4", abi = routerABI, signer = await hre.ethers.getSigner(harry));
    joeZap = new ethers.Contract("0x2C7B8e971c704371772eDaf16e0dB381A8D02027", abi = zapABI, signer = await hre.ethers.getSigner(harry));
    wavax = new ethers.Contract("0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7", abi = wavaxABI, signer = await hre.ethers.getSigner(harry))
    jlp = new ethers.Contract("0xFE15c2695F1F920da45C30AAE47d11dE51007AF9", abi = jlpABI, signer = await hre.ethers.getSigner(harry))

    troveManager = contracts.troveManager;
    borrowerOperations = contracts.borrowerOperations
    weth = contracts.weth
    yusdToken = contracts.yusdToken;
    stabilityPool = contracts.stabilityPool;
    treasury = YETIContracts.yetiFinanceTreasury;
    await contracts.priceFeedJLP.setPrice(toBN(dec(200, 18)).toString())
  })

  afterEach(async () => {
    const aliceJLPBalance = await jlp.balanceOf(alice)
    const harryJLPBalance = await jlp.balanceOf(harry)
    const aliceWJLPBalance = await WJLP.balanceOf(alice)
    const harryWJLPBalance = await WJLP.balanceOf(harry)
    await jlp.connect(await hre.ethers.getSigner(alice)).transfer(zeroAddress, aliceJLPBalance)
    await jlp.connect(await hre.ethers.getSigner(harry)).transfer(zeroAddress, harryJLPBalance)
    await WJLP.transfer(zeroAddress, aliceWJLPBalance, { from: alice })
    await WJLP.transfer(zeroAddress, harryWJLPBalance, { from: harry })
  })

    it('wrap WAVAX', async() => {
      const wavax = await getWAVAX(harry);
      const initialWAVAXBalance = await wavax.balanceOf(harry);
      const amount = "1000000"
      await wrapAVAX(harry, amount)

      const finalWAVAXBalance = await wavax.balanceOf(harry);

      assert.equal(initialWAVAXBalance.toString(), "0");
      assert.equal(finalWAVAXBalance.toString(), amount);
    })

    it('zap AVAX into WETH/WAVAX JLP tokens', async() => {
      const amount = await zapForWAVAX_WETH_JLP(harry, "1000");
      const balance = await jlp.balanceOf(harry);
      assert.equal(amount.toString(), balance.toString())
    })

    it("get WJLP Tokens", async() => {
        const amount = await zapForWAVAX_WETH_JLP(harry, "100000")
        await approveJLP(harry, amount, WJLP.address)

        const initialWJLPBalance = await WJLP.balanceOf(harry);
        await WJLP.wrap(amount, harry, harry, harry, {from: harry});
        const finalWJLPBalance = await WJLP.balanceOf(harry);

        assert.equal(initialWJLPBalance.toString(), "0");
        assert.equal(finalWJLPBalance.toString(), amount);
    })

    it("Wrapping for someone else reverts when not called by borrower operations", async() => {
      const amount = await zapForWAVAX_WETH_JLP(harry, "100000")
      await approveJLP(harry, amount, WJLP.address)

      await assertRevert(WJLP.wrap(amount, harry, alice, alice, {from: alice}), 
      "Should have reverted since alice called wrap for harry")
    })

    // TODO test out that WAsset rewards increase after fast forwarding time
    it("open trove and liquidate-standard liquidation one Trove liquidated and one SP depositor", async () => {
      const minDebt = await contracts.borrowerOperations.MIN_NET_DEBT()
      const amount = await zapForWAVAX_WETH_JLP(harry, minDebt)

      await approveJLP(harry, amount, WJLP.address)

      // await WJLP.wrap(amount, harry, harry);

      // th.test opens a trove with WJLP as collateral for harry
      await th.test(contracts, harry, WJLP.address, amount)
      // alice opens a large trove with WETH collateral and a large debt position
      await th.openTrove(contracts, { ICR: toBN(dec(2, 18)), extraYUSDAmount: toBN(dec(2, 25)), extraParams: { from: alice } })


      let harryRewards = await WJLP.getUserInfo(harry);
      let treasuryRewardsInit = await WJLP.getUserInfo(treasury.address);
      // Harry is credited to be earning JOE on amount of staked LP tokens
      assert.equal(harryRewards["0"].toString(), amount.toString())
      // treasury is credited to be earning JOE on 0 staked LP tokens
      assert.equal(treasuryRewardsInit["0"].toString(), "0")


      // fastforward time
      await ethers.provider.send('evm_increaseTime', [2592000]);
      await ethers.provider.send('evm_mine');

      // let pendingJOERewardsHarry = await WJLP.getPendingRewards(harry);
      // console.log(pendingJOERewardsHarry);
      // assert.isTrue((pendingJOERewardsHarry)[1][0].gt(toBN("0")));

      // await WJLP.approve(borrowerOperations.address, amount, {from: harry})

      // const val = await contracts.whitelist.getValueVC(WJLP.address, amount)
      // console.log("Amount:", amount.toString());
      // console.log("VC:", val.toString());


      const YUSDBalance = await yusdToken.balanceOf(alice);
      await stabilityPool.provideToSP(YUSDBalance, zeroAddress, {from: alice});

      await contracts.priceFeedJLP.setPrice(toBN(dec(155, 17)).toString())

      const troveVC = await troveManager.getTroveVC(harry);
      const troveDebt = await troveManager.getTroveDebt(harry);

      console.log("VC and Debt: ", troveVC.toString())
      console.log(troveDebt.toString())

      // bob started with 0 JLP and WJLP
      const initJLP_bob = await jlp.balanceOf(bob);
      const initWJLP_bob = await WJLP.balanceOf(bob);
      assert.equal(initJLP_bob.toString(), "0")
      assert.equal(initWJLP_bob.toString(), "0")

      await troveManager.liquidate(harry, {from: bob});

      const finalWJLP_bob = await WJLP.balanceOf(bob);
      const finalJLP_bob = await jlp.balanceOf(bob)

      // Then Bob gets 0 WJLP and amount / 200 JLP after liquidation
      assert.equal(finalWJLP_bob.toString(), "0")
      const expectedFinalJLP_bob = amount.div(toBN(200));
      assert.equal(finalJLP_bob.toString(), expectedFinalJLP_bob.toString())

      harryRewards = await WJLP.getUserInfo(harry);
      // After liquidation, Harry is no longer credited to be earning JOE on LP tokens
      assert.equal(harryRewards["0"].toString(), "0")

      // the WJLP that was not taken as liquidation should be in the SP
      const expectedWJLP_inSP = amount.sub(expectedFinalJLP_bob);
      const WJLP_inSP = await WJLP.balanceOf(stabilityPool.address);
      assert.equal(WJLP_inSP.toString(), expectedWJLP_inSP.toString());

      // after liquidation, JOE rewards for WJLP in SP go to treasury
      let treasuryRewardsMid = await WJLP.getUserInfo(treasury.address);
      assert.equal(treasuryRewardsMid["0"].toString(), expectedWJLP_inSP.toString())

      // when Alice withdraws her liquidationRewards from SP, they should automatically be unwrapped for her
      // alice started with 0 JLP and WJLP
      const initJLP_alice = await jlp.balanceOf(alice);
      const initWJLP_alice = await WJLP.balanceOf(alice);
      assert.equal(initJLP_alice.toString(), "0")
      assert.equal(initWJLP_alice.toString(), "0")

      await stabilityPool.withdrawFromSP(YUSDBalance, {from: alice});
      const finalWJLP_alice = await WJLP.balanceOf(alice);
      const finalJLP_alice = await jlp.balanceOf(alice)

      // after withdrawing, Alice gets 0 WJLP and gets back approximately
      // (amount - liquidator's reward) of JLP (where amount is the amount of JLP in the trove)
      assert.equal(finalWJLP_alice.toString(), "0")
      const expectedFinalJLP_alice = expectedWJLP_inSP
      th.assertIsApproximatelyEqual(finalJLP_alice, expectedFinalJLP_alice)

      // after WJLP withdrawn from SP, Treasury is receiving rewards from 0 staked JLP
      let treasuryRewardsFinal = await WJLP.getUserInfo(treasury.address);
      th.assertIsApproximatelyEqual(treasuryRewardsFinal["0"], toBN(0))
    })

    // TODO: write this test
    xit("open trove and liquidate-redistribution", async () => {
      const minDebt = await contracts.borrowerOperations.MIN_NET_DEBT()
      const amount = await zapForWAVAX_WETH_JLP(harry, minDebt)

      await approveJLP(harry, amount, WJLP.address)

      // await WJLP.wrap(amount, harry, harry, harry);

      // let harryRewards = await WJLP.getUserInfo(harry);
      // let treasuryRewardsInit = await WJLP.getUserInfo(treasury.address);
      // // Harry is credited to be earning JOE on amount of staked LP tokens
      // assert.equal(harryRewards["0"].toString(), amount.toString())
      // // treasury is credited to be earning JOE on 0 staked LP tokens
      // assert.equal(treasuryRewardsInit["0"].toString(), "0")


      // await WJLP.approve(borrowerOperations.address, amount, {from: harry})

      // const val = await contracts.whitelist.getValueVC(WJLP.address, amount)
      // console.log("Amount:", amount.toString());
      // console.log("VC:", val.toString());

      // th.test opens a trove with WJLP as collateral for harry
      await th.test(contracts, harry, WJLP.address, amount)
      // alice opens a large trove with WETH collateral and a large debt position
      await th.openTrove(contracts, { ICR: toBN(dec(16, 17)), extraYUSDAmount: toBN(dec(2, 25)), extraParams: { from: alice } })
      const YUSDBalance = await yusdToken.balanceOf(alice);
      await stabilityPool.provideToSP(YUSDBalance, zeroAddress, {from: alice});

      await contracts.priceFeedJLP.setPrice(toBN(dec(155, 17)).toString())

      const troveVC = await troveManager.getTroveVC(harry);
      const troveDebt = await troveManager.getTroveDebt(harry);

      console.log("harry VC and Debt: ", troveVC.toString())
      console.log(troveDebt.toString())

      // bob started with 0 JLP and WJLP
      const initJLP_bob = await jlp.balanceOf(bob);
      const initWJLP_bob = await WJLP.balanceOf(bob);
      assert.equal(initJLP_bob.toString(), "0")
      assert.equal(initWJLP_bob.toString(), "0")

      await troveManager.liquidate(harry, {from: bob});

      const finalWJLP_bob = await WJLP.balanceOf(bob);
      const finalJLP_bob = await jlp.balanceOf(bob)

      // Then Bob gets 0 WJLP and amount / 200 JLP after liquidation
      assert.equal(finalWJLP_bob.toString(), "0")
      const expectedFinalJLP_bob = amount.div(toBN(200));
      assert.equal(finalJLP_bob.toString(), expectedFinalJLP_bob.toString())

      harryRewards = await WJLP.getUserInfo(harry);
      // After liquidation, Harry is no longer credited to be earning JOE on LP tokens
      assert.equal(harryRewards["0"].toString(), "0")

      // the WJLP that was not taken as liquidation should be in the SP
      const expectedWJLP_inSP = amount.sub(expectedFinalJLP_bob);
      const WJLP_inSP = await WJLP.balanceOf(stabilityPool.address);
      assert.equal(WJLP_inSP.toString(), expectedWJLP_inSP.toString());

      // after liquidation, JOE rewards for WJLP in SP go to treasury
      let treasuryRewardsMid = await WJLP.getUserInfo(treasury.address);
      assert.equal(treasuryRewardsMid["0"].toString(), expectedWJLP_inSP.toString())

      // when Alice withdraws her liquidationRewards from SP, they should automatically be unwrapped for her
      // alice started with 0 JLP and WJLP
      const initJLP_alice = await jlp.balanceOf(alice);
      const initWJLP_alice = await WJLP.balanceOf(alice);
      assert.equal(initJLP_alice.toString(), "0")
      assert.equal(initWJLP_alice.toString(), "0")

      await stabilityPool.withdrawFromSP(YUSDBalance, {from: alice});
      const finalWJLP_alice = await WJLP.balanceOf(alice);
      const finalJLP_alice = await jlp.balanceOf(alice)

      // after withdrawing, Alice gets 0 WJLP and gets back approximately
      // (amount - liquidator's reward) of JLP (where amount is the amount of JLP in the trove)
      assert.equal(finalWJLP_alice.toString(), "0")
      const expectedFinalJLP_alice = expectedWJLP_inSP
      th.assertIsApproximatelyEqual(finalJLP_alice, expectedFinalJLP_alice)

      // after WJLP withdrawn from SP, Treasury is receiving rewards from 0 staked JLP
      let treasuryRewardsFinal = await WJLP.getUserInfo(treasury.address);
      th.assertIsApproximatelyEqual(treasuryRewardsFinal["0"], toBN(0))
    })

    it("Partial Redemption using wasset, check balances. Partial redemption", async () => {
      // skip bootstrapping phase
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

      const minDebt = await contracts.borrowerOperations.MIN_NET_DEBT()
      const amount = await zapForWAVAX_WETH_JLP(harry, minDebt)
      await approveJLP(harry, amount, WJLP.address)

      // await WJLP.wrap(amount, harry, harry, harry);

      // let harryRewards = await WJLP.getUserInfo(harry);
      // let treasuryRewardsInit = await WJLP.getUserInfo(treasury.address);
      // // Harry is credited to be earning JOE on amount of staked LP tokens
      // assert.equal(harryRewards["0"].toString(), amount.toString())
      // // treasury is credited to be earning JOE on 0 staked LP tokens
      // assert.equal(treasuryRewardsInit["0"].toString(), "0")

      // await WJLP.approve(borrowerOperations.address, amount, {from: harry})

      // const val = await contracts.whitelist.getValueVC(WJLP.address, amount)
      // console.log("Amount:", amount.toString());
      // console.log("VC:", val.toString());

      // th.test opens a trove with WJLP as collateral for harry. Open with more debt.
      await th.test(contracts, harry, WJLP.address, amount)
      await borrowerOperations.adjustTrove([], [], [], [], dec(2000, 18), true, harry, harry, th._100pct, { from: harry })
      // alice opens a large trove with WETH collateral and a large debt position
      await th.openTrove(contracts, { ICR: toBN(dec(200, 18)), extraYUSDAmount: toBN(dec(2, 25)), extraParams: { from: alice } })

      const YUSDRedemption = toBN(dec(2000, 18))
      const tx1 = await th.performRedemptionWithMaxFeeAmount(alice, contracts, YUSDRedemption, YUSDRedemption)
      assert.isTrue(tx1.receipt.status)

      const AliceJLPAfter = await jlp.balanceOf(alice)

      const ActivePoolWJLPAfter = await WJLP.balanceOf(contracts.activePool.address);

      let harryRewardsFinal = await WJLP.getUserInfo(harry);

      // remaining should be in active pool still
      assert.isTrue(ActivePoolWJLPAfter.toString() == (harryRewardsFinal[0]).toString())
      // Alice should have the correct JLP, unwrapped
      assert.isTrue(AliceJLPAfter.toString() == dec(10, 18))//.eq(toBN(dec(10, 18)))) // 200 * 10 = 2000. Should have that much JLP.
      //Harry should have less rewards
      assert.isTrue(harryRewardsFinal[0].eq(amount.sub(toBN(dec(10, 18)))))
    })

    it("Full Redemption using wasset, check balances", async () => {
      // skip bootstrapping phase
      await th.fastForwardTime(timeValues.SECONDS_IN_ONE_WEEK * 2, web3.currentProvider)

      const minDebt = await contracts.borrowerOperations.MIN_NET_DEBT()
      const amount = await zapForWAVAX_WETH_JLP(harry, minDebt)
      await approveJLP(harry, amount, WJLP.address)

      // await WJLP.wrap(amount, harry, harry, harry);

      // let harryRewards = await WJLP.getUserInfo(harry);
      // let treasuryRewardsInit = await WJLP.getUserInfo(treasury.address);
      // // Harry is credited to be earning JOE on amount of staked LP tokens
      // assert.equal(harryRewards["0"].toString(), amount.toString())
      // // treasury is credited to be earning JOE on 0 staked LP tokens
      // assert.equal(treasuryRewardsInit["0"].toString(), "0")

      // await WJLP.approve(borrowerOperations.address, amount, {from: harry})

      // const val = await contracts.whitelist.getValueVC(WJLP.address, amount)
      // console.log("Amount:", amount.toString());
      // console.log("VC:", val.toString());

      // th.test opens a trove with WJLP as collateral for harry. Open with more debt.
      await th.test(contracts, harry, WJLP.address, amount)
      // await borrowerOperations.adjustTrove([], [], [], [], dec(2000, 18), true, harry, harry, th._100pct, { from: harry })
      // alice opens a large trove with WETH collateral and a large debt position
      await th.openTrove(contracts, { ICR: toBN(dec(200, 18)), extraYUSDAmount: toBN(dec(2, 25)), extraParams: { from: alice } })


      const harryDebtBefore = await troveManager.getTroveDebt(harry)
      console.log("Harry trove debt: ", harryDebtBefore.toString())

      const YUSDRedemption = toBN(dec(4000, 18))
      const tx1 = await th.performRedemptionWithMaxFeeAmount(alice, contracts, YUSDRedemption, YUSDRedemption)
      assert.isTrue(tx1.receipt.status)

      const harryDebtAfter = await troveManager.getTroveDebt(harry)
      console.log("Harry trove debt: ", harryDebtAfter.toString())

      const AliceJLPAfter = await jlp.balanceOf(alice)

      const ActivePoolWJLPAfter = await WJLP.balanceOf(contracts.activePool.address);

      const collSurplusPoolWJLPAfter = await WJLP.balanceOf(contracts.collSurplusPool.address);

      let harryRewardsFinal = await WJLP.getUserInfo(harry);

      const expectedJLPPulled = (toBN(dec(2010, 18)).div(toBN(dec(200, 0))))

      // remaining should be in coll surplus pool
      assert.isTrue(collSurplusPoolWJLPAfter.toString() == (harryRewardsFinal[0]).toString())
      // all should be pulled out
      assert.isTrue(ActivePoolWJLPAfter.toString() == "0")
      // Alice should have the correct JLP, unwrapped
      console.log("Alice jlp after", AliceJLPAfter.toString())
      assert.isTrue(AliceJLPAfter.toString() == expectedJLPPulled.toString())//.eq(toBN(dec(10, 18)))) // 200 * 10 = 2000. Should have that much JLP.
      //Harry should have less rewards
      assert.isTrue(harryRewardsFinal[0].eq(amount.sub(expectedJLPPulled)))
    })

    // it("Should revert when the balance is not the same as reward balance", async() => {
    //   const minDebt = await contracts.borrowerOperations.MIN_NET_DEBT()
    //   const amount = await zapForWAVAX_WETH_JLP(harry, minDebt)
    //   await approveJLP(harry, amount, WJLP.address)

    //   await assertRevert( th.test(contracts, harry, WJLP.address, amount), "Should revert since not enough reward balance")
    // })

    it.only("Tests multiple borrowers interacting with WJLP and adjusting trove with wjlp", async () => {
      const minDebt = await contracts.borrowerOperations.MIN_NET_DEBT()
      const amount = await zapForWAVAX_WETH_JLP(harry, minDebt)
      const harryJLPBalance = await jlp.balanceOf(harry)
      await jlp.connect(await hre.ethers.getSigner(harry)).transfer(alice, harryJLPBalance)
      const amount2 = await zapForWAVAX_WETH_JLP(harry, minDebt)
      
      
      // await zapForWAVAX_WETH_JLP(alice, minDebt)
      await approveJLP(harry, amount2, WJLP.address)
      
      await th.test(contracts, harry, WJLP.address, amount2)
      await approveJLP(alice, amount, WJLP.address)
      await contracts.weth.mint(alice, toBN(dec(20, 18)))
      await contracts.weth.approve(contracts.borrowerOperations.address, toBN(dec(20, 18)), { from: alice })
      await contracts.borrowerOperations.openTrove(
        th._100pct,
        th.toBN(dec(2000, 18)),
        th.ZERO_ADDRESS,
        th.ZERO_ADDRESS,
        [WJLP.address, weth.address], [amount.toString(), toBN(dec(20, 18))],
        { from: alice }
        )

      // harry try to adjust trove 
      const amount3 = await zapForWAVAX_WETH_JLP(harry, minDebt)
      await approveJLP(harry, amount3, WJLP.address)
      await contracts.borrowerOperations.adjustTrove(
        [WJLP.address], [amount3.toString()], [], [], "0", false, harry, harry, th._100pct, { from: harry }
      )
      const harryBalanceBefore = await jlp.balanceOf(harry)
      // Try to withdraw some manually, then check raw balance. 
      await contracts.borrowerOperations.withdrawColl([WJLP.address], [dec(1, 18)], harry, harry, {from: harry})
      const harryBalanceAfter = await jlp.balanceOf(harry)
      assert.isTrue(harryBalanceAfter.toString() == dec(1, 18))

      let harryRewards = await WJLP.getUserInfo(harry);
      let aliceRewards = await WJLP.getUserInfo(alice);
      assert.isTrue(harryRewards[0].toString() == amount3.add(amount2).sub(toBN(dec(1, 18))).toString())
      assert.isTrue(aliceRewards[0].toString() == amount.toString())

      await contracts.yusdToken.transfer(harry, toBN(dec(1000, 18)), { from: alice })
      await contracts.borrowerOperations.closeTrove( {from: harry} )
      const harryBalanceFinal = await jlp.balanceOf(harry)
      assert.isTrue(harryBalanceFinal.toString() == (amount3.add(amount2)).toString())
    })

    // it("redemption", async () => {
    //   const minDebt = await contracts.borrowerOperations.MIN_NET_DEBT()
    //   const amount = await zapForWAVAX_WETH_JLP(harry, minDebt)
    //   await approveJLP(harry, amount, WJLP.address)
    //
    //   await WJLP.wrap(amount, harry, harry, harry);
    //   await WJLP.approve(borrowerOperations.address, amount, {from: harry})
    //   //
    //   const val = await contracts.whitelist.getValueVC(WJLP.address, amount)
    //   console.log("Amount:", amount.toString());
    //   console.log("VC:", val.toString());
    //
    //   // th.test opens a trove with WJLP as collateral for harry
    //   await th.test(contracts, harry, WJLP.address, amount)
    //   // alice opens a large trove with WETH collateral and a large debt position at 200% ICR
    //   await th.openTrove(contracts, { ICR: toBN(dec(2, 18)), extraYUSDAmount: toBN(dec(2, 25)), extraParams: { from: alice } })
    //
    //   await contracts.priceFeedJLP.setPrice(toBN(dec(170, 17)).toString())
    //
    //   const harryDebt = await troveManager.getTroveDebt(harry);
    //
    //   // alice started with 0 JLP and WJLP
    //   const initJLP_alice = await jlp.balanceOf(alice);
    //   const initWJLP_alice = await WJLP.balanceOf(alice);
    //   assert.equal(initJLP_alice.toString(), "0")
    //   assert.equal(initWJLP_alice.toString(), "0")
    //
    //   await troveManager.redeemCollateral(
    //     harryDebt.add(toBN(10)),
    //     th._100pct,
    //     zeroAddress,
    //     zeroAddress,
    //     zeroAddress,
    //     toBN(1, 18).toString(),
    //     "1000",
    //     {from: alice}
    //   )
    //
    //   const harryTroveStatus = troveManager.getTroveStatus(harry);
    //   console.log(harryTroveStatus.toString());
    //
    // })
    //
    //
    //
    // it("redeem", async () => {
    //
    //     await ethers.provider.send("hardhat_setBalance", [
    //       alice,
    //       "0x100000000000000000000",
    //     ]);
    //
    //     await ethers.provider.send("hardhat_setBalance", [
    //       bob,
    //       "0x100000000000000000000",
    //     ]);
    //
    //     const amount = "0x10000000";
    //
    //     /*
    //         Alice and Bob open troves with JLP.
    //         Fast Forward time.
    //         Check if they have the same reward balance.
    //         Alice redeems Bob's trove.
    //         Fast forward time and check to make sure Alice has same reward + unwrapped JLP and Bob stops receiving reward for most of his JLP (10% left if 110% collateral ratio).
    //     **/
    //     const { collateral: A_coll } = await th.openTroveWithJLP(contracts, {Zapper: joeZap, signer: harry, token: jlp, AVAXIn: amount, ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    //     // const { collateral: B_coll } = await th.openTroveWithJLP(contracts, {Zapper: joeZap, AVAXIn: amount, ICR: toBN(dec(200, 16)), extraParams: { from: bob } })
    //     //
    //     // // fastforward time
    //     // await ethers.provider.send('evm_increaseTime', [2592000]);
    //     // await ethers.provider.send('evm_mine');
    //     //
    //     // const aliceRewardFirstMonth = await contracts.wJLP.getPendingRewards(alice);
    //     // const bobRewardFirstMonth = await contracts.wJLP.getPendingRewards(bob);
    //     //
    //     // assert(aliceRewardFirstMonth.mul(toBN(2)).eq(bobRewardFirstMonth))
    //     //
    //     // th.redeemCollateralAndGetTxObject(alice, contracts, yusdToken.balanceOf(alice))
    //     //
    //     // // fastforward time
    //     // await ethers.provider.send('evm_increaseTime', [2592000]);
    //     // await ethers.provider.send('evm_mine');
    //     //
    //     // const aliceRewardSecondMonth = await contracts.wJLP.getPendingRewards(alice);
    //     // const bobRewardSecondMonth = await contracts.wJLP.getPendingRewards(bob);
    //     //
    //     // assert(aliceRewardFirstMonth).eq(aliceRewardSecondMonth.sub(aliceRewardFirstMonth))
    //     // assert(bobRewardFirstMonth.gt(bobRewardSecondMonth.sub(bobRewardFirstMonth)))
    //     // assert((await token.balanceOf(alice)).gt(toBN(0)))
    // })
    //
    // it("liquidation, SP", async () => {
    //     /*
    //         Alice and Bob open troves with JLP. Alice liquidates Bob.
    //         Fast forward time, the speed Alice receives reward stays the same (double WJLP balance but not distributed yet).
    //         Check treasure’s reward balance. Alice addColl, fast forward time alices receives award speed doubles (minus 0.5% gas comp, which she holds as unwrapped JLP).
    //     **/
    //     // --- SETUP ---
    //     const { collateral: A_coll } = await th. openTroveWithJLP(contracts,  { ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    //     const { collateral: B_coll } = await th.openTroveWithJLP(contracts, { ICR: toBN(dec(210, 16)), extraParams: { from: bob } })
    //
    //     await stabilityPool.provideToSP(yusdToken.balanceOf(alice), ZERO_ADDRESS, { from: alice })
    //
    //     // fastforward time
    //     await ethers.provider.send('evm_increaseTime', [2592000]);
    //     await ethers.provider.send('evm_mine');
    //
    //     const aliceRewardFirstMonth = await contracts.wJLP.getPendingRewards(alice);
    //     const bobRewardFirstMonth = await contracts.wJLP.getPendingRewards(bob);
    //
    //     assert(aliceRewardFirstMonth.gt(bobRewardFirstMonth))
    //
    //     await contracts.priceFeedJLP.setPrice(dec(100, 18))
    //     await troveManager.liquidate(bob)
    //
    //     // fastforward time
    //     await ethers.provider.send('evm_increaseTime', [2592000]);
    //     await ethers.provider.send('evm_mine');
    //
    //     const aliceRewardSecondMonth = await contracts.wJLP.getPendingRewards(alice);
    //     const bobRewardSecondMonth = await contracts.wJLP.getPendingRewards(bob);
    //
    //     assert(bobRewardFirstMonth.eq(bobRewardSecondMonth))
    //     assert(aliceRewardFirstMonth).eq(aliceRewardSecondMonth.sub(aliceRewardFirstMonth))
    //
    //     await weth.mint(alice, dec(1, 'ether'))
    //     await weth.approve(borrowerOperations.address, dec(1, 'ether'), {from: alice});
    //     await borrowerOperations.addColl([weth.address], [dec(1, 'ether')], alice, alice,  th._100pct, {from: alice})
    //
    //     await ethers.provider.send('evm_increaseTime', [2592000]);
    //     await ethers.provider.send('evm_mine');
    //
    //     const aliceRewardThirdMonth = await contracts.JLP.getPendingRewards(alice);
    //     const bobRewardThirdMonth = await contracts.JLP.getPendingRewards(bob);
    //
    //     assert(bobRewardFirstMonth.eq(bobRewardThirdMonth))
    //     const gasComp = toBN(5, 15).mul(B_coll)
    //     assert(aliceRewardFirstMonth.add(bobRewardFirstMonth).sub(gasComp)).eq(aliceRewardThirdMonth.sub(aliceRewardSecondMonth))
    //     assert((await token.balanceOf(alice)).gt(toBN(0)))
    // })
    //
    // it("redistrubutin", async () => {
    //     /*
    //         Alice and Bob open troves with JLP. Add to SP.
    //         Alice liquidates Bob. Fast forward time, the speed Alice receives reward stays the same (double WJLP balance but not claimed yet).
    //         Treasury reward balance should increase at this time.
    //         Alice closes her trove and re-stakes, fast forward time, alices receives award speed doubles.
    //     **/
    //     // --- SETUP ---
    //     const { collateral: A_coll } = await th.openTroveWithJLP(contracts, { ICR: toBN(dec(400, 16)), extraParams: { from: alice } })
    //     const { collateral: B_coll } = await th.openTroveWithJLP(contracts, { ICR: toBN(dec(210, 16)), extraParams: { from: bob } })
    //
    //
    //     // fastforward time
    //     await ethers.provider.send('evm_increaseTime', [2592000]);
    //     await ethers.provider.send('evm_mine');
    //
    //     const aliceRewardFirstMonth = await contracts.wJLP.getPendingRewards(alice);
    //     const bobRewardFirstMonth = await contracts.wJLP.getPendingRewards(bob);
    //
    //     assert(aliceRewardFirstMonth.gt(bobRewardFirstMonth))
    //
    //     await contracts.priceFeedJLP.setPrice(dec(100, 18))
    //     await troveManager.liquidate(bob)
    //
    //     // fastforward time
    //     await ethers.provider.send('evm_increaseTime', [2592000]);
    //     await ethers.provider.send('evm_mine');
    //
    //     const aliceRewardSecondMonth = await contracts.wJLP.getPendingRewards(alice);
    //     const bobRewardSecondMonth = await contracts.wJLP.getPendingRewards(bob);
    //
    //     assert(bobRewardFirstMonth.eq(bobRewardSecondMonth))
    //     assert(aliceRewardFirstMonth).eq(aliceRewardSecondMonth.sub(aliceRewardFirstMonth))
    //
    //     await weth.mint(alice, dec(1, 'ether'))
    //     await weth.approve(borrowerOperations.address, dec(1, 'ether'), {from: alice});
    //     await borrowerOperations.addColl([weth.address], [dec(1, 'ether')], alice, alice,  th._100pct, {from: alice})
    //
    //     await ethers.provider.send('evm_increaseTime', [2592000]);
    //     await ethers.provider.send('evm_mine');
    //
    //     const aliceRewardThirdMonth = await contracts.wJLP.getPendingRewards(alice);
    //     const bobRewardThirdMonth = await contracts.wJLP.getPendingRewards(bob);
    //
    //     assert(bobRewardFirstMonth.eq(bobRewardThirdMonth))
    //     const gasComp = toBN(5, 15).mul(B_coll)
    //     assert(aliceRewardFirstMonth.add(bobRewardFirstMonth).sub(gasComp)).eq(aliceRewardThirdMonth.sub(aliceRewardSecondMonth))
    //     assert((await token.balanceOf(alice)).gt(toBN(0)))
    // })

  
})