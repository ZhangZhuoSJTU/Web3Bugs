import { expect } from "chai";
import seedrandom from "seedrandom";

import * as testHelper from "./helpers";
import { areCloseValues, getIntegerRandomValue } from "../utilities";
import { RouteType } from "./helpers/constants";
import { closeValues, RToken } from "@sushiswap/tines";
import { Contract } from "@ethersproject/contracts";

describe("MultiPool Routing Tests", function () {
  beforeEach(async function () {
    [this.signer, this.tridentRouterAddress, this.bento] = await testHelper.init();
    this.gasPrice = 1 * 200 * 1e-9;
    this.rnd = seedrandom("2");
  });

  async function checkTokenBalancesAreZero(tokens: RToken[], bentoContract: Contract, tridentAddress: string) {
    for (let index = 0; index < tokens.length; index++) {
      const tokenBalance = await bentoContract.balanceOf(tokens[index].address, tridentAddress);
      expect(tokenBalance).equal(0);
    }
  }

  it("Should Test Normal Values with 5 pools & bridge", async function () {
    const topology = await testHelper.getFivePoolBridge(this.rnd);

    const fromToken = topology.tokens[0];
    const toToken = topology.tokens[3];
    const baseToken = topology.tokens[2];

    const route = testHelper.createRoute(fromToken, toToken, baseToken, topology, 1000000, this.gasPrice);

    if (route == undefined) {
      throw "Failed to get route";
    }

    expect(route.legs.length).equal(5);

    const routerParams = testHelper.getTridentRouterParams(route, this.signer.address, this.tridentRouterAddress);

    expect(routerParams.routeType).equal(RouteType.ComplexPath);

    const amountOutPoolBN = await testHelper.executeTridentRoute(routerParams, toToken.address);

    await checkTokenBalancesAreZero(topology.tokens, this.bento, this.tridentRouterAddress);

    expect(closeValues(route.amountOut, parseInt(amountOutPoolBN.toString()), 1e-14)).to.equal(
      true,
      "predicted amount did not equal actual swapped amount"
    );
  });

  it("Should Test Normal Values with 3 Parallel Pools", async function () {
    const topology = await testHelper.getAB3VariantTopoplogy(this.rnd);

    const fromToken = topology.tokens[0];
    const toToken = topology.tokens[1];
    const baseToken = topology.tokens[1];
    const [amountIn] = getIntegerRandomValue(30, this.rnd);

    const route = testHelper.createRoute(fromToken, toToken, baseToken, topology, amountIn, this.gasPrice);

    if (route == undefined) {
      throw "Failed to get route";
    }

    expect(route.legs.length).equal(3);

    const routerParams = testHelper.getTridentRouterParams(route, this.signer.address, this.tridentRouterAddress);

    expect(routerParams.routeType).equal(RouteType.ComplexPath);

    const amountOutPoolBN = await testHelper.executeTridentRoute(routerParams, toToken.address);

    await checkTokenBalancesAreZero(topology.tokens, this.bento, this.tridentRouterAddress);

    expect(closeValues(route.amountOut, parseInt(amountOutPoolBN.toString()), 1e-14)).to.equal(
      true,
      "predicted amount did not equal actual swapped amount"
    );
  });

  it("Should Test Normal Values with 2 Parallel Pools", async function () {
    const topology = await testHelper.getAB2VariantTopoplogy(this.rnd);

    const fromToken = topology.tokens[0];
    const toToken = topology.tokens[1];
    const baseToken = topology.tokens[1];
    const [amountIn] = getIntegerRandomValue(30, this.rnd);

    const route = testHelper.createRoute(fromToken, toToken, baseToken, topology, amountIn, this.gasPrice);

    if (route == undefined) {
      throw "Failed to get route";
    }

    expect(route.legs.length).equal(2);

    const routerParams = testHelper.getTridentRouterParams(route, this.signer.address, this.tridentRouterAddress);

    expect(routerParams.routeType).equal(RouteType.ComplexPath);

    const amountOutPoolBN = await testHelper.executeTridentRoute(routerParams, toToken.address);

    await checkTokenBalancesAreZero(topology.tokens, this.bento, this.tridentRouterAddress);

    expect(closeValues(route.amountOut, parseInt(amountOutPoolBN.toString()), 1e-14)).to.equal(
      true,
      "predicted amount did not equal actual swapped amount"
    );
  });

  it("Should Test Normal Values With 2 Serial Pools", async function () {
    const topology = await testHelper.getABCTopoplogy(this.rnd);

    const fromToken = topology.tokens[0];
    const toToken = topology.tokens[2];
    const baseToken = topology.tokens[1];
    const [amountIn] = getIntegerRandomValue(20, this.rnd);

    const route = testHelper.createRoute(fromToken, toToken, baseToken, topology, amountIn, this.gasPrice);

    if (route == undefined) {
      throw "Failed to get route";
    }

    const routerParams = testHelper.getTridentRouterParams(route, this.signer.address, this.tridentRouterAddress);

    expect(routerParams.routeType).equal(RouteType.SinglePath);

    const amountOutPoolBN = await testHelper.executeTridentRoute(routerParams, toToken.address);

    await checkTokenBalancesAreZero(topology.tokens, this.bento, this.tridentRouterAddress);

    expect(closeValues(route.amountOut, parseInt(amountOutPoolBN.toString()), 1e-14)).to.equal(
      true,
      "predicted amount did not equal actual swapped amount"
    );
  });

  it("Should Test Normal Values With 3 Serial Pools", async function () {
    const topology = await testHelper.getABCDTopoplogy(this.rnd);

    const fromToken = topology.tokens[0];
    const toToken = topology.tokens[2];
    const baseToken = topology.tokens[1];
    const [amountIn] = getIntegerRandomValue(20, this.rnd);

    const route = testHelper.createRoute(fromToken, toToken, baseToken, topology, amountIn, this.gasPrice);

    if (route == undefined) {
      throw "Failed to get route";
    }

    const routerParams = testHelper.getTridentRouterParams(route, this.signer.address, this.tridentRouterAddress);

    expect(routerParams.routeType).equal(RouteType.SinglePath);

    const amountOutPoolBN = await testHelper.executeTridentRoute(routerParams, toToken.address);

    await checkTokenBalancesAreZero(topology.tokens, this.bento, this.tridentRouterAddress);

    expect(closeValues(route.amountOut, parseInt(amountOutPoolBN.toString()), 1e-14)).to.equal(
      true,
      "predicted amount did not equal actual swapped amount"
    );
  });

  it("Should Test Normal Values With 1 Pool", async function () {
    const topology = await testHelper.getSinglePool(this.rnd);

    const fromToken = topology.tokens[0];
    const toToken = topology.tokens[1];
    const baseToken = topology.tokens[1];
    const [amountIn] = getIntegerRandomValue(20, this.rnd);

    const route = testHelper.createRoute(fromToken, toToken, baseToken, topology, amountIn, this.gasPrice);

    if (route == undefined) {
      throw "Failed to get route";
    }

    const routerParams = testHelper.getTridentRouterParams(route, this.signer.address, this.tridentRouterAddress);

    expect(routerParams.routeType).equal(RouteType.SinglePool);

    const amountOutPoolBN = await testHelper.executeTridentRoute(routerParams, toToken.address);

    await checkTokenBalancesAreZero(topology.tokens, this.bento, this.tridentRouterAddress);

    expect(closeValues(route.amountOut, parseInt(amountOutPoolBN.toString()), 1e-14)).to.equal(
      true,
      "predicted amount did not equal actual swapped amount"
    );
  });

  it("Should Test Normal Values With 2 Serial Pools will revert due to slippage", async function () {
    const topology = await testHelper.getABCTopoplogy(this.rnd);

    const fromToken = topology.tokens[0];
    const toToken = topology.tokens[2];
    const baseToken = topology.tokens[1];
    const [amountIn] = getIntegerRandomValue(20, this.rnd);

    const route = testHelper.createRoute(fromToken, toToken, baseToken, topology, amountIn, this.gasPrice);

    if (route == undefined) {
      throw "Failed to get route";
    }

    route.amountOut = route.amountOut * (1 + 1 / 100);
    route.totalAmountOut = route.totalAmountOut * (1 + 1 / 100);

    const routerParams = testHelper.getTridentRouterParams(route, this.signer.address, this.tridentRouterAddress);

    expect(routerParams.routeType).equal(RouteType.SinglePath);

    await expect(testHelper.executeTridentRoute(routerParams, toToken.address)).to.be.revertedWith("TOO_LITTLE_RECEIVED");
  });
});
