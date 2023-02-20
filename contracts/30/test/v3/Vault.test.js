const chai = require('chai');
const { expect } = chai;
const { solidity } = require('ethereum-waffle');
chai.use(solidity);
const hardhat = require('hardhat');
const { deployments, ethers } = hardhat;
const { parseEther } = ethers.utils;
const ether = parseEther;

describe('Vault', () => {
    let deployer, treasury, user;
    let dai, t3crv, usdc, usdt, vault, manager, controller, harvester, strategyCrv, converter;

    beforeEach(async () => {
        await deployments.fixture('test');
        [deployer, treasury, , user] = await ethers.getSigners();
        const DAI = await deployments.get('DAI');
        dai = await ethers.getContractAt('MockERC20', DAI.address);
        const USDC = await deployments.get('USDC');
        usdc = await ethers.getContractAt('MockERC20', USDC.address);
        const USDT = await deployments.get('USDT');
        usdt = await ethers.getContractAt('MockERC20', USDT.address);
        const T3CRV = await deployments.get('T3CRV');
        t3crv = await ethers.getContractAt('MockERC20', T3CRV.address);
        const Manager = await deployments.get('Manager');
        manager = await ethers.getContractAt('Manager', Manager.address);
        const Harvester = await deployments.get('Harvester');
        harvester = await ethers.getContractAt('Harvester', Harvester.address);
        const Controller = await deployments.get('Controller');
        controller = await ethers.getContractAt('Controller', Controller.address);
        const StrategyCrv = await deployments.get('NativeStrategyCurve3Crv');
        strategyCrv = await ethers.getContractAt(
            'NativeStrategyCurve3Crv',
            StrategyCrv.address,
            deployer
        );
        converter = await deployments.get('StablesConverter');
        const Vault = await deployments.get('VaultStables');
        vault = await ethers.getContractAt('Vault', Vault.address);

        await manager.setAllowedVault(vault.address, true);
        await manager.setGovernance(treasury.address);
        await dai.connect(user).faucet(ether('100000001'));
        await usdc.connect(user).faucet('100000000000000');
        await usdt.connect(user).faucet('100000000000000');
        await dai.connect(user).approve(Vault.address, ethers.constants.MaxUint256);
        await usdc.connect(user).approve(Vault.address, ethers.constants.MaxUint256);
        await usdt.connect(user).approve(Vault.address, ethers.constants.MaxUint256);
        await t3crv.connect(user).approve(Vault.address, ethers.constants.MaxUint256);
    });

    it('should deploy with expected state', async () => {
        expect(await vault.name()).to.equal('Vault: Stables');
        expect(await vault.symbol()).to.equal('MV:S');
        expect(await vault.manager()).to.equal(manager.address);
        expect(await vault.min()).to.equal(9500);
        expect(await vault.totalDepositCap()).to.equal(ether('10000000'));
        expect(await vault.withdrawFee(ether('1'))).to.equal(ether('0.001'));
    });

    describe('setMin', () => {
        it('should revert when called by an address other than strategist', async () => {
            expect(await vault.min()).to.equal(9500);
            await expect(vault.connect(user).setMin(9000)).to.be.revertedWith('!strategist');
            expect(await vault.min()).to.equal(9500);
        });

        it('should revert when halted', async () => {
            await manager.setHalted();
            await expect(vault.connect(user).setMin(9000)).to.be.revertedWith('halted');
        });

        it('should set the min when called by the strategist', async () => {
            expect(await vault.min()).to.equal(9500);
            await vault.connect(deployer).setMin(9000);
            expect(await vault.min()).to.equal(9000);
        });

        it('should revert if _min is greater than MAX', async () => {
            const max = 10000;
            await expect(vault.connect(deployer).setMin(max + 1)).to.revertedWith('!_min');
        });
    });

    describe('setTotalDepositCap', () => {
        it('should revert when called by an address other than strategist', async () => {
            expect(await vault.totalDepositCap()).to.equal(ether('10000000'));
            await expect(vault.connect(user).setTotalDepositCap(0)).to.be.revertedWith(
                '!strategist'
            );
            expect(await vault.totalDepositCap()).to.equal(ether('10000000'));
        });

        it('should revert when halted', async () => {
            await manager.setHalted();
            await expect(vault.connect(deployer).setTotalDepositCap(0)).to.be.revertedWith(
                'halted'
            );
        });

        it('should set the total deposit cap when called by the strategist', async () => {
            expect(await vault.totalDepositCap()).to.equal(ether('10000000'));
            await vault.connect(deployer).setTotalDepositCap(0);
            expect(await vault.totalDepositCap()).to.equal(0);
        });
    });

    describe('earn', () => {
        beforeEach(async () => {
            await manager.connect(treasury).setAllowedController(controller.address, true);
            await manager.connect(treasury).setAllowedConverter(converter.address, true);
            await controller.connect(deployer).setConverter(vault.address, converter.address);
            await manager.connect(treasury).setAllowedStrategy(strategyCrv.address, true);
            await manager.connect(treasury).setAllowedToken(dai.address, true);
            await expect(manager.addToken(vault.address, dai.address))
                .to.emit(manager, 'TokenAdded')
                .withArgs(vault.address, dai.address);
            await manager.setController(vault.address, controller.address);
            await manager.connect(treasury).setHarvester(harvester.address);
            await harvester.connect(deployer).setHarvester(deployer.address, true);
            await controller.addStrategy(vault.address, strategyCrv.address, 0, 86400);
            await dai.connect(user).faucet(1000);
            await dai.connect(user).transfer(vault.address, 1000);
        });

        it('should revert when called by an address other than the harvester', async () => {
            await expect(
                vault.connect(user).earn(dai.address, ethers.constants.AddressZero)
            ).to.be.revertedWith('!harvester');
        });

        it('should revert when the token is not added', async () => {
            await expect(
                harvester
                    .connect(deployer)
                    .earn(
                        ethers.constants.AddressZero,
                        vault.address,
                        ethers.constants.AddressZero
                    )
            ).to.be.revertedWith('!_token');
        });

        it('should revert when halted', async () => {
            await manager.setHalted();
            await expect(
                harvester
                    .connect(deployer)
                    .earn(ethers.constants.AddressZero, vault.address, dai.address)
            ).to.be.revertedWith('halted');
        });

        it('should revert if strategy isnt allowed', async () => {
            await expect(
                harvester
                    .connect(deployer)
                    .earn(ethers.constants.AddressZero, vault.address, dai.address)
            ).to.be.revertedWith('!_strategy');
        });

        it('should earn when strategy is added', async () => {
            expect(await dai.balanceOf(vault.address)).to.equal(1000);
            await expect(
                harvester
                    .connect(deployer)
                    .earn(strategyCrv.address, vault.address, dai.address)
            )
                .to.emit(vault, 'Earn')
                .withArgs(dai.address, 950);
            expect(await dai.balanceOf(vault.address)).to.equal(50);
        });

        it('should do nothing if invest is disabled', async () => {
            expect(await dai.balanceOf(vault.address)).to.equal(1000);
            await controller.setInvestEnabled(false);
            await expect(
                harvester
                    .connect(deployer)
                    .earn(strategyCrv.address, vault.address, dai.address)
            ).to.not.emit(vault, 'Earn');
            expect(await dai.balanceOf(vault.address)).to.equal(1000);
        });
    });

    describe('deposit', () => {
        it('should revert when the vault is not set up', async () => {
            const NewVault = await deployments.deploy('Vault', {
                from: deployer.address,
                args: ['Vault: Stables', 'MV:S2', manager.address]
            });
            const newVault = await ethers.getContractAt('Vault', NewVault.address);
            await dai.connect(user).approve(NewVault.address, ethers.utils.parseEther('1000'));
            await expect(newVault.connect(user).deposit(dai.address, 1)).to.be.revertedWith(
                '!_token'
            );
        });

        context('when the vault is set up', () => {
            beforeEach(async () => {
                await manager.connect(treasury).setAllowedToken(dai.address, true);
                await manager.connect(treasury).setAllowedToken(usdc.address, true);
                await manager.connect(treasury).setAllowedVault(vault.address, true);
                await manager.connect(treasury).setAllowedController(controller.address, true);
                await manager.setController(vault.address, controller.address);
                await expect(manager.addToken(vault.address, dai.address))
                    .to.emit(manager, 'TokenAdded')
                    .withArgs(vault.address, dai.address);
                await expect(manager.addToken(vault.address, usdc.address))
                    .to.emit(manager, 'TokenAdded')
                    .withArgs(vault.address, usdc.address);
                expect((await vault.getTokens()).length).to.equal(2);
                expect(await manager.tokens(vault.address, 0)).to.equal(dai.address);
                expect(await manager.tokens(vault.address, 1)).to.equal(usdc.address);
            });

            it('should revert when a token is not added', async () => {
                await expect(
                    vault.connect(user).depositMultiple([dai.address, usdt.address], [1, 1])
                ).to.be.revertedWith('!_token');
            });

            it('should revert when halted', async () => {
                await manager.setHalted();
                await expect(
                    vault.connect(user).deposit(dai.address, ether('1000'))
                ).to.be.revertedWith('halted');
            });

            it('should revert if deposit amount is 0', async () => {
                await expect(vault.connect(user).deposit(dai.address, 0)).to.be.revertedWith(
                    '!_amount'
                );
            });

            it('should revert if the deposit amount is greater than the total deposit cap', async () => {
                await expect(vault.connect(user).deposit(dai.address, ether('10000001'))).to.be
                    .reverted;
            });

            it('should revert if the input lengths do not match', async () => {
                await expect(
                    vault.connect(user).depositMultiple([dai.address], [ether('1000'), 1])
                ).to.be.revertedWith('!length');
            });

            it('should deposit single token', async () => {
                expect(await vault.balanceOf(user.address)).to.equal(0);
                await expect(vault.connect(user).deposit(dai.address, ether('1000')))
                    .to.emit(vault, 'Deposit')
                    .withArgs(user.address, ether('1000'));
                expect(await vault.balanceOf(user.address)).to.equal(ether('1000'));
                expect(await vault.totalSupply()).to.equal(ether('1000'));
            });

            it('should deposit multiple tokens', async () => {
                expect(await vault.balanceOf(user.address)).to.equal(0);
                await expect(
                    vault
                        .connect(user)
                        .depositMultiple(
                            [dai.address, usdc.address],
                            [ether('1000'), '1000000000']
                        )
                )
                    // Deposit is actually emitted multiple times
                    .to.emit(vault, 'Deposit');
                expect(await vault.balanceOf(user.address)).to.equal(ether('2000'));
                expect(await vault.totalSupply()).to.equal(ether('2000'));
            });

            context('when depositing multiple tokens multiple times', () => {
                beforeEach(async () => {
                    expect(await vault.balanceOf(user.address)).to.equal(0);
                    await expect(
                        vault
                            .connect(user)
                            .depositMultiple(
                                [dai.address, usdc.address],
                                [ether('1000'), '1000000000']
                            )
                    ).to.emit(vault, 'Deposit');
                    expect(await vault.balanceOf(user.address)).to.equal(ether('2000'));
                    expect(await vault.totalSupply()).to.equal(ether('2000'));
                });

                it('should grant additional shares', async () => {
                    await expect(
                        vault
                            .connect(user)
                            .depositMultiple(
                                [dai.address, usdc.address],
                                [ether('1000'), '1000000000']
                            )
                    ).to.emit(vault, 'Deposit');
                    expect(await vault.balanceOf(user.address)).to.equal(ether('4000'));
                    expect(await vault.totalSupply()).to.equal(ether('4000'));
                });
            });
        });
    });

    describe('withdraw', () => {
        beforeEach(async () => {
            await manager.connect(treasury).setAllowedToken(dai.address, true);
            await manager.connect(treasury).setAllowedVault(vault.address, true);
            await manager.connect(treasury).setAllowedController(controller.address, true);
            await manager.connect(deployer).setController(vault.address, controller.address);
            await expect(manager.connect(deployer).addToken(vault.address, dai.address))
                .to.emit(manager, 'TokenAdded')
                .withArgs(vault.address, dai.address);
            expect((await vault.getTokens()).length).to.equal(1);
        });

        it('should revert if the output token is not added', async () => {
            await expect(vault.withdraw(0, usdc.address)).to.be.revertedWith('!_token');
        });

        it('should revert if there are no deposits', async () => {
            await expect(vault.withdraw(1, dai.address)).to.be.revertedWith(
                'SafeMath: division by zero'
            );
        });

        context('when users have deposited', () => {
            beforeEach(async () => {
                await expect(vault.connect(user).deposit(dai.address, ether('1000')))
                    .to.emit(vault, 'Deposit')
                    .withArgs(user.address, ether('1000'));
            });

            it('should revert if withdrawing more than the balance', async () => {
                await expect(
                    vault.connect(user).withdraw(ether('1001'), dai.address)
                ).to.be.revertedWith('ERC20: burn amount exceeds balance');
            });

            it('should withdraw partial amounts', async () => {
                await expect(vault.connect(user).withdraw(ether('100'), dai.address))
                    .to.emit(vault, 'Withdraw')
                    .withArgs(user.address, ether('99.9'));
            });

            it('should withdraw the full amount', async () => {
                await expect(vault.connect(user).withdraw(ether('1000'), dai.address))
                    .to.emit(vault, 'Withdraw')
                    .withArgs(user.address, ether('999'));
            });

            it('should withdraw the full amount even if tokens are sent directly', async () => {
                await dai.connect(user).faucet(ether('1'));
                await dai.connect(user).transfer(vault.address, ether('1'));
                await expect(vault.connect(user).withdraw(ether('1000'), dai.address))
                    .to.emit(vault, 'Withdraw')
                    .withArgs(user.address, ether('999.999'));
            });
        });
    });

    describe('withdrawAll', () => {
        beforeEach(async () => {
            await manager.connect(treasury).setAllowedToken(dai.address, true);
            await manager.connect(treasury).setAllowedVault(vault.address, true);
            await manager.connect(treasury).setAllowedController(controller.address, true);
            await manager.connect(deployer).setController(vault.address, controller.address);
            await expect(manager.connect(deployer).addToken(vault.address, dai.address))
                .to.emit(manager, 'TokenAdded')
                .withArgs(vault.address, dai.address);
            expect((await vault.getTokens()).length).to.equal(1);
        });

        it('should revert if the output token is not added', async () => {
            await expect(vault.connect(user).withdrawAll(usdc.address)).to.be.revertedWith(
                '!_token'
            );
        });

        it('should revert if there are no deposits', async () => {
            await expect(vault.connect(user).withdrawAll(dai.address)).to.be.revertedWith(
                'SafeMath: division by zero'
            );
        });

        context('when users have deposited', () => {
            beforeEach(async () => {
                await expect(vault.connect(user).deposit(dai.address, ether('1000')))
                    .to.emit(vault, 'Deposit')
                    .withArgs(user.address, ether('1000'));
            });

            it('should withdraw the full amount', async () => {
                await expect(vault.connect(user).withdrawAll(dai.address))
                    .to.emit(vault, 'Withdraw')
                    .withArgs(user.address, ether('999'));
            });
        });
    });

    describe('available', () => {
        it('should get balance with minimum amount on-hand', async () => {
            await dai.connect(user).faucet(1000);
            await dai.connect(user).transfer(vault.address, 1000);
            expect(await vault.available(dai.address)).to.equal(1000 * 0.95);
        });
    });

    describe('swap', () => {
        beforeEach(async () => {
            await manager.connect(treasury).setAllowedToken(dai.address, true);
            await manager.connect(treasury).setAllowedToken(usdc.address, true);
            await manager.connect(treasury).setAllowedVault(vault.address, true);
            await manager.connect(treasury).setAllowedController(controller.address, true);
            await manager.connect(treasury).setAllowedConverter(converter.address, true);
            await controller.connect(deployer).setConverter(vault.address, converter.address);
            await manager.connect(deployer).setController(vault.address, controller.address);
            await expect(manager.connect(deployer).addToken(vault.address, dai.address))
                .to.emit(manager, 'TokenAdded')
                .withArgs(vault.address, dai.address);
            await expect(manager.connect(deployer).addToken(vault.address, usdc.address))
                .to.emit(manager, 'TokenAdded')
                .withArgs(vault.address, usdc.address);
            expect((await vault.getTokens()).length).to.equal(2);
            await expect(vault.connect(user).deposit(dai.address, ether('1000')))
                .to.emit(vault, 'Deposit')
                .withArgs(user.address, ether('1000'));
        });

        it('should revert when called by an address other than strategist', async () => {
            await expect(
                vault.connect(user).swap(dai.address, usdc.address, 1)
            ).to.be.revertedWith('!strategist');
        });

        it('should revert when halted', async () => {
            await manager.setHalted();
            await expect(
                vault.connect(user).swap(dai.address, usdc.address, 1)
            ).to.be.revertedWith('halted');
        });

        it('should swap tokens for the desired tokens', async () => {
            expect(await dai.balanceOf(vault.address)).to.be.equal(ether('1000'));
            await vault.connect(deployer).swap(dai.address, usdc.address, 1);
            expect(await dai.balanceOf(vault.address)).to.be.equal(0);
            expect(await usdc.balanceOf(vault.address)).to.be.above(999000000);
        });
    });
});
