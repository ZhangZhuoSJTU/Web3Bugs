const OLEToken = artifacts.require("OLEToken");

const m = require('mocha-logger');

contract("OLEToken", async accounts => {


  it("mint burn approve transfer test", async () => {

    let oleToken = await OLEToken.new(accounts[0],accounts[0], "Open Leverage Token", "OLE");
    //mint
    await oleToken.mint(accounts[0], "1000000000000000000");
    // await oleToken.delegate(accounts[1]);
    let balanceOfAcc0 = await oleToken.balanceOf(accounts[0]);
    let totalSupply = await oleToken.totalSupply();
    m.log("balanceOfAcc0 ", balanceOfAcc0.toString());
    m.log("totalSupply ", totalSupply.toString());
    let blockNum = await web3.eth.getBlockNumber();
    //approve
    await oleToken.approve(accounts[1], 1);
    // m.log("acc1 getPriorVotes  ", await oleToken.getPriorVotes(accounts[1], blockNum));
    assert.equal("1000000001000000000000000000", balanceOfAcc0.toString());
    assert.equal("1000000001000000000000000000", totalSupply.toString());
    // assert.equal("10000001000000000000000000", (await oleToken.getPriorVotes(accounts[1], blockNum)).toString());
    //burn
    await oleToken.burn("1000000000000000000");
    blockNum = await web3.eth.getBlockNumber();
    await oleToken.approve(accounts[1], 1);
    balanceOfAcc0 = await oleToken.balanceOf(accounts[0]);
    totalSupply = await oleToken.totalSupply();
    assert.equal("1000000000000000000000000000", balanceOfAcc0.toString());
    assert.equal("1000000000000000000000000000", totalSupply.toString());
    // m.log("acc1 getPriorVotes  ", await oleToken.getPriorVotes(accounts[1], blockNum));
    // assert.equal("10000000000000000000000000", (await oleToken.getPriorVotes(accounts[1], blockNum)).toString());
    //transfer
    await oleToken.mint(accounts[0], "1");
    await oleToken.transferFrom(accounts[0], accounts[1], 1, {
      from: accounts[1]
    });
    assert.equal("1000000000000000000000000000", (await oleToken.balanceOf(accounts[0])).toString());
    assert.equal("1", (await oleToken.balanceOf(accounts[1])).toString());

  })

})
