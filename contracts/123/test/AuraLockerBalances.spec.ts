import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { Account } from "types";
import { deployMocks, getMockDistro, getMockMultisigs } from "../scripts/deployMocks";
import { deployPhase1, deployPhase2, deployPhase3, deployPhase4 } from "../scripts/deploySystem";
import { BN, getTimestamp, increaseTime, ONE_WEEK, simpleToExactAmount } from "../test-utils";
import { impersonateAccount } from "../test-utils/fork";
import { AuraLocker, AuraToken } from "../types/generated";
import balanceData from "./auraLockerBalanceData.json";

enum UserName {
    alice = "alice",
    bob = "bob",
    carol = "carol",
    daniel = "daniel",
}

enum ActionName {
    lock = "lock",
    processExpiredClaim = "processExpiredClaim",
    processExpiredRelock = "processExpiredRelock",
    checkpointEpoch = "checkpointEpoch",
    delegate1 = "delegate 1",
    delegate2 = "delegate 2",
    delegate3 = "delegate 3",
    balances = "balances",
}

interface Balance {
    user: UserName;
    balanceOf: BN;
    totalSupply: BN;
    votes: BN;
}

interface Action {
    user: UserName;
    action: ActionName;
    amount: BN;
}

interface EpochGroup {
    epoch: number;
    balances: Balance[];
    actions: Action[];
}

describe("AuraLockerBalances", () => {
    let auraLocker: AuraLocker;
    let cvx: AuraToken;

    let alice: Account;
    let bob: Account;
    let carol: Account;
    let daniel: Account;

    before(async () => {
        const accounts = await ethers.getSigners();
        const deployer = accounts[0];

        const mocks = await deployMocks(hre, deployer);
        const multisigs = await getMockMultisigs(accounts[1], accounts[2], accounts[3]);
        const distro = getMockDistro();

        const phase1 = await deployPhase1(hre, deployer, mocks.addresses);
        const phase2 = await deployPhase2(
            hre,
            deployer,
            phase1,
            distro,
            multisigs,
            mocks.namingConfig,
            mocks.addresses,
        );
        const phase3 = await deployPhase3(hre, deployer, phase2, multisigs, mocks.addresses);
        await phase3.poolManager.connect(accounts[3]).setProtectPool(false);
        const contracts = await deployPhase4(hre, deployer, phase3, mocks.addresses);

        alice = {
            signer: accounts[4],
            address: await accounts[4].getAddress(),
        };
        bob = {
            signer: accounts[5],
            address: await accounts[5].getAddress(),
        };
        carol = {
            signer: accounts[6],
            address: await accounts[6].getAddress(),
        };
        daniel = {
            signer: accounts[7],
            address: await accounts[7].getAddress(),
        };

        const booster = contracts.booster;
        auraLocker = contracts.cvxLocker;
        cvx = contracts.cvx;

        const operatorAccount = await impersonateAccount(booster.address);
        await cvx.connect(operatorAccount.signer).mint(operatorAccount.address, simpleToExactAmount(100000, 18));
        await cvx.connect(operatorAccount.signer).transfer(alice.address, simpleToExactAmount(10000));
        await cvx.connect(alice.signer).approve(auraLocker.address, simpleToExactAmount(10000));
        await cvx.connect(operatorAccount.signer).transfer(bob.address, simpleToExactAmount(10000));
        await cvx.connect(bob.signer).approve(auraLocker.address, simpleToExactAmount(10000));
        await cvx.connect(operatorAccount.signer).transfer(carol.address, simpleToExactAmount(10000));
        await cvx.connect(carol.signer).approve(auraLocker.address, simpleToExactAmount(10000));
        await cvx.connect(operatorAccount.signer).transfer(daniel.address, simpleToExactAmount(10000));
        await cvx.connect(daniel.signer).approve(auraLocker.address, simpleToExactAmount(10000));
    });

    const getGroupedData = (): EpochGroup[] => {
        const scale = simpleToExactAmount(1);
        const parsedData = balanceData.map(d => ({
            epoch: d.time,
            user: d.user as UserName,
            action: d.action as ActionName,
            amount: d.amount == null ? undefined : BN.from(d.amount).mul(scale),
            balanceOf: d.balanceOf == null ? undefined : BN.from(d.balanceOf).mul(scale),
            totalSupply: d.totalSupply == null ? undefined : BN.from(d.totalSupply).mul(scale),
            votes: d.votes == null ? undefined : BN.from(d.votes).mul(scale),
        }));
        const groupedData = [];
        parsedData.map(d => {
            let len = groupedData.length;
            if (len == 0 || groupedData[len - 1].epoch != d.epoch) {
                groupedData.push({
                    epoch: d.epoch,
                    balances: [],
                    actions: [],
                });
                len += 1;
            }
            if (d.action == ActionName.balances) {
                groupedData[len - 1].balances.push({
                    user: d.user,
                    balanceOf: d.balanceOf,
                    totalSupply: d.totalSupply,
                    votes: d.votes,
                });
            } else {
                groupedData[len - 1].actions.push({
                    user: d.user,
                    action: d.action,
                    amount: d.amount,
                });
            }
        });
        return groupedData;
    };

    const userToAccount = async (user: UserName): Promise<Account> => {
        const accounts = await ethers.getSigners();
        switch (user.toString()) {
            case UserName.alice.toString():
                return {
                    signer: accounts[4],
                    address: await accounts[4].getAddress(),
                };
            case UserName.bob.toString():
                return {
                    signer: accounts[5],
                    address: await accounts[5].getAddress(),
                };
            case UserName.carol.toString():
                return {
                    signer: accounts[6],
                    address: await accounts[6].getAddress(),
                };
            case UserName.daniel.toString():
                return {
                    signer: accounts[7],
                    address: await accounts[7].getAddress(),
                };
            default:
                return null;
        }
    };

    const getUserAddresses = async (): Promise<string[]> => {
        const accounts = await ethers.getSigners();
        return await Promise.all([
            accounts[4].getAddress(),
            accounts[5].getAddress(),
            accounts[6].getAddress(),
            accounts[7].getAddress(),
        ]);
    };

    describe("Run all the epochs", () => {
        // let dataBefore: Data

        // FOR EACH EPOCH:
        //  - check
        //   - all current user balances
        //   - all HISTORIC user balances for all epochs
        //   - total supply
        //  - act
        //  - check
        //   - all current user balances
        //   - all HISTORIC user balances for all epochs
        //   - total supply
        for (const epochData of getGroupedData()) {
            describe(`Epoch ${epochData.epoch}`, () => {
                let startTime: BN;
                let epochId: number;
                before(async () => {
                    startTime = await getTimestamp();
                    epochId = Math.floor(epochData.epoch);
                });
                after(async () => {
                    await increaseTime(ONE_WEEK);
                });
                it("has correct epoch id", async () => {
                    const contractEpoch = await auraLocker.findEpochId(startTime);
                    expect(contractEpoch).eq(epochId);
                });
                // Just a sanity check to ensure that the balance lookups can just be mapped by index
                it("has balances in correct order", () => {
                    expect(epochData.balances[0].user).eq(UserName.alice);
                    expect(epochData.balances[1].user).eq(UserName.bob);
                    expect(epochData.balances[2].user).eq(UserName.carol);
                    expect(epochData.balances[3].user).eq(UserName.daniel);
                });

                const checkBalances = (wen: string) => {
                    describe(`checking balances ${wen}`, () => {
                        it("looks up current balances & totalSupply", async () => {
                            const userAddresses = await getUserAddresses();
                            const balances = await Promise.all(userAddresses.map(a => auraLocker.balanceOf(a)));
                            const votes = await Promise.all(userAddresses.map(a => auraLocker.getVotes(a)));
                            const supply = await auraLocker.totalSupply();

                            balances.map((b, i) => expect(b).eq(epochData.balances[i].balanceOf));
                            votes.map((b, i) => expect(b).eq(epochData.balances[i].votes));
                            expect(supply).eq(epochData.balances[0].totalSupply);
                        });
                        it(`looks up ALL historical total supply between epoch 0 and ${epochData.epoch}`, async () => {
                            const lookupData = getGroupedData().slice(0, epochId + 1);
                            const totalSupplies = await Promise.all(
                                lookupData.map((d, i) => auraLocker.totalSupplyAtEpoch(i)),
                            );

                            totalSupplies.map((t, i) => expect(t).eq(lookupData[i].balances[0].totalSupply));
                        });

                        const checkHistorical = async (user: UserName, id: number) => {
                            const lookupData = getGroupedData().slice(0, epochId + 1);
                            const userAddress = (await userToAccount(user)).address;
                            const votesAt = await Promise.all(
                                lookupData.map((d, i) =>
                                    auraLocker.getPastVotes(userAddress, startTime.sub(ONE_WEEK.mul(epochId - i))),
                                ),
                            );

                            votesAt.map((v, i) => expect(v).eq(lookupData[i].balances[id].votes));

                            const balancesAt = await Promise.all(
                                lookupData.map((d, i) => auraLocker.balanceAtEpochOf(i, userAddress)),
                            );

                            balancesAt.map((b, i) => expect(b).eq(lookupData[i].balances[id].balanceOf));
                        };
                        it("looks up ALL historical balances for alice", async () => {
                            await checkHistorical(UserName.alice, 0);
                        });
                        it("looks up ALL historical balances for bob", async () => {
                            await checkHistorical(UserName.bob, 1);
                        });
                        it("looks up ALL historical balances for carol", async () => {
                            await checkHistorical(UserName.carol, 2);
                        });
                        it("looks up ALL historical balances for daniel", async () => {
                            await checkHistorical(UserName.daniel, 3);
                        });
                    });
                };

                checkBalances("before");

                if (epochData.actions.length > 0) {
                    describe("performing actions", () => {
                        for (const actionData of epochData.actions) {
                            switch (actionData.action) {
                                case ActionName.lock:
                                    it(`locks up ${ethers.utils.formatEther(actionData.amount)} for ${
                                        actionData.user
                                    }`, async () => {
                                        const user = await userToAccount(actionData.user);
                                        await auraLocker.connect(user.signer).lock(user.address, actionData.amount);
                                    });
                                    break;
                                case ActionName.checkpointEpoch:
                                    it(`checkpoints epoch`, async () => {
                                        const user = await userToAccount(actionData.user);
                                        await auraLocker.connect(user.signer).checkpointEpoch();
                                    });
                                    break;
                                case ActionName.delegate1:
                                    it(`allows ${actionData.user} to delegate to alice`, async () => {
                                        const user = await userToAccount(actionData.user);
                                        await auraLocker.connect(user.signer).delegate(alice.address);
                                    });
                                    break;
                                case ActionName.delegate2:
                                    it(`allows ${actionData.user} to delegate to bob`, async () => {
                                        const user = await userToAccount(actionData.user);
                                        await auraLocker.connect(user.signer).delegate(bob.address);
                                    });
                                    break;
                                case ActionName.delegate3:
                                    it(`allows ${actionData.user} to delegate to carol`, async () => {
                                        const user = await userToAccount(actionData.user);
                                        await auraLocker.connect(user.signer).delegate(carol.address);
                                    });
                                    break;
                                case ActionName.processExpiredClaim:
                                    it(`allows ${actionData.user} to process their locks and withdraw their capital`, async () => {
                                        const user = await userToAccount(actionData.user);
                                        await auraLocker.connect(user.signer).processExpiredLocks(false);
                                    });
                                    break;
                                case ActionName.processExpiredRelock:
                                    it(`allows ${actionData.user} to process and relock outstanding locks`, async () => {
                                        const user = await userToAccount(actionData.user);
                                        await auraLocker.connect(user.signer).processExpiredLocks(true);
                                    });
                                    break;
                                default:
                                    break;
                            }
                        }
                    });

                    checkBalances("after");
                }
            });
        }
    });
});
