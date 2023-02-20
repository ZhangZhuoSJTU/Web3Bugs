const {utils} = require("ethers");
const {MerkleTree} = require("merkletreejs");
const keccak256 = require("keccak256");

const Airdrop = artifacts.require("Airdrop");
const TestToken = artifacts.require("MockERC20");

const m = require('mocha-logger');
const {toWei, assertThrows} = require("./utils/OpenLevUtil");
const timeMachine = require('ganache-time-traveler');
const {awrap} = require("truffle/build/926.bundled");

contract("Airdrop", async accounts => {
    const users = [
        {address: "0xD08c8e6d78a1f64B1796d6DC3137B19665cb6F1F", amount: toWei(10).toString()},
        {address: "0xb7D15753D3F76e7C892B63db6b4729f700C01298", amount: toWei(15).toString()},
        {address: "0xf69Ca530Cd4849e3d1329FBEC06787a96a3f9A68", amount: toWei(20).toString()},
        {address: "0xa8532aAa27E9f7c3a96d754674c99F1E2f824800", amount: toWei(30).toString()},
        {address: "0xa8532aAa27E9f7c3a96d754674c99F1E2f824801", amount: toWei(30).toString()},
        {address: "0xa8532aAa27E9f7c3a96d754674c99F1E2f824802", amount: toWei(30).toString()},
        {address: "0xa8532aAa27E9f7c3a96d754674c99F1E2f824803", amount: toWei(30).toString()},
        {address: "0xa8532aAa27E9f7c3a96d754674c99F1E2f824804", amount: toWei(30).toString()},
        {address: "0xa8532aAa27E9f7c3a96d754674c99F1E2f824805", amount: toWei(30).toString()},
        {address: "0xa8532aAa27E9f7c3a96d754674c99F1E2f824806", amount: toWei(30).toString()},
        {address: "0xa8532aAa27E9f7c3a96d754674c99F1E2f824807", amount: toWei(30).toString()},
        {address: "0xa8532aAa27E9f7c3a96d754674c99F1E2f824808", amount: toWei(30).toString()},

    ];
    const leaves = users.map((x) =>
        utils.solidityKeccak256(["address", "uint256"], [x.address, x.amount])
    );

    const users1 = [
        {address: "0xD08c8e6d78a1f64B1796d6DC3137B19665cb6F1F", amount: toWei(100).toString()},
        {address: "0xe5E532C0a199Bd389AA0321D596871a3512d3db0", amount: toWei(15).toString()},
        {address: "0xa88A508A3fBd247ab784616D71Bb339Ea5d3B97A", amount: toWei(20).toString()}
    ];
    const leaves1 = users1.map((x) =>
        utils.solidityKeccak256(["address", "uint256"], [x.address, x.amount])
    );
    let airdrop;
    let token;
    let admin = accounts[0];
    beforeEach(async () => {
        token = await TestToken.new("T", "T");
        airdrop = await Airdrop.new(token.address, {from: admin});
        await token.mint(admin, toWei(10000000));
        await token.transfer(airdrop.address, toWei(10000000), {from: admin});
    });
    it("should claim successfully for valid proof", async () => {
        const merkleTree = new MerkleTree(leaves, keccak256, {sort: true});
        const root = merkleTree.getHexRoot();
        let lastbk = await web3.eth.getBlock('latest');
        await airdrop.newTranche(root, lastbk.timestamp - 2, lastbk.timestamp + 10000, toWei(75));
        let accountIdx = 2;
        m.log("merkleTree", merkleTree.toString());
        m.log("proof", merkleTree.getHexProof(leaves[accountIdx]));
        let tx = await airdrop.claim(users[accountIdx].address, 0, users[accountIdx].amount, merkleTree.getHexProof(leaves[accountIdx]));
        m.log("claim once gasUsed ", tx.receipt.gasUsed);
        assert.equal(users[accountIdx].amount, (await token.balanceOf(users[accountIdx].address)).toString());
    });

    it("should claim two tranches successfully for valid proof", async () => {
        const merkleTree1 = new MerkleTree(leaves, keccak256, {sort: true});
        const merkleTree2 = new MerkleTree(leaves1, keccak256, {sort: true});

        const root1 = merkleTree1.getHexRoot();
        const root2 = merkleTree2.getHexRoot();
        let lastbk = await web3.eth.getBlock('latest');
        await airdrop.newTranche(root1, lastbk.timestamp - 2, lastbk.timestamp + 10000, toWei(75));
        await airdrop.newTranche(root2, lastbk.timestamp - 2, lastbk.timestamp + 10000, toWei(135));

        let accountIdx = 0;
        m.log("merkleTree1", merkleTree1.toString());
        m.log("merkleTree2", merkleTree2.toString());
        let tx = await airdrop.claims(users[accountIdx].address, [0, 1], [users[accountIdx].amount, users1[accountIdx].amount],
            [merkleTree1.getHexProof(leaves[accountIdx]), merkleTree2.getHexProof(leaves1[accountIdx])]);
        m.log("claim twice gasUsed ", tx.receipt.gasUsed);
        assert.equal(toWei(110).toString(), (await token.balanceOf(users[accountIdx].address)).toString());
    });
    it("should claim error for incorrect proof", async () => {
        const merkleTree = new MerkleTree(leaves, keccak256, {sort: true});
        const root = merkleTree.getHexRoot();
        let lastbk = await web3.eth.getBlock('latest');
        await airdrop.newTranche(root, lastbk.timestamp - 2, lastbk.timestamp + 10000, toWei(75));
        let accountIdx = 2;
        await assertThrows(airdrop.claim(users[accountIdx].address, 0, users[accountIdx].amount, merkleTree.getHexProof(leaves[1])), 'Incorrect merkle proof');
    });
    it("should claim error for incorrect account", async () => {
        const merkleTree = new MerkleTree(leaves, keccak256, {sort: true});
        const root = merkleTree.getHexRoot();
        let lastbk = await web3.eth.getBlock('latest');
        await airdrop.newTranche(root, lastbk.timestamp - 2, lastbk.timestamp + 10000, toWei(75));
        let accountIdx = 2;
        await assertThrows(airdrop.claim(users[3].address, 0, users[accountIdx].amount, merkleTree.getHexProof(leaves[1])), 'Incorrect merkle proof');
    });
    it("should claim error for incorrect amount", async () => {
        const merkleTree = new MerkleTree(leaves, keccak256, {sort: true});
        const root = merkleTree.getHexRoot();
        let lastbk = await web3.eth.getBlock('latest');
        await airdrop.newTranche(root, lastbk.timestamp - 2, lastbk.timestamp + 10000, toWei(75));
        let accountIdx = 2;
        await assertThrows(airdrop.claim(users[accountIdx].address, 0, 1000000, merkleTree.getHexProof(leaves[1])), 'Incorrect merkle proof');
    });
    it("should claim error for double claim", async () => {
        const merkleTree = new MerkleTree(leaves, keccak256, {sort: true});
        const root = merkleTree.getHexRoot();
        let lastbk = await web3.eth.getBlock('latest');
        await airdrop.newTranche(root, lastbk.timestamp - 2, lastbk.timestamp + 10000, toWei(75));
        let accountIdx = 2;
        await airdrop.claim(users[accountIdx].address, 0, users[accountIdx].amount, merkleTree.getHexProof(leaves[accountIdx]));
        await assertThrows(airdrop.claim(users[accountIdx].address, 0, users[accountIdx].amount, merkleTree.getHexProof(leaves[accountIdx])), 'Already claimed');
    });

    it("should claim error for expire claim", async () => {
        const merkleTree = new MerkleTree(leaves, keccak256, {sort: true});
        const root = merkleTree.getHexRoot();
        let lastbk = await web3.eth.getBlock('latest');
        await airdrop.newTranche(root, lastbk.timestamp - 2, lastbk.timestamp + 10000, toWei(75));
        await timeMachine.advanceTime(lastbk.timestamp + 10001);
        let accountIdx = 2;
        await assertThrows(airdrop.claim(users[accountIdx].address, 0, users[accountIdx].amount, merkleTree.getHexProof(leaves[accountIdx])), 'Expire');
    });
    it("should claim error for not start claim", async () => {
        const merkleTree = new MerkleTree(leaves, keccak256, {sort: true});
        const root = merkleTree.getHexRoot();
        let lastbk = await web3.eth.getBlock('latest');
        await airdrop.newTranche(root, lastbk.timestamp + 100, lastbk.timestamp + 10000, toWei(75));
        let accountIdx = 2;
        await assertThrows(airdrop.claim(users[accountIdx].address, 0, users[accountIdx].amount, merkleTree.getHexProof(leaves[accountIdx])), 'Not Start');

    });
    it("should claim error for expire claim", async () => {
        const merkleTree = new MerkleTree(leaves, keccak256, {sort: true});
        const root = merkleTree.getHexRoot();
        let lastbk = await web3.eth.getBlock('latest');
        await airdrop.newTranche(root, lastbk.timestamp - 2, lastbk.timestamp + 10000, toWei(75));
        await timeMachine.advanceTime(lastbk.timestamp + 10001);
        let accountIdx = 2;
        await assertThrows(airdrop.claim(users[accountIdx].address, 0, users[accountIdx].amount, merkleTree.getHexProof(leaves[accountIdx])), 'Expire');
    });

    it("should expire tranche successfully", async () => {
        const merkleTree = new MerkleTree(leaves, keccak256, {sort: true});
        const root = merkleTree.getHexRoot();
        let lastbk = await web3.eth.getBlock('latest');
        await airdrop.newTranche(root, lastbk.timestamp - 2, lastbk.timestamp + 10000, toWei(75));
        let accountIdx = 2;
        await airdrop.claim(users[accountIdx].address, 0, users[accountIdx].amount, merkleTree.getHexProof(leaves[accountIdx]));
        await timeMachine.advanceTime(lastbk.timestamp + 10001);
        await airdrop.expireTranche(0);
        assert.equal("55000000000000000000", (await token.balanceOf(admin)).toString());
    });

    it("should expire tranche error for not admin", async () => {
        const merkleTree = new MerkleTree(leaves, keccak256, {sort: true});
        const root = merkleTree.getHexRoot();
        let lastbk = await web3.eth.getBlock('latest');
        await airdrop.newTranche(root, lastbk.timestamp - 2, lastbk.timestamp + 10000, toWei(75));
        let accountIdx = 2;
        await airdrop.claim(users[accountIdx].address, 0, users[accountIdx].amount, merkleTree.getHexProof(leaves[accountIdx]));
        await timeMachine.advanceTime(lastbk.timestamp + 10001);
        await assertThrows(airdrop.expireTranche(0, {from: accounts[2]}), 'caller is not the owner');
    });

    it("should new tranche error for not admin", async () => {
        const merkleTree = new MerkleTree(leaves, keccak256, {sort: true});
        const root = merkleTree.getHexRoot();
        let lastbk = await web3.eth.getBlock('latest');
        await assertThrows(airdrop.newTranche(root, lastbk.timestamp - 2, lastbk.timestamp + 10000, toWei(75), {from: accounts[2]}), 'caller is not the owner');
    });
})
