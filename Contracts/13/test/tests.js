const { ERC1820 } = require('@openzeppelin/test-helpers/src/makeInterfaceId');
const TestEnviroment = require('./helpers/TestEnviroment');

contract("RealityCardsTests", (accounts) => {
    const rc = new TestEnviroment(accounts);
    const { admin, alice, bob, carol, dan, eve, frank, grace, harold, ivan } = rc.aliases;
    const { MAX_UINT256, ZERO_ADDRESS } = rc.constants;
    const { expectRevert, time, ether, balance } = rc.testHelpers;
    const { ACCOUNTS_OFFSET } = rc.configs;

    beforeEach(async function () {
        await rc.setup(accounts);
        ({ treasury, factory, orderbook, markets, proxyL2, erc20 } = rc.contracts);
    });
    afterEach(async function () {
        await rc.cleanup();
    });

    describe("Treasury tests ", () => {
        it("Ensure only factory can add markets", async () => {
            // prove Factory can create a market
            var nextMarket = markets.length;
            // Assert this market doesn't exist yet
            assert.equal(typeof markets[nextMarket] === "undefined", true);
            markets.push(await rc.createMarket());
            // Assert this market now exists
            assert.equal(typeof markets[nextMarket] === "undefined", false);
            // Non-factory try and add a market
            await expectRevert(treasury.addMarket(alice), "Not factory");
        });

        it("check that non markets cannot call market only functions on Treasury", async () => {
            // only testing invalid responses, valid responses checked in each functions own test
            await expectRevert(treasury.payRent(admin), "Not authorised");
            await expectRevert(treasury.payout(admin, 0), "Not authorised");
            await expectRevert(treasury.sponsor(admin, 1), "Not authorised");
            await expectRevert(treasury.updateLastRentalTime(admin), "Not authorised");
        });

        it("check that non owners cannot call owner only functions on Treasury", async () => {
            // only testing invalid responses, valid responses checked in each functions own test
            await expectRevert(treasury.setMinRental(10, { from: alice }), "Ownable: caller is not the owner");
            await expectRevert(treasury.setMaxContractBalance(10, { from: alice }), "Ownable: caller is not the owner");
            await expectRevert(treasury.changeGlobalPause({ from: alice }), "Ownable: caller is not the owner");
            await expectRevert(treasury.changePauseMarket(ZERO_ADDRESS, { from: alice }), "Ownable: caller is not the owner");
        });

        it("check that inferior owners cannot call uberOwner functions on Treasury", async () => {
            // only testing invalid responses, valid responses checked in each functions own test
            await expectRevert(treasury.setFactoryAddress(markets[0].address, { from: alice }), "Extremely Verboten");
            await expectRevert(treasury.changeUberOwner(user2, { from: alice }), "Extremely Verboten");
            await expectRevert(treasury.setBridgeAddress(ZERO_ADDRESS, { from: alice }), "Extremely Verboten");
        });

        it("test setMinRental", async () => {
            // set value
            await treasury.setMinRental(24);
            // check value
            assert.equal(await treasury.minRentalDayDivisor(), 24);
            // change the value (it might already have been 24)
            await treasury.setMinRental(48);
            // check again
            assert.equal(await treasury.minRentalDayDivisor(), 48);
        });

        it("test setMaxContractBalance function and deposit limit hit", async () => {
            // change deposit balance limit to 500 ether
            await treasury.setMaxContractBalance(web3.utils.toWei("500", "ether"));
            // 400 should work
            await rc.deposit(400, alice);
            // another 400 should not
            await erc20.approve(treasury.address, ether("400"), { from: alice });
            await expectRevert(treasury.deposit(ether("400"), alice, { from: alice }), "Limit hit");
        });

        it("test setAlternateReciverAddress", async () => {
            // check for zero address
            await expectRevert(treasury.setBridgeAddress(ZERO_ADDRESS), "Must set an address");
            // set value
            await treasury.setBridgeAddress(user9);
            // check value
            assert.equal(await treasury.bridgeAddress(), user9);
            // change the value
            await treasury.setBridgeAddress(user8);
            // check again
            assert.equal(await treasury.bridgeAddress(), user8);
        });

        it("test changeGlobalPause", async () => {
            var globalPauseState = await treasury.globalPause();
            // change value
            await treasury.changeGlobalPause();
            // check value
            assert.equal(await treasury.globalPause(), !globalPauseState);
            await expectRevert(treasury.withdrawDeposit(1, true), "Withdrawals are disabled");
            // change it back
            await treasury.changeGlobalPause();
            // check again
            assert.equal(await treasury.globalPause(), globalPauseState);
        });

        it("test changePauseMarket", async () => {
            // check state of market
            var pauseMarketState = await treasury.marketPaused(markets[0].address);
            // change value
            await treasury.changePauseMarket(markets[0].address);
            // check value
            assert.equal(await treasury.marketPaused(markets[0].address), !pauseMarketState);
            // change it back
            await treasury.changePauseMarket(markets[0].address);
            // check again
            assert.equal(await treasury.marketPaused(markets[0].address), pauseMarketState);
        });

        it("test setFactoryAddress", async () => {
            // check for zero address
            await expectRevert.unspecified(treasury.setFactoryAddress(ZERO_ADDRESS));
            // set value
            await treasury.setFactoryAddress(user9);
            // check value
            assert.equal(await treasury.factoryAddress(), user9);
            // change the value
            await treasury.setFactoryAddress(user8);
            // check again
            assert.equal(await treasury.factoryAddress(), user8);
        });

        it("test changeUberOwner", async () => {
            // check for zero address
            await expectRevert.unspecified(treasury.changeUberOwner(ZERO_ADDRESS));
            // set value
            await treasury.changeUberOwner(alice, { from: admin });
            // check value
            assert.equal(await treasury.uberOwner(), alice);
            // change the value
            await expectRevert(treasury.changeUberOwner(bob, { from: admin }), "Extremely Verboten");
            await treasury.changeUberOwner(bob, { from: alice });
            // check again
            assert.equal(await treasury.uberOwner(), bob);
        });

        it("test deposit", async () => {
            // check for zero address
            await expectRevert(treasury.deposit(0, alice), "Must deposit something");
            // make some deposits
            await rc.deposit(10, alice);
            await rc.deposit(20, bob);
            // check the individual and total deposit amounts
            assert.equal((await treasury.userDeposit(alice)).toString(), ether("10").toString());
            assert.equal((await treasury.userDeposit(bob)).toString(), ether("20").toString());
            assert.equal((await treasury.totalDeposits()).toString(), ether("30").toString());
        });

        it("test withdrawDeposit", async () => {
            // global pause checked in it's own test
            // can't withdraw if theres nothing to withdraw
            await expectRevert(treasury.withdrawDeposit(1, true), "Nothing to withdraw");
            // lets check we get all our funds back
            await rc.deposit(100, bob); // just so the contract has spare funds
            // record the users balance
            var tracker = await balance.tracker(alice);
            const startBalance = await erc20.balanceOf(alice)
            // make a deposit and get a receipt to find the gas cost
            await erc20.approve(treasury.address, ether('100'), { from: alice });
            var txReceipt = await treasury.deposit(ether('10'), alice, { from: alice });
            // let some time pass
            await time.increase(time.duration.minutes(10));
            // withdraw some deposit locally (getting a receipt again)
            txReceipt = await treasury.withdrawDeposit(ether("5"), true, { from: alice });
            // withdraw the rest via the bridge (getting a receipt again)
            // txReceipt = await treasury.withdrawDeposit(ether("5"), false, { from: alice });
            // withdrawing locally again, until the bridge is finished.
            txReceipt = await treasury.withdrawDeposit(ether("5"), true, { from: alice });
            // check the balance is correct (minus gas cost)
            const currentBalance = await erc20.balanceOf(alice)
            assert.equal(startBalance.toString(), currentBalance.toString());

            // check no rent collected yet
            assert.equal((await treasury.marketBalance()).toString(), 0);
            await rc.newRental({ from: bob })
            // can't withdraw too quickly ( ͡° ͜ʖ ͡°)	
            await expectRevert(treasury.withdrawDeposit(1, true, { from: bob }), "Too soon");
            await time.increase(time.duration.days(1));
            // now we can partial withdraw 
            await treasury.withdrawDeposit(ether("10"), true, { from: bob });
            // check we collected some rent
            assert(await treasury.marketBalance() != 0, "Rent wasn't collected");
            // check we still own the card
            assert.equal((await markets[0].ownerOf(0)), bob)
            await time.increase(time.duration.days(1));
            // withdraw everything, but lets go via the bridge this time
            // await treasury.withdrawDeposit(ether("100"), false, { from: bob });
            // withdrawing locally again, until the bridge is finished.
            await treasury.withdrawDeposit(ether("100"), true, { from: bob });
            // check we don't own the card or have any bids
            assert.equal((await markets[0].ownerOf(0)), markets[0].address);
            assert.equal((await treasury.userTotalBids(bob)), 0);
        });

        it("check cant rent or deposit if globalpause", async () => {
            // check it works normally
            await rc.deposit(10, alice);
            await rc.newRental({ from: alice });
            // turn on global pause
            await treasury.changeGlobalPause();
            // now it should revert
            await expectRevert(rc.deposit(100, alice), "Deposits are disabled");
            await expectRevert(rc.newRental({ from: alice }), "Rentals are disabled");
            // change it back
            await treasury.changeGlobalPause();
            // and it works again
            await rc.deposit(100, alice);
            await rc.newRental({ outcome: 1, from: alice });
        });

        it("check cant rent if market paused", async () => {
            // setup
            markets.push(await rc.createMarket());
            // check it works normally
            await rc.deposit(100, alice);
            await rc.newRental();
            // turn on market pause
            await treasury.changePauseMarket(markets[0].address);
            // we can still deposit
            await rc.deposit(144, alice);
            // we can't use that market
            await expectRevert(rc.newRental(), "Rentals are disabled");
            // we can use a different market
            await rc.newRental({ market: markets[1] });
            await time.increase(time.duration.minutes(10));
            await rc.withdrawDeposit(1000, alice);
        });

        it("test force sending Ether to Treasury via self destruct", async () => {
            let selfdestruct = await rc.SelfDestructMockup();
            // send ether direct to self destruct contract
            await selfdestruct.send(web3.utils.toWei("1000", "ether"));
            await selfdestruct.killme(treasury.address);
            // do a regs deposit
            await rc.deposit(100, ivan);
        });

        it("test updateUserBids", async () => {

            // setup
            markets.push(await rc.createMarket());
            await rc.deposit(10, alice);
            await rc.deposit(100, bob);
            await rc.deposit(10, carol);
            await rc.deposit(10, dan);
            // make a rental, check it updates the userBids
            await rc.newRental({ price: 5 });
            var totalRentals = await treasury.userTotalBids(alice);
            assert.equal(totalRentals.toString(), ether("5").toString());
            // make another rental and check again
            await rc.newRental({ price: 3, outcome: 1 });
            var totalRentals = await treasury.userTotalBids(alice);
            assert.equal(totalRentals.toString(), ether("8").toString());
            // different market this time
            await rc.newRental({ price: 1, market: markets[1] });
            var totalRentals = await treasury.userTotalBids(alice);
            assert.equal(totalRentals.toString(), ether("9").toString());
            // increase bid, still correct?
            await rc.newRental({ price: 6 });
            var totalRentals = await treasury.userTotalBids(alice);
            assert.equal(totalRentals.toString(), ether("10").toString());
            // decrease bid, still correct? user0=8
            await rc.newRental({ price: 4 });
            var totalRentals = await treasury.userTotalBids(alice);
            assert.equal(totalRentals.toString(), ether("8").toString());
            // someone else takes it off them, are both correct? user0=8 user1=7
            await rc.newRental({ from: bob, price: 7 });
            var totalRentals = await treasury.userTotalBids(alice);
            assert.equal(totalRentals.toString(), ether("8").toString());
            var totalRentals = await treasury.userTotalBids(bob);
            assert.equal(totalRentals.toString(), ether("7").toString());
            // change cardPrice, check both are correct user0=12 user1=7
            await rc.newRental({ price: 8 });
            var totalRentals = await treasury.userTotalBids(alice);
            assert.equal(totalRentals.toString(), ether("12").toString());
            var totalRentals = await treasury.userTotalBids(bob);
            assert.equal(totalRentals.toString(), ether("7").toString());
            // new user exits, still correct? user0=12 user1=0
            await markets[0].exit(0, { from: bob });
            var totalRentals = await treasury.userTotalBids(alice);
            assert.equal(totalRentals.toString(), ether("12").toString());
            var totalRentals = await treasury.userTotalBids(bob);
            assert.equal(totalRentals.toString(), ether("0").toString());
            // this user exits, still correct?
            await markets[0].exit(0, { from: alice });
            var totalRentals = await treasury.userTotalBids(alice);
            assert.equal(totalRentals.toString(), ether("4").toString());
            // increase rent to 1439 (max 1440) then rent again, check it fails
            await rc.newRental({ price: 1435 });
            await expectRevert(rc.newRental({ price: 5, outcome: 3 }), " Insufficient deposit");
            // someone bids even higher, I increase my bid above what I can afford, we all run out of deposit, should not return to me
            await rc.newRental({ price: 2000, from: bob });
            await time.increase(time.duration.weeks(1));
            await markets[0].collectRentAllCards();
            // check owned by contract
            var owner = await markets[0].ownerOf.call(0);
            assert.equal(owner, markets[0].address);
        });

        it("test withdraw deposit after market close", async () => {
            // create a market that'll expire soon
            markets.push(await rc.createMarket({ closeTime: time.duration.weeks(1), resolveTime: time.duration.weeks(1) }));
            await rc.deposit(100, alice);
            await rc.newRental({ market: markets[1] });
            await time.increase(time.duration.weeks(1));
            //await market[1].collectRentAllCards();
            //await market[1].lockMarket();
            await rc.withdrawDeposit(1000, alice);
        });

        it("check bids are exited when user withdraws everything", async () => {
            await rc.deposit(100, alice);
            await rc.newRental({ price: 5 });
            await time.increase(time.duration.days(1));
            await rc.withdrawDeposit(5, alice);
            var totalRentals = await treasury.userTotalBids(alice);
            assert.equal(totalRentals.toString(), ether("5").toString());

            await rc.withdrawDeposit(1000, alice);
            var owner = await markets[0].ownerOf.call(0);
            assert.notEqual(owner, alice);
        });

        it("check payRent", async () => {
            const deposit = '100';
            const bid = '50';
            // global pause tested in it's own test
            // setup alternative market and bid on it
            markets.push(await rc.createMarket());
            // have alice bid elsewhere
            await rc.deposit(deposit, alice);
            await rc.newRental({ from: alice, market: markets[0] });
            assert.equal((await treasury.userDeposit(alice)).toString(), ether(deposit).toString());

            // deposit something and confirm all values
            await rc.deposit(deposit, bob);
            assert.equal((await treasury.userDeposit(bob)).toString(), ether(deposit).toString());
            assert.equal((await treasury.marketPot(markets[1].address)).toString(), '0');
            assert.equal((await treasury.totalMarketPots()).toString(), '0');
            assert.equal((await treasury.totalDeposits()).toString(), ether((deposit * 2).toString()).toString());

            //pay some rent
            const tx1 = await rc.newRental({ market: markets[1], price: bid, from: bob });
            await time.increase(time.duration.days(1));
            const tx2 = await markets[1].collectRentAllCards();
            let rentDue = await rc.rentDue(tx1, tx2, bid)

            // check the values have all been correcly adjusted
            assert.equal((await treasury.userDeposit(bob)).toString(), (ether(deposit).sub(rentDue)).toString());
            assert.equal((await treasury.marketPot(markets[1].address)).toString(), rentDue.toString());
            assert.equal((await treasury.totalMarketPots()).toString(), rentDue.toString());
            assert.equal((await treasury.totalDeposits()).toString(), (ether((deposit * 2).toString()).sub(rentDue)).toString());

        });

        it("check payout", async () => {
            // global pause tested in it's own test
            // depsoit some dai and confirm all values
            markets.push(await rc.createMarket({ closeTime: time.duration.days(3), resolveTime: time.duration.days(3) }));
            await rc.deposit(100, alice);
            await rc.deposit(100, bob);
            assert.equal((await treasury.userDeposit(alice)).toString(), ether('100').toString());
            assert.equal((await treasury.userDeposit(bob)).toString(), ether('100').toString());
            assert.equal((await treasury.marketPot(markets[1].address)).toString(), '0');
            assert.equal((await treasury.totalMarketPots()).toString(), '0');
            assert.equal((await treasury.totalDeposits()).toString(), ether('200').toString());

            // rent seperate cards
            await rc.newRental({ from: alice, price: 50, market: markets[1], outcome: 0 })
            await rc.newRental({ from: bob, price: 50, market: markets[1], outcome: 1 })
            // make the market expire
            await time.increase(time.duration.days(3));
            await markets[1].lockMarket();

            // card 0 won, user0 should get the payout
            await markets[1].setAmicableResolution(0)
            await markets[1].withdraw({ from: alice });

            // check the values have all been correcly adjusted
            assert.equal((await treasury.userDeposit(alice)).toString(), (ether('200').toString()));
            assert.equal((await treasury.userDeposit(bob)).toString(), (ether('0').toString()));
            assert.equal((await treasury.marketPot(markets[1].address)).toString(), '0');
            assert.equal((await treasury.totalMarketPots()).toString(), '0');
            assert.equal((await treasury.totalDeposits()).toString(), ether('200').toString());

        });
    })
    describe.skip("Limit tests ", () => {
        it(' Max search iterations ', async () => {
            let maxSearchLimit = (await orderbook.MAX_SEARCH_ITERATIONS()).toNumber();
            let safeNumberOfUsers = accounts.slice(ACCOUNTS_OFFSET, (maxSearchLimit + ACCOUNTS_OFFSET));
            await Promise.all(safeNumberOfUsers.map(async (user) => {
                await rc.deposit(100, user)
                await rc.newRental({ from: user })
            }));
            await rc.deposit(100, alice)
            await expectRevert(rc.newRental({ from: alice }), "Position in orderbook not found");
        })
        it(' Max rent calculations ', async () => {
            let extraBidsToPlace = 10;
            let maxRentCalcs = parseInt(await factory.maxRentIterations());
            let usersToForeclose = accounts.slice(ACCOUNTS_OFFSET, (maxRentCalcs + extraBidsToPlace + ACCOUNTS_OFFSET));
            await Promise.all(usersToForeclose.map(async (user) => {
                await rc.deposit(1, user)
                await rc.newRental({ from: user })
            }));
            assert.equal(await rc.orderbookSize(), maxRentCalcs + extraBidsToPlace, "Incorrect number of bids placed");
            await time.increase(time.duration.days(usersToForeclose.length + 10));
            await markets[0].collectRentAllCards();
            assert.equal(await rc.orderbookSize(), extraBidsToPlace, "Incorrect number of bids removed");
            await markets[0].collectRentAllCards();
            assert.equal(await rc.orderbookSize(), 0, "Incorrect number of bids removed");
        })
        it(' Foreclosed user max deletions (owner) ', async () => {
            const bidsToPlace = 200;
            const bidsPerMarket = 20;

            // place bids and create more markets as necessary
            let complete = false;
            let i;
            markets.push(await rc.createMarket({ numberOfCards: bidsPerMarket }));
            let j = 1;
            let bidsPlaced = 0;
            await rc.deposit(100, alice);
            while (!complete) {
                for (i = 0; i < Math.min(bidsPerMarket, bidsToPlace - bidsPlaced); i++) {
                    await rc.newRental({ outcome: i, market: markets[j] })
                }
                bidsPlaced += i;
                if (bidsPlaced == bidsToPlace) {
                    complete = true;
                } else {
                    markets.push(await rc.createMarket({ numberOfCards: bidsPerMarket }));
                    j++;
                }
            }

            await time.increase(time.duration.minutes(10));
            let userRecord = await treasury.user(alice);
            console.log("user bid rate ", userRecord[2].toString());
            console.log(" is foreclosed ", await treasury.isForeclosed(alice));
            // bids all placed, foreclose user
            await rc.withdrawDeposit(100, alice)
            userRecord = await treasury.user(alice);
            console.log("user bid rate ", userRecord[2].toString());
            console.log(" is foreclosed ", await treasury.isForeclosed(alice));
            await rc.newRental();
            userRecord = await treasury.user(alice);
            console.log("user bid rate ", userRecord[2].toString());
            console.log(" is foreclosed ", await treasury.isForeclosed(alice));
            await rc.deposit(100, alice);
            userRecord = await treasury.user(alice);
            console.log("user bid rate ", userRecord[2].toString());
            console.log(" is foreclosed ", await treasury.isForeclosed(alice));
        })
    })
    describe("Orderbook tests ", () => {
        describe("Bid order tests ", () => {
            it(' Underbidders correctly placed in orderbook ', async () => {
                let bids = [];
                bids[0] = {
                    from: alice,
                    price: 50,
                };
                bids[1] = {
                    from: bob,
                    price: 40,
                };
                bids[2] = {
                    from: carol,
                    price: 30,
                };
                bids[3] = {
                    from: dan,
                    price: 20,
                };
                bids[4] = {
                    from: eve,
                    price: 10,
                };
                await rc.populateBidArray(bids);

                // make deposits and place bids
                await Promise.all(bids.map(async (bid) => {
                    await rc.deposit(100, bid.from);
                    await rc.newRental(bid);
                }));

                // check the bids are in the correct order in the orderbook
                await rc.checkOwner(bids[0]);
                await Promise.all(bids.map(async (bid) => {
                    await rc.checkOrderbook(bid);
                }));
            })
            it(' New owners correctly placed in orderbook ', async () => {
                let bids = [];
                bids[0] = {
                    from: alice,
                    price: 50,
                };
                bids[1] = {
                    from: bob,
                    price: 40,
                };
                bids[2] = {
                    from: carol,
                    price: 30,
                };
                bids[3] = {
                    from: dan,
                    price: 20,
                };
                bids[4] = {
                    from: eve,
                    price: 10,
                };
                await rc.populateBidArray(bids);

                // make deposits and place bids
                await Promise.all(bids.map(async (bid) => {
                    await rc.deposit(100, bid.from);
                }));

                // place bids in reverse order, so next bid is always new owner
                for (let i = (bids.length - 1); i >= 0; i--) {
                    await rc.newRental(bids[i]);
                }

                // check the bids are in the correct order in the orderbook
                await rc.checkOwner(bids[0]);
                await Promise.all(bids.map(async (bid) => {
                    await rc.checkOrderbook(bid);
                }));
            })
            it(' Equal bids correctly placed in orderbook ', async () => {
                let bids = [];
                bids[0] = {
                    from: alice,
                    price: 50,
                };
                bids[1] = {
                    from: bob,
                    price: 30,
                };
                bids[2] = {
                    from: carol,
                    price: 30,
                };
                bids[3] = {
                    from: dan,
                    price: 30,
                };
                bids[4] = {
                    from: eve,
                    price: 10,
                };
                await rc.populateBidArray(bids);

                // make deposits and place bids
                await Promise.all(bids.map(async (bid) => {
                    await rc.deposit(100, bid.from);
                    await rc.newRental(bid);
                }));

                // check the bids are in the correct order in the orderbook
                await rc.checkOwner(bids[0]);
                await Promise.all(bids.map(async (bid) => {
                    await rc.checkOrderbook(bid);
                }));
            })
            it(' Bids reduced and correctly placed in orderbook ', async () => {
                let bids = [];
                bids[0] = {
                    from: alice,
                    price: 50,
                };
                bids[1] = {
                    from: bob,
                    price: 30,
                };
                bids[2] = {
                    from: carol,
                    price: 31,
                };
                bids[3] = {
                    from: dan,
                    price: 29,
                };
                bids[4] = {
                    from: eve,
                    price: 29.5,
                };
                await rc.populateBidArray(bids);

                // make deposits and place bids
                await Promise.all(bids.map(async (bid) => {
                    await rc.deposit(100, bid.from);
                    await rc.newRental(bid);
                }));

                // bids 2 & 4 should have been reduced by contract, reduce them here before checking
                bids[2].price = 30;
                bids[4].price = 29;

                // check the bids are in the correct order in the orderbook
                await rc.checkOwner(bids[0]);
                await Promise.all(bids.map(async (bid) => {
                    await rc.checkOrderbook(bid);
                }));
            })
            it(' Owner changes their price (no change in owner) ', async () => {
                let bids = [];
                bids[0] = {
                    from: alice,
                    price: 50,
                };
                bids[1] = {
                    from: bob,
                    price: 40,
                };
                bids[2] = {
                    from: carol,
                    price: 30,
                };
                await rc.populateBidArray(bids);

                // make deposits and place bids
                await Promise.all(bids.map(async (bid) => {
                    await rc.deposit(100, bid.from);
                    await rc.newRental(bid);
                }));

                // owner increases price
                bids[0].price += 5
                await rc.newRental(bids[0])

                // owner decreases price
                bids[0].price -= 10
                await rc.newRental(bids[0])

                // check the bids are in the correct order in the orderbook
                await rc.checkOwner(bids[0]);
                await Promise.all(bids.map(async (bid) => {
                    await rc.checkOrderbook(bid);
                }));
            })
            it(' Owner changes their price (change in owner) ', async () => {
                let bids = []
                bids[0] = {
                    from: alice,
                    price: 50,
                }
                bids[1] = {
                    from: bob,
                    price: 40,
                }
                bids[2] = {
                    from: carol,
                    price: 30,
                }
                bids = await rc.populateBidArray(bids)

                // make deposits and place bids
                await Promise.all(bids.map(async (bid) => {
                    await rc.deposit(100, bid.from);
                    await rc.newRental(bid);
                }));

                // owner decreases price, looses ownership
                bids[0].price = bids[1].price - 5;
                bids = rc.swapBids(bids, 0, 1)
                await rc.newRental(bids[1])

                // check the bids are in the correct order in the orderbook
                await rc.checkOwner(bids[0]);
                await Promise.all(bids.map(async (bid) => {
                    await rc.checkOrderbook(bid);
                }));
            })
            it(' Underbidder decreases their price (no change in position) ', async () => {
                let bids = []
                bids[0] = {
                    from: alice,
                    price: 50,
                }
                bids[1] = {
                    from: bob,
                    price: 40,
                }
                bids[2] = {
                    from: carol,
                    price: 30,
                }
                bids = await rc.populateBidArray(bids)

                // make deposits and place bids
                await Promise.all(bids.map(async (bid) => {
                    await rc.deposit(100, bid.from);
                    await rc.newRental(bid);
                }));

                // underbidder decreases price, no change in ownership
                bids[1].price -= 5;
                await rc.newRental(bids[1])

                // check the bids are in the correct order in the orderbook
                await rc.checkOwner(bids[0]);
                await Promise.all(bids.map(async (bid) => {
                    await rc.checkOrderbook(bid);
                }));
            })
            it(' Underbidder increases their price (change in position) ', async () => {
                let bids = []
                bids[0] = {
                    from: alice,
                    price: 50,
                }
                bids[1] = {
                    from: bob,
                    price: 40,
                }
                bids[2] = {
                    from: carol,
                    price: 30,
                }
                bids = await rc.populateBidArray(bids)

                // make deposits and place bids
                await Promise.all(bids.map(async (bid) => {
                    await rc.deposit(100, bid.from);
                    await rc.newRental(bid);
                }));

                // owner decreases price, looses ownership
                bids[1].price = bids[2].price - 5;
                bids = rc.swapBids(bids, 1, 2)
                await rc.newRental(bids[2])

                // check the bids are in the correct order in the orderbook
                await rc.checkOwner(bids[0]);
                await Promise.all(bids.map(async (bid) => {
                    await rc.checkOrderbook(bid);
                }));
            })
        })
        describe("Cleanup tests ", () => {

        })
        describe.skip("Old tests for reference ", () => {
            it('test orderbook various', async () => {
                // Tests the following:
                // add to orderbook in correct order
                // reduces the price to match that above it in the list
                // expected revert because incorrect starting location: too high and too low
                // update bid: test all cases
                user10 = accounts[10];
                user11 = accounts[11];
                user12 = accounts[12];
                user13 = accounts[13];
                user14 = accounts[14];
                await depositDai(10, user0);
                await depositDai(10, user1);
                await depositDai(10, user2);
                await depositDai(10, user3);
                await depositDai(10, user4);
                await depositDai(10, user5);
                await depositDai(10, user6);
                await depositDai(10, user7);
                await depositDai(10, user8);
                await depositDai(10, user9);
                await depositDai(10, user10);
                await depositDai(10, user11);
                await depositDai(10, user12);
                await depositDai(10, user13);
                await depositDai(10, user14);
                // rentals: position/price
                await newRentalCustomTimeLimit(10, 1, 0, user0); // 2, 10
                await newRental(9, 0, user1); // 5, 9
                await newRental(8, 0, user2); // 6, 8
                await newRental(10, 0, user3); // 3,1 10
                // var returnedPrice = await realitycards.newRental.call(ether('10.9'), 0, zeroAddress, 0, { from: user4 });
                //assert.equal(returnedPrice.toString(), ether('10').toString());
                await newRental(10.9, 0, user4); // 4, 10
                await newRental(20, 0, user5); // 1, 20
                await newRental(5, 0, user6); // 9, 5
                await newRental(8.5, 0, user7); // 7, 8
                await newRental(6, 0, user8); // 8, 6
                await newRental(50, 0, user9); // 0, 50
                await newRentalWithStartingPosition(4.8, 0, user5, user12); // 11, 4.8
                await newRentalWithStartingPosition(5, 0, user5, user13); // 10, 5 // <- this one checks that it matches one above, it is not reduced
                await newRentalWithStartingPosition(4.8, 0, user7, user14); // 12, 4.8
                var owner = await realitycards.ownerOf.call(0);
                assert.equal(owner, user9);
                var price = await realitycards.cardPrice.call(0);
                assert.equal(price, web3.utils.toWei('50', 'ether'));
                // check position and price
                // position 0
                var bid = await rcorderbook.getBid.call(realitycards.address, user9, 0);
                assert.equal(bid[4], web3.utils.toWei('50', 'ether'));
                assert.equal(bid[1], user5);
                assert.equal(bid[2], realitycards.address);
                // position 1
                var bid = await rcorderbook.getBid.call(realitycards.address, user5, 0);
                assert.equal(bid[4], web3.utils.toWei('20', 'ether'));
                assert.equal(bid[1], user0);
                assert.equal(bid[2], user9);
                // position 2
                var bid = await rcorderbook.getBid.call(realitycards.address, user0, 0);
                assert.equal(bid[4], web3.utils.toWei('10', 'ether'));
                //assert.equal(bid[5], (3600 * 24)); //timeHeldLimit now reduces as time is accrued, test needs updating.
                assert.equal(bid[1], user3);
                assert.equal(bid[2], user5);
                // position 3
                var bid = await rcorderbook.getBid.call(realitycards.address, user3, 0);
                assert.equal(bid[4], web3.utils.toWei('10', 'ether'));
                assert.equal(bid[1], user4);
                assert.equal(bid[2], user0);
                // position 4
                var bid = await rcorderbook.getBid.call(realitycards.address, user4, 0);
                assert.equal(bid[4], web3.utils.toWei('10', 'ether'));
                assert.equal(bid[1], user1);
                assert.equal(bid[2], user3);
                // position 5
                var bid = await rcorderbook.getBid.call(realitycards.address, user1, 0);
                assert.equal(bid[4], web3.utils.toWei('9', 'ether'));
                assert.equal(bid[1], user2);
                assert.equal(bid[2], user4);
                // position 6
                var bid = await rcorderbook.getBid.call(realitycards.address, user2, 0);
                assert.equal(bid[4], web3.utils.toWei('8', 'ether'));
                assert.equal(bid[1], user7);
                assert.equal(bid[2], user1);
                // position 7
                var bid = await rcorderbook.getBid.call(realitycards.address, user7, 0);
                assert.equal(bid[4], web3.utils.toWei('8', 'ether'));
                assert.equal(bid[1], user8);
                assert.equal(bid[2], user2);
                // position 8
                var bid = await rcorderbook.getBid.call(realitycards.address, user8, 0);
                assert.equal(bid[4], web3.utils.toWei('6', 'ether'));
                assert.equal(bid[1], user6);
                assert.equal(bid[2], user7);
                // position 9
                var bid = await rcorderbook.getBid.call(realitycards.address, user6, 0);
                assert.equal(bid[4], web3.utils.toWei('5', 'ether'));
                assert.equal(bid[1], user13);
                assert.equal(bid[2], user8);
                // position 10
                var bid = await rcorderbook.getBid.call(realitycards.address, user13, 0);
                assert.equal(bid[4], web3.utils.toWei('5', 'ether'));
                assert.equal(bid[1], user12);
                assert.equal(bid[2], user6);
                // position 11
                var bid = await rcorderbook.getBid.call(realitycards.address, user12, 0);
                assert.equal(bid[4], web3.utils.toWei('4.8', 'ether'));
                assert.equal(bid[1], user14);
                assert.equal(bid[2], user13);
                // position 12
                var bid = await rcorderbook.getBid.call(realitycards.address, user14, 0);
                assert.equal(bid[4], web3.utils.toWei('4.8', 'ether'));
                assert.equal(bid[1], realitycards.address);
                assert.equal(bid[2], user12);
                // check starting position
                // starting position too high - need more user account to test this now iteration limit is 100
                //await expectRevert(newRental(1,0,user10), "Location too high"); 
                //await expectRevert(newRentalWithStartingPosition(1,0,user9,user10), "Location too high");
                await newRentalWithStartingPosition(1, 0, user6, user10);
                // starting position too low
                await expectRevert(newRentalWithStartingPosition(10, 0, user1, user11), "Location too low");
                // update bid case 1A: was winner, > 10% higher, should just update price + limit
                await newRentalCustomTimeLimit(60, 1, 0, user9);
                var owner = await realitycards.ownerOf.call(0);
                assert.equal(owner, user9);
                var price = await realitycards.cardPrice.call(0);
                assert.equal(price.toString(), web3.utils.toWei('60', 'ether'));
                // await rcorderbook.printOrderbook(realitycards.address, 0);
                // console.log("0", user0);
                // console.log("1", user1);
                // console.log("2", user2);
                // console.log("3", user3);
                // console.log("4", user4);
                // console.log("5", user5);
                // console.log("6", user6);
                // console.log("7", user7);
                // console.log("8", user8);
                // console.log("9", user9);
                // console.log("10", user10);
                // console.log("11", user11);
                // console.log("12", user12);
                // console.log("13", user13);
                // console.log("14", user14);
                var bid = await rcorderbook.getBid.call(realitycards.address, user9, 0);
                assert.equal(bid[4], web3.utils.toWei('60', 'ether'));
                assert.equal(bid[5], (3600 * 24));
                assert.equal(bid[1], user5);
                assert.equal(bid[2], realitycards.address);
                // update bid case 1B: was winner, higher but < 10%, should remove
                await expectRevert(newRental(65, 0, user9), "Not 10% higher");
                await realitycards.exit(0, { from: user9 });
                // update bid case 1Ca: was winner, lower than prevous, but still winner, just update detials
                await newRentalCustomTimeLimit(15, 2, 0, user5);
                var owner = await realitycards.ownerOf.call(0);
                assert.equal(owner, user5);
                var price = await realitycards.cardPrice.call(0);
                assert.equal(price.toString(), web3.utils.toWei('15', 'ether'));
                var bid = await rcorderbook.getBid.call(realitycards.address, user5, 0);
                assert.equal(bid[4], web3.utils.toWei('15', 'ether'));
                assert.equal(bid[5], (3600 * 48));
                assert.equal(bid[1], user0);
                assert.equal(bid[2], realitycards.address);
                // update bid case 1Cb: was winner, but no longer winner, remove and add back
                await newRentalCustomTimeLimit(10.5, 0.5, 0, user5);
                var owner = await realitycards.ownerOf.call(0);
                assert.equal(owner, user0);
                var price = await realitycards.cardPrice.call(0);
                assert.equal(price, web3.utils.toWei('10', 'ether'));
                var bid = await rcorderbook.getBid.call(realitycards.address, user5, 0);
                assert.equal(bid[4], web3.utils.toWei('10', 'ether'));
                assert.equal(bid[5], (3600 * 12));
                assert.equal(bid[1], user1);
                assert.equal(bid[2], user4);
                // update bid case 2A: not winner, but now is [includes check that been deleted from previous location]
                await newRentalCustomTimeLimit(100, 0.5, 0, user7);
                var owner = await realitycards.ownerOf.call(0);
                assert.equal(owner, user7);
                var price = await realitycards.cardPrice.call(0);
                assert.equal(price, web3.utils.toWei('100', 'ether'));
                var bid = await rcorderbook.getBid.call(realitycards.address, user7, 0);
                assert.equal(bid[4], web3.utils.toWei('100', 'ether'));
                assert.equal(bid[5], (3600 * 12));
                assert.equal(bid[1], user0);
                assert.equal(bid[2], realitycards.address);
                var bid = await rcorderbook.getBid.call(realitycards.address, user2, 0);
                assert.equal(bid[1], user8);
                var bid = await rcorderbook.getBid.call(realitycards.address, user8, 0);
                assert.equal(bid[2], user2);
                // update bid case 2B: not winner, still isn't. Let's move user 8 up a few [and check moved from previous]
                await newRentalCustomTimeLimit(20, 2, 0, user8);
                var owner = await realitycards.ownerOf.call(0);
                assert.equal(owner, user7);
                var price = await realitycards.cardPrice.call(0);
                assert.equal(price, web3.utils.toWei('100', 'ether'));
                var bid = await rcorderbook.getBid.call(realitycards.address, user8, 0);
                assert.equal(bid[4], web3.utils.toWei('20', 'ether'));
                assert.equal(bid[5], (3600 * 48));
                assert.equal(bid[1], user0);
                assert.equal(bid[2], user7);
                var bid = await rcorderbook.getBid.call(realitycards.address, user2, 0);
                assert.equal(bid[1], user6);
                var bid = await rcorderbook.getBid.call(realitycards.address, user6, 0);
                assert.equal(bid[2], user2);
            });

            it('test _revertToUnderbidder', async () => {
                // console.log(user0); 
                // console.log(user1);
                // console.log(user2);
                // console.log(user3); 
                // console.log(user4);
                // console.log(user5);
                // console.log(user6); 
                // console.log(user7);
                // console.log(user8);
                // console.log(user9); 
                // console.log(user10); 
                // console.log(use11); 
                // console.log(user12); 
                // console.log(user3); 
                // console.log(realitycards.address); 
                await depositDai(10, user0);
                await depositDai(10, user1);
                await depositDai(10, user2);
                await depositDai(10, user3);
                await depositDai(10, user4);
                await depositDai(10, user5);
                await depositDai(10, user6);
                await depositDai(10, user7);
                await depositDai(10, user8);
                await depositDai(10, user9);
                // rentals: position/price
                await newRentalCustomTimeLimit(10, 1, 0, user0); // 2, 10
                await newRental(9, 0, user1); // 5, 9
                await newRental(8, 0, user2); // 6, 8
                await newRental(10, 0, user3); // 3,1 10
                await newRental(10.9, 0, user4); // 4, 10
                await newRental(20, 0, user5); // 1, 20
                await newRental(5, 0, user6); // 9, 5
                await newRental(8.5, 0, user7); // 7, 8
                await newRental(6, 0, user8); // 8, 6
                await newRental(50, 0, user9); // 0, 50
                // withdraw deposit of 9, will it switch to 0
                await time.increase(time.duration.minutes(10));
                await withdrawDeposit(1000, user9);
                await realitycards.collectRentAllCards();
                var owner = await realitycards.ownerOf.call(0);
                assert.equal(owner, user5);
                var price = await realitycards.cardPrice.call(0);
                assert.equal(price, web3.utils.toWei('20', 'ether'));
                var bid = await rcorderbook.getBid.call(realitycards.address, user5, 0);
                assert.equal(bid[2], realitycards.address);
                var bid = await rcorderbook.getBid.call(realitycards.address, user9, 0);
                assert.equal(bid[0], 0);
                // withraw deposit for next 4 in line, check it cyles through
                await time.increase(time.duration.minutes(10));
                await withdrawDeposit(1000, user5);
                await withdrawDeposit(1000, user0);
                await withdrawDeposit(1000, user3);
                await withdrawDeposit(1000, user4);
                await realitycards.collectRentAllCards();
                var owner = await realitycards.ownerOf.call(0);
                assert.equal(owner, user1);
                var price = await realitycards.cardPrice.call(0);
                assert.equal(price, web3.utils.toWei('9', 'ether'));
                var bid = await rcorderbook.getBid.call(realitycards.address, user1, 0);
                assert.equal(bid[2], realitycards.address);
                var bid = await rcorderbook.getBid.call(realitycards.address, user5, 0);
                assert.equal(bid[0], 0);
                var bid = await rcorderbook.getBid.call(realitycards.address, user0, 0);
                assert.equal(bid[0], 0);
                var bid = await rcorderbook.getBid.call(realitycards.address, user3, 0);
                assert.equal(bid[0], 0);
                var bid = await rcorderbook.getBid.call(realitycards.address, user4, 0);
                assert.equal(bid[0], 0);
            });

            it('test remove old bids', async () => {
                await time.increase(time.duration.weeks(50));
                await depositDai(100, user0);
                await depositDai(1000, user1);
                for (i = 0; i < 20; i++) {
                    await newRental(1, i, user0);
                    await newRental(2, i, user1);
                }
                await time.increase(time.duration.weeks(3));
                await realitycards.lockMarket();

                // check bids exist
                for (i = 0; i < 20; i++) {
                    var exists = await rcorderbook.bidExists(user0, realitycards.address, i);
                    assert.equal(exists, true);
                }

                // depositing should remove old bids
                await depositDai(100, user0);

                // check bids were deleted
                for (i = 0; i < 20; i++) {
                    var exists = await rcorderbook.bidExists(user0, realitycards.address, i);
                    assert.equal(exists, false);
                }
            });
        })

    });
})