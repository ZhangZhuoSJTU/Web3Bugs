const utils = require("./utils/OpenLevUtil");
const m = require('mocha-logger');
const {toBN} = require("./utils/EtheUtil");
const {createToken} = require("./utils/OpenLevUtil");

const OpenLevDelegate = artifacts.require("OpenLevV1");
const OpenLevV1 = artifacts.require("OpenLevDelegator");

const LPoolDelegate = artifacts.require('LPool');
const LPoolDelegator = artifacts.require("LPoolDelegator");
const LPoolUpgradeV2 = artifacts.require("UpgradeLPoolV2");

const ControllerDelegate = artifacts.require("ControllerV1");
const ControllerDelegator = artifacts.require("ControllerDelegator");
const ControllerUpgradeV2 = artifacts.require("UpgradeControllerV2");

contract("Upgrade", async accounts => {
    //TODO fix out of gas
    // it("OpenLev Upgrade test", async () => {
    //     let delegate = await OpenLevDelegate.new();
    //     let openLev = await OpenLevV1.new("0x0000000000000000000000000000000000000001",
    //         "0x0000000000000000000000000000000000000000", [], "0x0000000000000000000000000000000000000000",
    //         "0x0000000000000000000000000000000000000000",[1,2], accounts[0], delegate.address);
    //
    //     //update
    //     let updateDelegate = await OpenLevUpgradeV2.new();
    //     await openLev.setImplementation(updateDelegate.address);
    //     openLev = await OpenLevDelegate.at(openLev.address);
    //     let trade = await openLev.activeTrades("0x0000000000000000000000000000000000000000", 0, 0);
    //     let numPairs = await openLev.numPairs();
    //     openLev = await OpenLevV1.at(openLev.address);
    //
    //     assert.equal("0", trade[0]);
    //     assert.equal("0", numPairs);
    //
    //
    //
    //     let setVersion = await web3.eth.abi.encodeFunctionCall({
    //         name: 'setVersion',
    //         type: 'function',
    //         inputs: []
    //     }, []);
    //     m.log("openLev setVersion ", await openLev.delegateToImplementation(setVersion));
    //
    //     let getVersion = await web3.eth.abi.encodeFunctionCall({
    //         name: 'version',
    //         type: 'function',
    //         inputs: []
    //     }, []);
    //     m.log("openLev getVersion ", await openLev.delegateToViewImplementation(getVersion));
    //     assert.equal("0x0000000000000000000000000000000000000000000000000000000000000001", await openLev.delegateToViewImplementation(getVersion));
    // })


    it("LPool Upgrade test", async () => {
        let delegate = await LPoolDelegate.new();
        let token = await createToken("test");
        let pool = await LPoolDelegator.new();
        pool.initialize(token.address,
            false,
            accounts[0],
            toBN(5e16).div(toBN(2102400)), toBN(10e16).div(toBN(2102400)), toBN(20e16).div(toBN(2102400)), 50e16 + '',
            1e18 + '',
            'TestPool',
            'TestPool',
            18,
            accounts[0],
            delegate.address);

        //update
        let updateDelegate = await LPoolUpgradeV2.new();
        await pool.setImplementation(updateDelegate.address);

        let functionCall = await web3.eth.abi.encodeFunctionCall({
            name: 'getName',
            type: 'function',
            inputs: []
        }, []);
        m.log("pool getName ", await pool.delegateToViewImplementation(functionCall));
        assert.equal("0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000e4c506f6f6c557067726164655632000000000000000000000000000000000000", await pool.delegateToViewImplementation(functionCall));

        let setVersion = await web3.eth.abi.encodeFunctionCall({
            name: 'setVersion',
            type: 'function',
            inputs: []
        }, []);
        m.log("pool setVersion ", await pool.delegateToImplementation(setVersion));

        let getVersion = await web3.eth.abi.encodeFunctionCall({
            name: 'version',
            type: 'function',
            inputs: []
        }, []);
        m.log("pool getVersion ", await pool.delegateToViewImplementation(getVersion));
        assert.equal("0x0000000000000000000000000000000000000000000000000000000000000001", await pool.delegateToViewImplementation(getVersion));
    })

    // TODO fix xOLE upgrade test
    // it("xOLE Upgrade test", async () => {
    //   let delegate = await TreasuryDelegate.new();
    //   let treasury = await TreasuryDelegator.new(accounts[0], accounts[0],
    //     accounts[0], 50, accounts[0], accounts[0], delegate.address);
    //   //update
    //   let updateDelegate = await TreasuryUpgradeV2.new();
    //   await treasury.setImplementation(updateDelegate.address);
    //   let devFundRatio = await treasury.devFundRatio();
    //   m.log("devFundRatio ", devFundRatio);
    //
    //   assert.equal("50", devFundRatio);
    //
    //   let functionCall = await web3.eth.abi.encodeFunctionCall({
    //     name: 'getName',
    //     type: 'function',
    //     inputs: []
    //   }, []);
    //   m.log("treasury getName ", await treasury.delegateToViewImplementation(functionCall));
    //   assert.equal("0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000115472656173757279557067726164655632000000000000000000000000000000", await treasury.delegateToViewImplementation(functionCall));
    //
    //   let setVersion = await web3.eth.abi.encodeFunctionCall({
    //     name: 'setVersion',
    //     type: 'function',
    //     inputs: []
    //   }, []);
    //   m.log("treasury setVersion ", await treasury.delegateToImplementation(setVersion));
    //
    //   let getVersion = await web3.eth.abi.encodeFunctionCall({
    //     name: 'version',
    //     type: 'function',
    //     inputs: []
    //   }, []);
    //   m.log("treasury getVersion ", await treasury.delegateToViewImplementation(getVersion));
    //   assert.equal("0x0000000000000000000000000000000000000000000000000000000000000001", await treasury.delegateToViewImplementation(getVersion));
    // })


    it("Controller Upgrade test", async () => {

        let delegate = await ControllerDelegate.new();
        let controller = await ControllerDelegator.new("0x0000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000",
            "0x0000000000000000000000000000000000000000",
            "0x02",
            accounts[0],
            delegate.address);
        //update
        let updateDelegate = await ControllerUpgradeV2.new();
        await controller.setImplementation(updateDelegate.address);
        controller = await ControllerUpgradeV2.at(controller.address);
        let baseRatePerBlock = await controller.baseRatePerBlock();
        controller = await ControllerDelegator.at(controller.address);
        m.log("baseRatePerBlock ", baseRatePerBlock);

        assert.equal("0", baseRatePerBlock);

        let functionCall = await web3.eth.abi.encodeFunctionCall({
            name: 'getName',
            type: 'function',
            inputs: []
        }, []);
        m.log("controller getName ", await controller.delegateToViewImplementation(functionCall));
        assert.equal("0x00000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000013436f6e74726f6c6c657255706772616465563200000000000000000000000000", await controller.delegateToViewImplementation(functionCall));

        let setVersion = await web3.eth.abi.encodeFunctionCall({
            name: 'setVersion',
            type: 'function',
            inputs: []
        }, []);
        m.log("controller setVersion ", await controller.delegateToImplementation(setVersion));

        let getVersion = await web3.eth.abi.encodeFunctionCall({
            name: 'version',
            type: 'function',
            inputs: []
        }, []);
        m.log("controller getVersion ", await controller.delegateToViewImplementation(getVersion));
        assert.equal("0x0000000000000000000000000000000000000000000000000000000000000001", await controller.delegateToViewImplementation(getVersion));
    })

})
