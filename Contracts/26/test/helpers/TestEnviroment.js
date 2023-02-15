const { assert, artifacts } = require("hardhat");
const { BN, expectRevert, ether, expectEvent, balance, time } = require("@openzeppelin/test-helpers");
const _ = require("underscore");
const { current } = require("@openzeppelin/test-helpers/src/balance");
const { web3 } = require("@openzeppelin/test-helpers/src/setup");
const { object } = require("underscore");
const { createSolutionBuilderHost } = require("typescript");

// main contracts
const RCFactory = artifacts.require("./RCFactory.sol");
const RCTreasury = artifacts.require("./RCTreasury.sol");
const RCMarket = artifacts.require("./RCMarket.sol");
const NftHubL2 = artifacts.require("./nfthubs/RCNftHubL2.sol");
const NftHubL1 = artifacts.require("./nfthubs/RCNftHubL1.sol");
const RCOrderbook = artifacts.require('./RCOrderbook.sol');
const RCLeaderboard = artifacts.require('./RCLeaderboard.sol');
// mockups
const RealitioMockup = artifacts.require("./mockups/RealitioMockup.sol");
const SelfDestructMockup = artifacts.require("./mockups/SelfDestructMockup.sol");
const DaiMockup = artifacts.require("./mockups/DaiMockup.sol");
const kleros = "0xd47f72a2d1d0E91b0Ec5e5f5d02B2dc26d00A14D";
const zeroAddress = "0x0000000000000000000000000000000000000000";
const tokenMockup = artifacts.require("./mockups/tokenMockup.sol");
// used where the address isn't important but can't be zero
const dummyAddress = '0x0000000000000000000000000000000000000001';



const delay = (duration) => new Promise((resolve) => setTimeout(resolve, duration));

module.exports = class TestEnviroment {
    constructor(accounts) {
        this.aliases = {
            admin: accounts[0],
            alice: accounts[1],
            bob: accounts[2],
            carol: accounts[3],
            dan: accounts[4],
            eve: accounts[5],
            frank: accounts[6],
            grace: accounts[7],
            harold: accounts[8],
            ivan: accounts[9],
        };
        Object.keys(this.aliases).forEach((alias) => {
            if (!this.aliases[alias]) delete this.aliases[alias];
        });
        this.configs = {
            MAX_DELETIONS: 50,
            LOOP_LIMIT: 100,
            ACCOUNTS_OFFSET: 10,
            AFFILIATE: web3.utils.soliditySha3("AFFILIATE"),
            ARTIST: web3.utils.soliditySha3("ARTIST"),
            CARD_AFFILIATE: web3.utils.soliditySha3("CARD_AFFILIATE"),
            FACTORY: web3.utils.soliditySha3("FACTORY"),
            GOVERNOR: web3.utils.soliditySha3("GOVERNOR"),
            MARKET: web3.utils.soliditySha3("MARKET"),
            ORDERBOOK: web3.utils.soliditySha3("ORDERBOOK"),
            OWNER: web3.utils.soliditySha3("OWNER"),
            TREASURY: web3.utils.soliditySha3("TREASURY"),
            UBER_OWNER: web3.utils.soliditySha3("UBER_OWNER"),
            WHITELIST: web3.utils.soliditySha3("WHITELIST"),
        }
        this.constants = Object.assign(
            {},
            require("@openzeppelin/test-helpers").constants
        );
        this.testHelpers = Object.assign(
            {},
            require("@openzeppelin/test-helpers")
        );
        this.contracts = {};
    }

    errorHandler(err) {
        if (err) throw err;
    }

    async setup(accounts) {
        this.contracts.erc20 = await tokenMockup.new("Token name", "TKN", ether("1000000"), this.aliases.admin);
        for (let index = 0; index < 10; index++) {
            await this.contracts.erc20.transfer(accounts[index], ether("1000"), { from: user0 });
        }
        // mockups
        this.contracts.realitio = await RealitioMockup.new();
        this.contracts.dai = await DaiMockup.new();
        // main contracts
        this.contracts.treasury = await RCTreasury.new(this.contracts.erc20.address);
        this.contracts.factory = await RCFactory.new(this.contracts.treasury.address, this.contracts.realitio.address, kleros);
        this.contracts.reference = await RCMarket.new();
        this.contracts.orderbook = await RCOrderbook.new(this.contracts.treasury.address);
        this.contracts.leaderboard = await RCLeaderboard.new(this.contracts.treasury.address);
        // nft hubs 
        this.contracts.nftHubL2 = await NftHubL2.new(this.contracts.factory.address, dummyAddress);
        this.contracts.nftHubL1 = await NftHubL1.new(dummyAddress);
        // tell treasury about factory, tell factory about nft hub and reference
        await this.contracts.treasury.setFactoryAddress(this.contracts.factory.address);
        await this.contracts.treasury.setOrderbookAddress(this.contracts.orderbook.address);
        await this.contracts.treasury.setLeaderboardAddress(this.contracts.leaderboard.address);
        await this.contracts.factory.setReferenceContractAddress(this.contracts.reference.address);
        await this.contracts.factory.setNftHubAddress(this.contracts.nftHubL2.address);
        await this.contracts.treasury.toggleWhitelist();

        // market creation, start off without any.
        this.contracts.markets = [];
        this.contracts.markets.push(await this.createMarket())
    }


    setDefaults = (options, defaults) => {
        return _.defaults({}, _.clone(options), defaults);
    }

    async createMarket(options) {
        // default values if no parameter passed
        // mode, 0 = classic, 1 = winner takes all, 2 = safe mode
        // timestamps are in seconds from now
        var question = 'Test 6␟"X","Y","Z"␟news-politics␟en_US';
        let slug = 'my-Test-Slug'
        var defaults = {
            mode: 0,
            openTime: 0,
            closeTime: 31536000,
            resolveTime: 31536000,
            numberOfCards: 4,
            artistAddress: zeroAddress,
            affiliateAddress: zeroAddress,
            cardAffiliate: [],
            sponsorship: 0,
        };
        options = this.setDefaults(options, defaults);
        // assemble arrays
        var closeTime = new BN(options.closeTime).add(await time.latest());
        var resolveTime = new BN(options.resolveTime).add(await time.latest());
        var timestamps = [options.openTime, closeTime, resolveTime];
        var tokenURIs = [];
        for (let i = 0; i < options.numberOfCards; i++) {
            tokenURIs.push("x");
        }
        // double the length of the array for the copies of the NFTs to mint
        tokenURIs = tokenURIs.concat(tokenURIs)
        await this.contracts.factory.createMarket(
            options.mode,
            "0x0",
            slug,
            timestamps,
            tokenURIs,
            options.artistAddress,
            options.affiliateAddress,
            options.cardAffiliate,
            question,
            options.sponsorship
        );
        let newMarket = await this.contracts.factory.getMostRecentMarket.call(0)
        await this.contracts.factory.changeMarketApproval(newMarket);
        return RCMarket.at(newMarket);
    }
    async newRental(options) {
        var defaults = {
            market: markets[0],
            outcome: 0,
            price: 1,
            from: this.aliases.alice,
            timeLimit: 0,
            startingPosition: zeroAddress,
        };
        options = setDefaults(options, defaults);
        options.price = web3.utils.toWei(options.price.toString(), "ether");
        return await options.market.newRental(options.price, options.timeLimit, options.startingPosition, options.outcome, { from: options.from });
    }

    async deposit(amount, user) {
        amount = web3.utils.toWei(amount.toString(), "ether");
        await this.contracts.erc20.approve(this.contracts.treasury.address, ether(amount.toString()), { from: user })
        await this.contracts.treasury.deposit(amount, user, { from: user });
    }

    async withdrawDeposit(amount, userx) {
        amount = web3.utils.toWei(amount.toString(), "ether");
        await treasury.withdrawDeposit(amount, true, { from: userx });
    }

    async rentDue(startTx, endTx, price) {
        let startTime = (await web3.eth.getBlock(startTx.receipt.blockNumber)).timestamp;
        let endTime = (await web3.eth.getBlock(endTx.receipt.blockNumber)).timestamp;
        let rentDue = ether(price).muln(endTime - startTime).divn(86400);
        return rentDue
    }

    async newRental(options) {
        var defaults = {
            market: this.contracts.markets[0],
            outcome: 0,
            price: 1,
            from: this.aliases.alice,
            timeLimit: 0,
            startingPosition: zeroAddress,
        };
        options = this.setDefaults(options, defaults);
        options.price = web3.utils.toWei(options.price.toString(), "ether");
        let receipt = await options.market.newRental(options.price, options.timeLimit, options.startingPosition, options.outcome, { from: options.from });
        return receipt;
    }

    async SelfDestructMockup() {
        return await SelfDestructMockup.new()
    }

    async checkOrderbook(expectedResult) {
        var defaults = {
            from: this.aliases.alice,
            market: this.contracts.markets[0],
            next: this.contracts.markets[0].address,
            prev: this.contracts.markets[0].address,
            outcome: 0,
            price: 1,
            timeLimit: 0,
        };
        expectedResult = this.setDefaults(expectedResult, defaults);
        expectedResult.price = web3.utils.toWei(expectedResult.price.toString(), "ether");
        let exists = await this.contracts.orderbook.bidExists(expectedResult.from, expectedResult.market.address, expectedResult.outcome)
        if (!exists) {
            console.log("Bid %s in market %s by user %s doesn't exist", expectedResult.outcome, expectedResult.market.address, expectedResult.from)
        }
        assert.equal(exists, true, "checkOrderbook failed, bid doesn't exist")
        let index = await this.contracts.orderbook.index(expectedResult.from, expectedResult.market.address, expectedResult.outcome);
        let bid = await this.contracts.orderbook.user(expectedResult.from, index);
        assert.equal(bid[0], expectedResult.market.address, "Bid is for incorrect Market")
        assert.equal(bid[1], expectedResult.next, "Next user in list is incorrect");
        assert.equal(bid[2], expectedResult.prev, "Prev user in list is incorrect");
        assert.equal(bid[3], expectedResult.outcome, "Bid is for incorrect Outcome");
        assert.equal(bid[4].toString(), expectedResult.price, "Bid price is incorrect");
        assert.equal(bid[5], expectedResult.timeLimit, "Time limit doesn't match");
        return expectedResult
    }

    async checkOwner(expectedResult) {
        var defaults = {
            from: this.aliases.alice,
            market: this.contracts.markets[0].address,
            outcome: 0,
        };
        expectedResult = this.setDefaults(expectedResult, defaults);

        // check the orderbook thinks they are the owner
        let index = await this.contracts.orderbook.index(expectedResult.market, expectedResult.market, expectedResult.outcome);
        let bid = await this.contracts.orderbook.user(expectedResult.market, index);
        assert.equal(bid[0], expectedResult.market, "Bid is for incorrect Market")
        assert.equal(bid[1], expectedResult.from, "Market doesn't think this is the owner");
        assert.equal(bid[3], expectedResult.outcome, "Bid is for incorrect Outcome");
    }

    populateBidArray(bids, options) {
        var defaults = {
            market: this.contracts.markets[0],
            outcome: 0,
        };
        options = this.setDefaults(options, defaults);

        for (let index = 0; index < bids.length; index++) {
            if (index == 0) {
                bids[index].prev = options.market.address
            } else {
                bids[index].prev = bids[index - 1].from
            }
            bids[index].outcome = options.outcome;
            if (index == bids.length - 1) {
                bids[index].next = options.market.address
            } else {
                bids[index].next = bids[index + 1].from
            }
        }
        return bids
    }

    swapBids(bids, pos1, pos2) {
        // preserve the market and outcome for populating later
        let options = {
            market: bids[0].prev,
            outcome: bids[0].outcome,
        };

        //swap the array records so any extra parameters are moved
        [bids[pos1], bids[pos2]] = [bids[pos2], bids[pos1]];

        // just run populate again to get all the prev and next records
        let newBids = this.populateBidArray(bids, options);
        return newBids;
    }

    newBid(bids, bid, pos) {
        bids.push(bid);
        bids = this.swapBids(bids, pos, (bids.length - 1));
        return bids;
    }

    accessControl(user, role) {
        let roleHash = web3.utils.soliditySha3(role)
        let errorMsg = "AccessControl: account " + user.toLowerCase() + " is missing role " + roleHash
        return errorMsg
    }

    async cleanup() {
        for (const [key, value] of Object.entries(this.aliases)) {
            try {
                await this.withdrawDeposit(9999, value);
            } catch (error) {
                // console.log("failed withdraw", error)
            }
        }
    }

    async printOrderbook(options) {
        var defaults = {
            market: this.contracts.markets[0].address,
            outcome: 0,
        };
        options = this.setDefaults(options, defaults);
        let complete = false;
        let i = 0;
        let index;
        let bid = [];
        let user = options.market;
        while (!complete) {
            i++;
            index = await this.contracts.orderbook.index(user, options.market, options.outcome);
            bid = await this.contracts.orderbook.user(user, index);
            user = bid[1];
            if (bid[1] == options.market) {
                complete = true;
            } else {
                console.log(" User %s in orderbook: %s", i, bid[1]);
            }
        }
    }
    async orderbookSize(options) {
        var defaults = {
            market: this.contracts.markets[0].address,
            outcome: 0,
        };
        options = this.setDefaults(options, defaults);
        let complete = false;
        let i = 0;
        let index, bid;
        let user = options.market;
        while (!complete) {
            index = await this.contracts.orderbook.index(user, options.market, options.outcome);
            bid = await this.contracts.orderbook.user(user, index);
            user = bid[1];
            if (bid[1] == options.market) {
                complete = true;
            } else {
                i++;
            }
        }
        return i;
    }
    async checkAllLists() {

    }

    async checkMarketLists(options) {
        var defaults = {
            market: this.contracts.markets[0]
        };
        options = this.setDefaults(options, defaults);
        let numberOfCards = await options.market.numberOfCards();
        let totalBidCount = 0;
        let overalSuccess = true;
        for (let i = 0; i < numberOfCards; i++) {
            options.outcome = i
            let { success, bidCount } = await this.checkCardLists(options);
            totalBidCount += bidCount;
            overalSuccess = success;
        }
        return { overalSuccess, totalBidCount }
    }

    async checkCardLists(options) {
        var defaults = {
            market: this.contracts.markets[0],
            outcome: 0,
        };
        options = this.setDefaults(options, defaults);
        options.market = options.market.address
        let record = await this.contracts.orderbook.getBid(options.market, options.market, options.outcome);
        let prevRecord = options.market;
        let nextRecord = record[1];
        let i = 0;
        let success = true;
        // check forwards
        while (record[1] != options.market && success == true) {
            record = await this.contracts.orderbook.getBid(options.market, record[1], options.outcome);
            if (record[0] != options.market || prevRecord != record[2] || record[3] != options.outcome) {
                console.log("Fail forwards test");
                success = false;
            }
            prevRecord = nextRecord;
            nextRecord = record[1];
            i++;
        }
        record = await this.contracts.orderbook.getBid(options.market, options.market, options.outcome);
        prevRecord = options.market;
        nextRecord = record[2];
        // check backwards
        while (record[2] != options.market && success == true) {
            record = await this.contracts.orderbook.getBid(options.market, record[2], options.outcome);
            if (record[0] != options.market || prevRecord != record[1] || record[3] != options.outcome) {
                console.log("Fail backwards test");
                success = false;
            }
            prevRecord = nextRecord;
            nextRecord = record[2];
            i++;
        }
        let bidCount = i / 2;
        return { success, bidCount };
    }
};
