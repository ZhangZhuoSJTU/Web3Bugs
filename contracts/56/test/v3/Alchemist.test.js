const chai = require('chai');
const { solidity } = require('ethereum-waffle');
const { ethers } = require('hardhat');
const { parseEther } = require('ethers/lib/utils');
const { ZERO_ADDRESS } = require('../helpers/utils');

chai.use(solidity);

const { expect } = chai;

let AlchemistFactory;
let AlUSDFactory;
let ERC20MockFactory;
let VaultAdapterMockFactory;
let TransmuterFactory;
let YearnVaultAdapterFactory;
let YearnVaultMockFactory;
let YearnControllerMockFactory;

describe('Alchemist', () => {
    let signers;

    before(async () => {
        AlchemistFactory = await ethers.getContractFactory('Alchemist');
        TransmuterFactory = await ethers.getContractFactory('Transmuter');
        AlUSDFactory = await ethers.getContractFactory('AlToken');
        ERC20MockFactory = await ethers.getContractFactory('ERC20Mock');
        VaultAdapterMockFactory = await ethers.getContractFactory('VaultAdapterMock');
        YearnVaultAdapterFactory = await ethers.getContractFactory('YearnVaultAdapter');
        YearnVaultMockFactory = await ethers.getContractFactory('YearnVaultMock');
        YearnControllerMockFactory = await ethers.getContractFactory('YearnControllerMock');
    });

    beforeEach(async () => {
        signers = await ethers.getSigners();
    });

    describe('constructor', async () => {
        let deployer;
        let sentinel;
        let token;
        let alUsd;

        beforeEach(async () => {
            [deployer, sentinel, ...signers] = signers;

            token = await ERC20MockFactory.connect(deployer).deploy('Mock DAI', 'DAI', 18);

            alUsd = await AlUSDFactory.connect(deployer).deploy();
        });

        context('when governance is the zero address', () => {
            it('reverts', async () => {
                expect(
                    AlchemistFactory.connect(deployer).deploy(
                        token.address,
                        alUsd.address,
                        ZERO_ADDRESS,
                        await sentinel.getAddress()
                    )
                ).revertedWith('Alchemist: governance address cannot be 0x0.');
            });
        });
    });

    describe('update Alchemist addys and variables', () => {
        let deployer;
        let governance;
        let newGovernance;
        let rewards;
        let sentinel;
        let transmuter;
        let token;
        let alUsd;
        let alchemist;

        beforeEach(async () => {
            [
                deployer,
                governance,
                newGovernance,
                rewards,
                sentinel,
                transmuter,
                ...signers
            ] = signers;

            token = await ERC20MockFactory.connect(deployer).deploy('Mock DAI', 'DAI', 18);

            alUsd = await AlUSDFactory.connect(deployer).deploy();

            alchemist = await AlchemistFactory.connect(deployer).deploy(
                token.address,
                alUsd.address,
                await governance.getAddress(),
                await sentinel.getAddress()
            );
        });

        describe('set governance', () => {
            context('when caller is not current governance', () => {
                beforeEach(() => (alchemist = alchemist.connect(deployer)));

                it('reverts', async () => {
                    expect(
                        alchemist.setPendingGovernance(await newGovernance.getAddress())
                    ).revertedWith('Alchemist: only governance');
                });
            });

            context('when caller is current governance', () => {
                beforeEach(() => (alchemist = alchemist.connect(governance)));

                it('reverts when setting governance to zero address', async () => {
                    expect(alchemist.setPendingGovernance(ZERO_ADDRESS)).revertedWith(
                        'Alchemist: governance address cannot be 0x0.'
                    );
                });

                it('updates rewards', async () => {
                    await alchemist.setRewards(await rewards.getAddress());
                    expect(await alchemist.rewards()).equal(await rewards.getAddress());
                });
            });
        });

        describe('set transmuter', () => {
            context('when caller is not current governance', () => {
                it('reverts', async () => {
                    expect(
                        alchemist.setTransmuter(await transmuter.getAddress())
                    ).revertedWith('Alchemist: only governance');
                });
            });

            context('when caller is current governance', () => {
                beforeEach(() => (alchemist = alchemist.connect(governance)));

                it('reverts when setting transmuter to zero address', async () => {
                    expect(alchemist.setTransmuter(ZERO_ADDRESS)).revertedWith(
                        'Alchemist: transmuter address cannot be 0x0.'
                    );
                });

                it('updates transmuter', async () => {
                    await alchemist.setTransmuter(await transmuter.getAddress());
                    expect(await alchemist.transmuter()).equal(await transmuter.getAddress());
                });
            });
        });

        describe('set rewards', () => {
            context('when caller is not current governance', () => {
                beforeEach(() => (alchemist = alchemist.connect(deployer)));

                it('reverts', async () => {
                    expect(alchemist.setRewards(await rewards.getAddress())).revertedWith(
                        'Alchemist: only governance'
                    );
                });
            });

            context('when caller is current governance', () => {
                beforeEach(() => (alchemist = alchemist.connect(governance)));

                it('reverts when setting rewards to zero address', async () => {
                    expect(alchemist.setRewards(ZERO_ADDRESS)).revertedWith(
                        'Alchemist: rewards address cannot be 0x0.'
                    );
                });

                it('updates rewards', async () => {
                    await alchemist.setRewards(await rewards.getAddress());
                    expect(await alchemist.rewards()).equal(await rewards.getAddress());
                });
            });
        });

        describe('set peformance fee', () => {
            context('when caller is not current governance', () => {
                beforeEach(() => (alchemist = alchemist.connect(deployer)));

                it('reverts', async () => {
                    expect(alchemist.setHarvestFee(1)).revertedWith(
                        'Alchemist: only governance'
                    );
                });
            });

            context('when caller is current governance', () => {
                beforeEach(() => (alchemist = alchemist.connect(governance)));

                it('reverts when performance fee greater than maximum', async () => {
                    const MAXIMUM_VALUE = await alchemist.PERCENT_RESOLUTION();
                    expect(alchemist.setHarvestFee(MAXIMUM_VALUE.add(1))).revertedWith(
                        'Alchemist: harvest fee above maximum'
                    );
                });

                it('updates performance fee', async () => {
                    await alchemist.setHarvestFee(1);
                    expect(await alchemist.harvestFee()).equal(1);
                });
            });
        });

        describe('set collateralization limit', () => {
            context('when caller is not current governance', () => {
                beforeEach(() => (alchemist = alchemist.connect(deployer)));

                it('reverts', async () => {
                    const collateralizationLimit = await alchemist.MINIMUM_COLLATERALIZATION_LIMIT();
                    expect(
                        alchemist.setCollateralizationLimit(collateralizationLimit)
                    ).revertedWith('Alchemist: only governance');
                });
            });

            context('when caller is current governance', () => {
                beforeEach(() => (alchemist = alchemist.connect(governance)));

                it('reverts when performance fee less than minimum', async () => {
                    const MINIMUM_LIMIT = await alchemist.MINIMUM_COLLATERALIZATION_LIMIT();
                    expect(
                        alchemist.setCollateralizationLimit(MINIMUM_LIMIT.sub(1))
                    ).revertedWith('Alchemist: collateralization limit below minimum.');
                });

                it('reverts when performance fee greater than maximum', async () => {
                    const MAXIMUM_LIMIT = await alchemist.MAXIMUM_COLLATERALIZATION_LIMIT();
                    expect(
                        alchemist.setCollateralizationLimit(MAXIMUM_LIMIT.add(1))
                    ).revertedWith('Alchemist: collateralization limit above maximum');
                });

                it('updates collateralization limit', async () => {
                    const collateralizationLimit = await alchemist.MINIMUM_COLLATERALIZATION_LIMIT();
                    await alchemist.setCollateralizationLimit(collateralizationLimit);
                    // expect(await alchemist.collateralizationLimit()).containSubset([
                    //   collateralizationLimit,
                    // ]);
                });
            });
        });
    });

    describe('vault actions', () => {
        let deployer;
        let governance;
        let sentinel;
        let rewards;
        let transmuter;
        let minter;
        let user;
        let token;
        let alUsd;
        let alchemist;
        let adapter;
        let harvestFee = 1000;
        let pctReso = 10000;
        let transmuterContract;

        beforeEach(async () => {
            [
                deployer,
                governance,
                sentinel,
                rewards,
                transmuter,
                minter,
                user,
                ...signers
            ] = signers;

            token = await ERC20MockFactory.connect(deployer).deploy('Mock DAI', 'DAI', 18);

            alUsd = await AlUSDFactory.connect(deployer).deploy();

            alchemist = await AlchemistFactory.connect(deployer).deploy(
                token.address,
                alUsd.address,
                await governance.getAddress(),
                await sentinel.getAddress()
            );

            await alchemist.connect(governance).setTransmuter(await transmuter.getAddress());
            await alchemist.connect(governance).setRewards(await rewards.getAddress());
            await alchemist.connect(governance).setHarvestFee(harvestFee);
            transmuterContract = await TransmuterFactory.connect(deployer).deploy(
                alUsd.address,
                token.address,
                await governance.getAddress()
            );
            await alchemist.connect(governance).setTransmuter(transmuterContract.address);
            await transmuterContract.connect(governance).setWhitelist(alchemist.address, true);
            await token.mint(await minter.getAddress(), parseEther('10000'));
            await token.connect(minter).approve(alchemist.address, parseEther('10000'));
        });

        describe('migrate', () => {
            beforeEach(async () => {
                adapter = await VaultAdapterMockFactory.connect(deployer).deploy(
                    token.address
                );

                await alchemist.connect(governance).initialize(adapter.address);
            });

            context('when caller is not current governance', () => {
                beforeEach(() => (alchemist = alchemist.connect(deployer)));

                it('reverts', async () => {
                    expect(alchemist.migrate(adapter.address)).revertedWith(
                        'Alchemist: only governance'
                    );
                });
            });

            context('when caller is current governance', () => {
                beforeEach(() => (alchemist = alchemist.connect(governance)));

                context('when adapter is zero address', async () => {
                    it('reverts', async () => {
                        expect(alchemist.migrate(ZERO_ADDRESS)).revertedWith(
                            'Alchemist: active vault address cannot be 0x0.'
                        );
                    });
                });

                context('when adapter token mismatches', () => {
                    const tokenAddress = ethers.utils.getAddress(
                        '0xffffffffffffffffffffffffffffffffffffffff'
                    );

                    let invalidAdapter;

                    beforeEach(async () => {
                        invalidAdapter = await VaultAdapterMockFactory.connect(
                            deployer
                        ).deploy(tokenAddress);
                    });

                    it('reverts', async () => {
                        expect(alchemist.migrate(invalidAdapter.address)).revertedWith(
                            'Alchemist: token mismatch'
                        );
                    });
                });

                context('when conditions are met', () => {
                    beforeEach(async () => {
                        await alchemist.migrate(adapter.address);
                    });

                    it('increments the vault count', async () => {
                        expect(await alchemist.vaultCount()).equal(2);
                    });

                    it('sets the vaults adapter', async () => {
                        expect(await alchemist.getVaultAdapter(0)).equal(adapter.address);
                    });
                });
            });
        });

        describe('recall funds', () => {
            context('from the active vault', () => {
                let adapter;
                let controllerMock;
                let vaultMock;
                let depositAmt = parseEther('5000');
                let mintAmt = parseEther('1000');
                let recallAmt = parseEther('500');

                beforeEach(async () => {
                    controllerMock = await YearnControllerMockFactory.connect(
                        deployer
                    ).deploy();
                    vaultMock = await YearnVaultMockFactory.connect(deployer).deploy(
                        token.address,
                        controllerMock.address
                    );
                    adapter = await YearnVaultAdapterFactory.connect(deployer).deploy(
                        vaultMock.address,
                        alchemist.address
                    );
                    await token.mint(await deployer.getAddress(), parseEther('10000'));
                    await token.approve(vaultMock.address, parseEther('10000'));
                    await alchemist.connect(governance).initialize(adapter.address);
                    await alchemist.connect(minter).deposit(depositAmt);
                    await alchemist.flush();
                    // need at least one other deposit in the vault to not get underflow errors
                    await vaultMock.connect(deployer).deposit(parseEther('100'));
                });

                it('reverts when not an emergency, not governance, and user does not have permission to recall funds from active vault', async () => {
                    expect(alchemist.connect(minter).recall(0, 0)).revertedWith(
                        'Alchemist: not an emergency, not governance, and user does not have permission to recall funds from active vault'
                    );
                });

                it('governance can recall some of the funds', async () => {
                    let beforeBal = await token
                        .connect(governance)
                        .balanceOf(alchemist.address);
                    await alchemist.connect(governance).recall(0, recallAmt);
                    let afterBal = await token
                        .connect(governance)
                        .balanceOf(alchemist.address);
                    expect(beforeBal).equal(0);
                    expect(afterBal).equal(recallAmt);
                });

                it('governance can recall all of the funds', async () => {
                    await alchemist.connect(governance).recallAll(0);
                    expect(await token.connect(governance).balanceOf(alchemist.address)).equal(
                        depositAmt
                    );
                });

                describe('in an emergency', async () => {
                    it('anyone can recall funds', async () => {
                        await alchemist.connect(governance).setEmergencyExit(true);
                        await alchemist.connect(minter).recallAll(0);
                        expect(
                            await token.connect(governance).balanceOf(alchemist.address)
                        ).equal(depositAmt);
                    });

                    it('after some usage', async () => {
                        await alchemist.connect(minter).deposit(mintAmt);
                        await alchemist.connect(governance).flush();
                        await token.mint(adapter.address, parseEther('500'));
                        await alchemist.connect(governance).setEmergencyExit(true);
                        await alchemist.connect(minter).recallAll(0);
                        expect(
                            await token.connect(governance).balanceOf(alchemist.address)
                        ).equal(depositAmt.add(mintAmt));
                    });
                });
            });

            context('from an inactive vault', () => {
                let inactiveAdapter;
                let activeAdapter;
                let depositAmt = parseEther('5000');
                let recallAmt = parseEther('500');

                beforeEach(async () => {
                    inactiveAdapter = await VaultAdapterMockFactory.connect(deployer).deploy(
                        token.address
                    );
                    activeAdapter = await VaultAdapterMockFactory.connect(deployer).deploy(
                        token.address
                    );

                    await alchemist.connect(governance).initialize(inactiveAdapter.address);
                    await token.mint(await minter.getAddress(), depositAmt);
                    await token.connect(minter).approve(alchemist.address, depositAmt);
                    await alchemist.connect(minter).deposit(depositAmt);
                    await alchemist.connect(minter).flush();
                    await alchemist.connect(governance).migrate(activeAdapter.address);
                });

                it('anyone can recall some of the funds to the contract', async () => {
                    await alchemist.connect(minter).recall(0, recallAmt);
                    expect(await token.balanceOf(alchemist.address)).equal(recallAmt);
                });

                it('anyone can recall all of the funds to the contract', async () => {
                    await alchemist.connect(minter).recallAll(0);
                    expect(await token.balanceOf(alchemist.address)).equal(depositAmt);
                });

                describe('in an emergency', async () => {
                    it('anyone can recall funds', async () => {
                        await alchemist.connect(governance).setEmergencyExit(true);
                        await alchemist.connect(minter).recallAll(0);
                        expect(
                            await token.connect(governance).balanceOf(alchemist.address)
                        ).equal(depositAmt);
                    });
                });
            });
        });

        describe('flush funds', () => {
            context('when the Alchemist is not initialized', () => {
                it('reverts', async () => {
                    expect(alchemist.flush()).revertedWith('Alchemist: not initialized.');
                });
            });

            context('when there is at least one vault to flush to', () => {
                context('when there is one vault', () => {
                    let adapter;
                    let mintAmount = parseEther('5000');

                    beforeEach(async () => {
                        adapter = await VaultAdapterMockFactory.connect(deployer).deploy(
                            token.address
                        );
                    });

                    beforeEach(async () => {
                        await token.mint(alchemist.address, mintAmount);

                        await alchemist.connect(governance).initialize(adapter.address);

                        await alchemist.flush();
                    });

                    it('flushes funds to the vault', async () => {
                        expect(await token.balanceOf(adapter.address)).equal(mintAmount);
                    });
                });

                context('when there are multiple vaults', () => {
                    let inactiveAdapter;
                    let activeAdapter;
                    let mintAmount = parseEther('5000');

                    beforeEach(async () => {
                        inactiveAdapter = await VaultAdapterMockFactory.connect(
                            deployer
                        ).deploy(token.address);

                        activeAdapter = await VaultAdapterMockFactory.connect(deployer).deploy(
                            token.address
                        );

                        await token.mint(alchemist.address, mintAmount);

                        await alchemist
                            .connect(governance)
                            .initialize(inactiveAdapter.address);

                        await alchemist.connect(governance).migrate(activeAdapter.address);

                        await alchemist.flush();
                    });

                    it('flushes funds to the active vault', async () => {
                        expect(await token.balanceOf(activeAdapter.address)).equal(mintAmount);
                    });
                });
            });
        });

        describe('deposit and withdraw tokens', () => {
            let depositAmt = parseEther('5000');
            let mintAmt = parseEther('1000');
            let ceilingAmt = parseEther('10000');
            let collateralizationLimit = '2000000000000000000'; // this should be set in the deploy sequence
            beforeEach(async () => {
                adapter = await VaultAdapterMockFactory.connect(deployer).deploy(
                    token.address
                );
                await alchemist.connect(governance).initialize(adapter.address);
                await alchemist
                    .connect(governance)
                    .setCollateralizationLimit(collateralizationLimit);
                await alUsd.connect(deployer).setWhitelist(alchemist.address, true);
                await alUsd.connect(deployer).setCeiling(alchemist.address, ceilingAmt);
                await token.mint(await minter.getAddress(), depositAmt);
                await token
                    .connect(minter)
                    .approve(alchemist.address, parseEther('100000000'));
                await alUsd
                    .connect(minter)
                    .approve(alchemist.address, parseEther('100000000'));
            });

            it('deposited amount is accounted for correctly', async () => {
                // let address = await deployer.getAddress();
                await alchemist.connect(minter).deposit(depositAmt);
                expect(
                    await alchemist
                        .connect(minter)
                        .getCdpTotalDeposited(await minter.getAddress())
                ).equal(depositAmt);
            });

            it('deposits token and then withdraws all', async () => {
                let balBefore = await token.balanceOf(await minter.getAddress());
                await alchemist.connect(minter).deposit(depositAmt);
                await alchemist.connect(minter).withdraw(depositAmt);
                let balAfter = await token.balanceOf(await minter.getAddress());
                expect(balBefore).equal(balAfter);
            });

            it('reverts when withdrawing too much', async () => {
                let overdraft = depositAmt.add(parseEther('1000'));
                await alchemist.connect(minter).deposit(depositAmt);
                expect(alchemist.connect(minter).withdraw(overdraft)).revertedWith(
                    'ERC20: transfer amount exceeds balance'
                );
            });

            it('reverts when cdp is undercollateralized', async () => {
                await alchemist.connect(minter).deposit(depositAmt);
                await alchemist.connect(minter).mint(mintAmt);
                expect(alchemist.connect(minter).withdraw(depositAmt)).revertedWith(
                    'Action blocked: unhealthy collateralization ratio'
                );
            });

            it('deposits, mints, repays, and withdraws', async () => {
                let balBefore = await token.balanceOf(await minter.getAddress());
                await alchemist.connect(minter).deposit(depositAmt);
                await alchemist.connect(minter).mint(mintAmt);
                await alchemist.connect(minter).repay(0, mintAmt);
                await alchemist.connect(minter).withdraw(depositAmt);
                let balAfter = await token.balanceOf(await minter.getAddress());
                expect(balBefore).equal(balAfter);
            });

            it('deposits 5000 DAI, mints 1000 alUSD, and withdraws 3000 DAI', async () => {
                let withdrawAmt = depositAmt.sub(mintAmt.mul(2));
                await alchemist.connect(minter).deposit(depositAmt);
                await alchemist.connect(minter).mint(mintAmt);
                await alchemist.connect(minter).withdraw(withdrawAmt);
                expect(await token.balanceOf(await minter.getAddress())).equal(
                    parseEther('13000')
                );
            });

            describe('flushActivator', async () => {
                beforeEach(async () => {
                    await token.connect(deployer).approve(alchemist.address, parseEther('1'));
                    await token.mint(await deployer.getAddress(), parseEther('1'));
                    await token.mint(await minter.getAddress(), parseEther('100000'));
                    await alchemist.connect(deployer).deposit(parseEther('1'));
                });

                it('deposit() flushes funds if amount >= flushActivator', async () => {
                    let balBeforeWhale = await token.balanceOf(adapter.address);
                    await alchemist.connect(minter).deposit(parseEther('100000'));
                    let balAfterWhale = await token.balanceOf(adapter.address);
                    expect(balBeforeWhale).equal(0);
                    expect(balAfterWhale).equal(parseEther('100001'));
                });

                it('deposit() does not flush funds if amount < flushActivator', async () => {
                    let balBeforeWhale = await token.balanceOf(adapter.address);
                    await alchemist.connect(minter).deposit(parseEther('99999'));
                    let balAfterWhale = await token.balanceOf(adapter.address);
                    expect(balBeforeWhale).equal(0);
                    expect(balAfterWhale).equal(0);
                });

                it('withdraw() flushes funds if amount >= flushActivator', async () => {
                    await alchemist.connect(minter).deposit(parseEther('50000'));
                    await alchemist.connect(minter).deposit(parseEther('50000'));
                    let balBeforeWhaleWithdraw = await token.balanceOf(adapter.address);
                    await alchemist.connect(minter).withdraw(parseEther('100000'));
                    let balAfterWhaleWithdraw = await token.balanceOf(adapter.address);
                    expect(balBeforeWhaleWithdraw).equal(0);
                    expect(balAfterWhaleWithdraw).equal(parseEther('1'));
                });

                it('withdraw() does not flush funds if amount < flushActivator', async () => {
                    await alchemist.connect(minter).deposit(parseEther('50000'));
                    await alchemist.connect(minter).deposit(parseEther('50000'));
                    let balBeforeWhaleWithdraw = await token.balanceOf(adapter.address);
                    await alchemist.connect(minter).withdraw(parseEther('99999'));
                    let balAfterWhaleWithdraw = await token.balanceOf(adapter.address);
                    expect(balBeforeWhaleWithdraw).equal(0);
                    expect(balAfterWhaleWithdraw).equal(0);
                });
            });
        });

        describe('repay and liquidate tokens', () => {
            let depositAmt = parseEther('5000');
            let mintAmt = parseEther('1000');
            let ceilingAmt = parseEther('10000');
            let collateralizationLimit = '2000000000000000000'; // this should be set in the deploy sequence
            beforeEach(async () => {
                adapter = await VaultAdapterMockFactory.connect(deployer).deploy(
                    token.address
                );
                await alchemist.connect(governance).initialize(adapter.address);
                await alchemist
                    .connect(governance)
                    .setCollateralizationLimit(collateralizationLimit);
                await alUsd.connect(deployer).setWhitelist(alchemist.address, true);
                await alUsd.connect(deployer).setCeiling(alchemist.address, ceilingAmt);
                await token.mint(await minter.getAddress(), ceilingAmt);
                await token.connect(minter).approve(alchemist.address, ceilingAmt);
                await alUsd
                    .connect(minter)
                    .approve(alchemist.address, parseEther('100000000'));
                await token.connect(minter).approve(transmuterContract.address, ceilingAmt);
                await alUsd.connect(minter).approve(transmuterContract.address, depositAmt);
            });
            it('repay with dai reverts when nothing is minted and transmuter has no alUsd deposits', async () => {
                await alchemist.connect(minter).deposit(depositAmt.sub(parseEther('1000')));
                expect(alchemist.connect(minter).repay(mintAmt, 0)).revertedWith(
                    'SafeMath: subtraction overflow'
                );
            });
            it('liquidate max amount possible if trying to liquidate too much', async () => {
                let liqAmt = depositAmt;
                await alchemist.connect(minter).deposit(depositAmt);
                await alchemist.connect(minter).mint(mintAmt);
                await transmuterContract.connect(minter).stake(mintAmt);
                await alchemist.connect(minter).liquidate(liqAmt);
                const transBal = await token.balanceOf(transmuterContract.address);
                expect(transBal).equal(mintAmt);
            });
            it('liquidates funds from vault if not enough in the buffer', async () => {
                let liqAmt = parseEther('600');
                await alchemist.connect(minter).deposit(depositAmt);
                await alchemist.connect(governance).flush();
                await alchemist.connect(minter).deposit(mintAmt.div(2));
                await alchemist.connect(minter).mint(mintAmt);
                await transmuterContract.connect(minter).stake(mintAmt);
                await alchemist.connect(minter).liquidate(liqAmt);
                const alchemistTokenBalPost = await token.balanceOf(alchemist.address);
                const transmuterEndingTokenBal = await token.balanceOf(
                    transmuterContract.address
                );
                expect(alchemistTokenBalPost).equal(0);
                expect(transmuterEndingTokenBal).equal(liqAmt);
            });
            it('liquidates the minimum necessary from the alchemist buffer', async () => {
                let dep2Amt = parseEther('500');
                let liqAmt = parseEther('200');
                await alchemist.connect(minter).deposit(parseEther('2000'));
                await alchemist.connect(governance).flush();
                await alchemist.connect(minter).deposit(dep2Amt);
                await alchemist.connect(minter).mint(parseEther('1000'));
                await transmuterContract.connect(minter).stake(parseEther('1000'));
                await alchemist.connect(minter).liquidate(liqAmt);
                const alchemistTokenBalPost = await token.balanceOf(alchemist.address);

                const transmuterEndingTokenBal = await token.balanceOf(
                    transmuterContract.address
                );
                expect(alchemistTokenBalPost).equal(dep2Amt.sub(liqAmt));
                expect(transmuterEndingTokenBal).equal(liqAmt);
            });
            it('deposits, mints alUsd, repays, and has no outstanding debt', async () => {
                await alchemist.connect(minter).deposit(depositAmt.sub(parseEther('1000')));
                await alchemist.connect(minter).mint(mintAmt);
                await transmuterContract.connect(minter).stake(mintAmt);
                await alchemist.connect(minter).repay(mintAmt, 0);
                expect(
                    await alchemist.connect(minter).getCdpTotalDebt(await minter.getAddress())
                ).equal(0);
            });
            it('deposits, mints, repays, and has no outstanding debt', async () => {
                await alchemist.connect(minter).deposit(depositAmt);
                await alchemist.connect(minter).mint(mintAmt);
                await alchemist.connect(minter).repay(0, mintAmt);
                expect(
                    await alchemist.connect(minter).getCdpTotalDebt(await minter.getAddress())
                ).equal(0);
            });
            it('deposits, mints alUsd, repays with alUsd and DAI, and has no outstanding debt', async () => {
                await alchemist.connect(minter).deposit(depositAmt.sub(parseEther('1000')));
                await alchemist.connect(minter).mint(mintAmt);
                await transmuterContract.connect(minter).stake(parseEther('500'));
                await alchemist.connect(minter).repay(parseEther('500'), parseEther('500'));
                expect(
                    await alchemist.connect(minter).getCdpTotalDebt(await minter.getAddress())
                ).equal(0);
            });

            it('deposits and liquidates DAI', async () => {
                await alchemist.connect(minter).deposit(depositAmt);
                await alchemist.connect(minter).mint(mintAmt);
                await transmuterContract.connect(minter).stake(mintAmt);
                await alchemist.connect(minter).liquidate(mintAmt);
                expect(
                    await alchemist
                        .connect(minter)
                        .getCdpTotalDeposited(await minter.getAddress())
                ).equal(depositAmt.sub(mintAmt));
            });
        });

        // describe('mint', () => {
        //     let depositAmt = parseEther('5000');
        //     let mintAmt = parseEther('1000');
        //     let ceilingAmt = parseEther('1000');

        //     beforeEach(async () => {
        //         adapter = await VaultAdapterMockFactory.connect(deployer).deploy(
        //             token.address
        //         );

        //         await alchemist.connect(governance).initialize(adapter.address);

        //         await alUsd.connect(deployer).setCeiling(alchemist.address, ceilingAmt);
        //         await token.mint(await minter.getAddress(), depositAmt);
        //         await token.connect(minter).approve(alchemist.address, depositAmt);
        //         await alUsd.connect(deployer).setWhitelist(alchemist.address, true);
        //     });

        //     // it('reverts if the Alchemist is not whitelisted', async () => {
        //     //     await alchemist.connect(minter).deposit(depositAmt);
        //     //     expect(alchemist.connect(minter).mint(mintAmt)).revertedWith(
        //     //         'AlUSD is not whitelisted'
        //     //     );
        //     // });

        //     context('is whiltelisted', () => {
        //         // beforeEach(async () => {
        //         //     await alUsd.connect(deployer).setWhitelist(alchemist.address, true);
        //         // });

        //         it('reverts if the Alchemist is blacklisted', async () => {
        //             // await alUsd.connect(deployer).setWhitelist(alchemist.address, true);
        //             await alUsd.connect(deployer).setBlacklist(alchemist.address);
        //             await alchemist.connect(minter).deposit(depositAmt);
        //             expect(alchemist.connect(minter).mint(mintAmt)).revertedWith(
        //                 'AlUSD is blacklisted'
        //             );
        //         });

        //         it('reverts when trying to mint too much', async () => {
        //             expect(alchemist.connect(minter).mint(parseEther('2000'))).revertedWith(
        //                 'Loan-to-value ratio breached'
        //             );
        //         });

        //         it('reverts if the ceiling was breached', async () => {
        //             let lowCeilingAmt = parseEther('100');
        //             await alUsd.connect(deployer).setCeiling(alchemist.address, lowCeilingAmt);
        //             await alchemist.connect(minter).deposit(depositAmt);
        //             expect(alchemist.connect(minter).mint(mintAmt)).revertedWith(
        //                 "AlUSD's ceiling was breached"
        //             );
        //         });

        //         it('mints successfully to depositor', async () => {
        //             let balBefore = await token.balanceOf(await minter.getAddress());
        //             await alchemist.connect(minter).deposit(depositAmt);
        //             await alchemist.connect(minter).mint(mintAmt);
        //             let balAfter = await token.balanceOf(await minter.getAddress());

        //             expect(balAfter).equal(balBefore.sub(depositAmt));
        //             expect(await alUsd.balanceOf(await minter.getAddress())).equal(mintAmt);
        //         });

        //         describe('flushActivator', async () => {
        //             beforeEach(async () => {
        //                 await alUsd
        //                     .connect(deployer)
        //                     .setCeiling(alchemist.address, parseEther('200000'));
        //                 await token.mint(await minter.getAddress(), parseEther('200000'));
        //                 await token
        //                     .connect(minter)
        //                     .approve(alchemist.address, parseEther('200000'));
        //             });

        //             it('mint() flushes funds if amount >= flushActivator', async () => {
        //                 await alchemist.connect(minter).deposit(parseEther('50000'));
        //                 await alchemist.connect(minter).deposit(parseEther('50000'));
        //                 await alchemist.connect(minter).deposit(parseEther('50000'));
        //                 await alchemist.connect(minter).deposit(parseEther('50000'));
        //                 let balBeforeWhale = await token.balanceOf(adapter.address);
        //                 await alchemist.connect(minter).mint(parseEther('100000'));
        //                 let balAfterWhale = await token.balanceOf(adapter.address);
        //                 expect(balBeforeWhale).equal(0);
        //                 expect(balAfterWhale).equal(parseEther('200000'));
        //             });

        //             it('mint() does not flush funds if amount < flushActivator', async () => {
        //                 await alchemist.connect(minter).deposit(parseEther('50000'));
        //                 await alchemist.connect(minter).deposit(parseEther('50000'));
        //                 await alchemist.connect(minter).deposit(parseEther('50000'));
        //                 await alchemist.connect(minter).deposit(parseEther('50000'));
        //                 let balBeforeWhale = await token.balanceOf(adapter.address);
        //                 await alchemist.connect(minter).mint(parseEther('99999'));
        //                 let balAfterWhale = await token.balanceOf(adapter.address);
        //                 expect(balBeforeWhale).equal(0);
        //                 expect(balAfterWhale).equal(0);
        //             });
        //         });
        //     });
        // });

        describe('harvest', () => {
            let depositAmt = parseEther('5000');
            let mintAmt = parseEther('1000');
            let stakeAmt = mintAmt.div(2);
            let ceilingAmt = parseEther('10000');
            let yieldAmt = parseEther('100');

            beforeEach(async () => {
                adapter = await VaultAdapterMockFactory.connect(deployer).deploy(
                    token.address
                );

                await alUsd.connect(deployer).setWhitelist(alchemist.address, true);
                await alchemist.connect(governance).initialize(adapter.address);
                await alUsd.connect(deployer).setCeiling(alchemist.address, ceilingAmt);
                await token.mint(await user.getAddress(), depositAmt);
                await token.connect(user).approve(alchemist.address, depositAmt);
                await alUsd.connect(user).approve(transmuterContract.address, depositAmt);
                await alchemist.connect(user).deposit(depositAmt);
                await alchemist.connect(user).mint(mintAmt);
                await transmuterContract.connect(user).stake(stakeAmt);
                await alchemist.flush();
            });

            it('harvests yield from the vault', async () => {
                await token.mint(adapter.address, yieldAmt);
                await alchemist.harvest(0);
                let transmuterBal = await token.balanceOf(transmuterContract.address);
                expect(transmuterBal).equal(yieldAmt.sub(yieldAmt.div(pctReso / harvestFee)));
                let vaultBal = await token.balanceOf(adapter.address);
                expect(vaultBal).equal(depositAmt);
            });

            it('sends the harvest fee to the rewards address', async () => {
                await token.mint(adapter.address, yieldAmt);
                await alchemist.harvest(0);
                let rewardsBal = await token.balanceOf(await rewards.getAddress());
                expect(rewardsBal).equal(yieldAmt.mul(100).div(harvestFee));
            });

            it('does not update any balances if there is nothing to harvest', async () => {
                let initTransBal = await token.balanceOf(transmuterContract.address);
                let initRewardsBal = await token.balanceOf(await rewards.getAddress());
                await alchemist.harvest(0);
                let endTransBal = await token.balanceOf(transmuterContract.address);
                let endRewardsBal = await token.balanceOf(await rewards.getAddress());
                expect(initTransBal).equal(endTransBal);
                expect(initRewardsBal).equal(endRewardsBal);
            });
        });
    });
});
