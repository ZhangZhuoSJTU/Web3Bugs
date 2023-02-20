'use strict';

const chai = require('chai');
const {
  Contract,
  ContractFactory,
  utils: { defaultAbiCoder, id, arrayify, keccak256, getCreate2Address },
} = require('ethers');
const { deployContract, MockProvider, solidity } = require('ethereum-waffle');
chai.use(solidity);
const { expect } = chai;
const { get } = require('lodash/fp');

const CHAIN_ID = 1;
const ADDRESS_ZERO = '0x0000000000000000000000000000000000000000';
const ROLE_OWNER = 1;
const ROLE_OPERATOR = 2;

const TokenDeployer = require('../build/TokenDeployer.json');
const AxelarGatewayProxy = require('../build/AxelarGatewayProxy.json');
const AxelarGatewayMultisig = require('../build/AxelarGatewayMultisig.json');
const MintableCappedERC20 = require('../build/MintableCappedERC20.json');
const BurnableMintableCappedERC20 = require('../build/BurnableMintableCappedERC20.json');
const DepositHandler = require('../build/DepositHandler.json');
const {
  bigNumberToNumber,
  getSignedMultisigExecuteInput,
  getRandomInt,
  getRandomID,
} = require('./utils');

describe('AxelarGatewayMultisig', () => {
  const wallets = new MockProvider().getWallets();
  const owners = wallets.slice(0, 3);
  const operators = wallets.slice(3, 6);
  const admins = wallets.slice(6, 9);
  const threshold = 2;

  let contract;
  let tokenDeployer;

  const makeTransferCommand = (commandName, newSet, newThreshold) =>
    arrayify(
      defaultAbiCoder.encode(
        ['uint256', 'uint256', 'bytes32[]', 'string[]', 'bytes[]'],
        [
          CHAIN_ID,
          ROLE_OWNER,
          [getRandomID()],
          [commandName],
          [
            defaultAbiCoder.encode(
              ['address[]', 'uint8'],
              [newSet.map(get('address')), newThreshold],
            ),
          ],
        ],
      ),
    );

  beforeEach(async () => {
    const params = arrayify(
      defaultAbiCoder.encode(
        ['address[]', 'uint8', 'address[]', 'uint8', 'address[]', 'uint8'],
        [
          admins.map(get('address')),
          threshold,
          owners.map(get('address')),
          threshold,
          operators.map(get('address')),
          threshold,
        ],
      ),
    );
    tokenDeployer = await deployContract(wallets[0], TokenDeployer);
    const gateway = await deployContract(wallets[0], AxelarGatewayMultisig, [
      tokenDeployer.address,
    ]);
    const proxy = await deployContract(wallets[0], AxelarGatewayProxy, [
      gateway.address,
      params,
    ]);
    contract = new Contract(
      proxy.address,
      AxelarGatewayMultisig.abi,
      wallets[0],
    );
  });

  describe('owners', () => {
    it('should get correct owners', () =>
      contract.owners(1).then((actual) => {
        expect(actual).to.deep.eq(owners.map(get('address')));
      }));
  });

  describe('operators', () => {
    it('should get correct operators', () =>
      contract.operators(1).then((actual) => {
        expect(actual).to.deep.eq(operators.map(get('address')));
      }));
  });

  describe('admins', () => {
    it('should get correct admins', () =>
      contract.admins(1).then((actual) => {
        expect(actual).to.deep.eq(admins.map(get('address')));
      }));
  });

  describe('upgrade', () => {
    it('should allow admins to upgrade implementation', async () => {
      const newImplementation = await deployContract(
        wallets[0],
        AxelarGatewayMultisig,
        [tokenDeployer.address],
      );
      const newImplementationCode = await newImplementation.provider.getCode(
        newImplementation.address,
      );
      const newImplementationCodeHash = keccak256(newImplementationCode);
      const params = arrayify(
        defaultAbiCoder.encode(
          ['address[]', 'uint8', 'address[]', 'uint8', 'address[]', 'uint8'],
          [
            owners.map(get('address')),
            threshold,
            owners.slice(0, 2).map(get('address')),
            threshold,
            operators.slice(0, 2).map(get('address')),
            threshold,
          ],
        ),
      );

      return expect(
        contract
          .connect(admins[0])
          .upgrade(
            newImplementation.address,
            newImplementationCodeHash,
            params,
          ),
      )
        .to.not.emit(contract, 'Upgraded')
        .then(() =>
          expect(
            contract
              .connect(admins[2])
              .upgrade(
                newImplementation.address,
                newImplementationCodeHash,
                params,
              ),
          )
            .to.emit(contract, 'Upgraded')
            .withArgs(newImplementation.address),
        );
    });
  });

  describe('execute', () => {
    describe('command deployToken', () => {
      it('should allow owners to deploy a new token', () => {
        const name = 'An Awesome Token';
        const symbol = 'AAT';
        const decimals = 18;
        const cap = 10000;
        const commandID = getRandomID();
        const data = arrayify(
          defaultAbiCoder.encode(
            ['uint256', 'uint256', 'bytes32[]', 'string[]', 'bytes[]'],
            [
              CHAIN_ID,
              ROLE_OWNER,
              [commandID],
              ['deployToken'],
              [
                defaultAbiCoder.encode(
                  ['string', 'string', 'uint8', 'uint256', 'address'],
                  [name, symbol, decimals, cap, ADDRESS_ZERO],
                ),
              ],
            ],
          ),
        );

        const tokenFactory = new ContractFactory(
          BurnableMintableCappedERC20.abi,
          BurnableMintableCappedERC20.bytecode,
        );
        const { data: tokenInitCode } = tokenFactory.getDeployTransaction(
          name,
          symbol,
          decimals,
          cap,
        );
        const expectedTokenAddress = getCreate2Address(
          contract.address,
          id(symbol),
          keccak256(tokenInitCode),
        );

        return getSignedMultisigExecuteInput(data, owners.slice(1, 3))
          .then((input) =>
            expect(contract.execute(input))
              .to.emit(contract, 'TokenDeployed')
              .and.to.emit(contract, 'Executed')
              .withArgs(commandID),
          )
          .then(() => contract.tokenAddresses(symbol))
          .then((tokenAddress) => {
            expect(tokenAddress).to.be.properAddress;
            expect(tokenAddress).to.eq(expectedTokenAddress);

            const tokenContract = new Contract(
              tokenAddress,
              BurnableMintableCappedERC20.abi,
              wallets[0],
            );

            return Promise.all([
              tokenContract.name(),
              tokenContract.symbol(),
              tokenContract.decimals(),
              tokenContract.cap().then(bigNumberToNumber),
            ]);
          })
          .then((actual) => {
            expect(actual).to.deep.eq([name, symbol, decimals, cap]);
          });
      });

      it('should not allow operators to deploy a new token', () => {
        const name = 'An Awesome Token';
        const symbol = 'AAT';
        const decimals = 18;
        const cap = 10000;
        const data = arrayify(
          defaultAbiCoder.encode(
            ['uint256', 'uint256', 'bytes32[]', 'string[]', 'bytes[]'],
            [
              CHAIN_ID,
              ROLE_OWNER,
              [getRandomID()],
              ['deployToken'],
              [
                defaultAbiCoder.encode(
                  ['string', 'string', 'uint8', 'uint256', 'address'],
                  [name, symbol, decimals, cap, ADDRESS_ZERO],
                ),
              ],
            ],
          ),
        );

        return getSignedMultisigExecuteInput(data, operators.slice(1, 3)).then(
          (input) =>
            expect(contract.execute(input)).to.not.emit(
              contract,
              'TokenDeployed',
            ),
        );
      });
    });

    describe('command mintToken', () => {
      const name = 'An Awesome Token';
      const symbol = 'AAT';
      const decimals = 18;
      const cap = 1e8;

      beforeEach(() => {
        const data = arrayify(
          defaultAbiCoder.encode(
            ['uint256', 'uint256', 'bytes32[]', 'string[]', 'bytes[]'],
            [
              CHAIN_ID,
              ROLE_OWNER,
              [getRandomID()],
              ['deployToken'],
              [
                defaultAbiCoder.encode(
                  ['string', 'string', 'uint8', 'uint256', 'address'],
                  [name, symbol, decimals, cap, ADDRESS_ZERO],
                ),
              ],
            ],
          ),
        );

        return getSignedMultisigExecuteInput(data, owners.slice(1, 3)).then(
          (input) => contract.execute(input),
        );
      });

      it('should not mint tokens if signer role is incorrect', async () => {
        const amount = 9999;
        const data = arrayify(
          defaultAbiCoder.encode(
            ['uint256', 'uint256', 'bytes32[]', 'string[]', 'bytes[]'],
            [
              CHAIN_ID,
              ROLE_OWNER,
              [getRandomID()],
              ['mintToken'],
              [
                defaultAbiCoder.encode(
                  ['string', 'address', 'uint256'],
                  [symbol, wallets[0].address, amount],
                ),
              ],
            ],
          ),
        );

        return getSignedMultisigExecuteInput(
          data,
          operators.slice(0, threshold),
        )
          .then((input) =>
            expect(contract.execute(input)).to.not.emit(contract, 'Executed'),
          )
          .then(() => {
            const data = arrayify(
              defaultAbiCoder.encode(
                ['uint256', 'uint256', 'bytes32[]', 'string[]', 'bytes[]'],
                [
                  CHAIN_ID,
                  ROLE_OPERATOR,
                  [getRandomID()],
                  ['mintToken'],
                  [
                    defaultAbiCoder.encode(
                      ['string', 'address', 'uint256'],
                      [symbol, wallets[0].address, amount],
                    ),
                  ],
                ],
              ),
            );

            return getSignedMultisigExecuteInput(
              data,
              owners.slice(0, threshold),
            );
          })
          .then((input) =>
            expect(contract.execute(input)).to.not.emit(contract, 'Executed'),
          );
      });

      it('should allow the owners to mint tokens', async () => {
        const amount = getRandomInt(cap);
        const data = arrayify(
          defaultAbiCoder.encode(
            ['uint256', 'uint256', 'bytes32[]', 'string[]', 'bytes[]'],
            [
              CHAIN_ID,
              ROLE_OWNER,
              [getRandomID()],
              ['mintToken'],
              [
                defaultAbiCoder.encode(
                  ['string', 'address', 'uint256'],
                  [symbol, wallets[0].address, amount],
                ),
              ],
            ],
          ),
        );

        const tokenAddress = await contract.tokenAddresses(symbol);
        const tokenContract = new Contract(
          tokenAddress,
          BurnableMintableCappedERC20.abi,
          wallets[0],
        );

        return getSignedMultisigExecuteInput(data, wallets.slice(0, 2))
          .then((input) =>
            expect(contract.execute(input))
              .to.emit(tokenContract, 'Transfer')
              .withArgs(ADDRESS_ZERO, wallets[0].address, amount)
              .and.to.emit(contract, 'Executed'),
          )
          .then(() =>
            tokenContract.balanceOf(wallets[0].address).then(bigNumberToNumber),
          )
          .then((actual) => {
            expect(actual).to.eq(amount);
          });
      });

      it('should allow the operators to mint tokens', async () => {
        const amount = getRandomInt(cap);
        const data = arrayify(
          defaultAbiCoder.encode(
            ['uint256', 'uint256', 'bytes32[]', 'string[]', 'bytes[]'],
            [
              CHAIN_ID,
              ROLE_OPERATOR,
              [getRandomID()],
              ['mintToken'],
              [
                defaultAbiCoder.encode(
                  ['string', 'address', 'uint256'],
                  [symbol, wallets[0].address, amount],
                ),
              ],
            ],
          ),
        );

        const tokenAddress = await contract.tokenAddresses(symbol);
        const tokenContract = new Contract(
          tokenAddress,
          BurnableMintableCappedERC20.abi,
          wallets[0],
        );

        return getSignedMultisigExecuteInput(data, operators.slice(1, 3))
          .then((input) =>
            expect(contract.execute(input))
              .to.emit(tokenContract, 'Transfer')
              .withArgs(ADDRESS_ZERO, wallets[0].address, amount)
              .and.to.emit(contract, 'Executed'),
          )
          .then(() =>
            tokenContract.balanceOf(wallets[0].address).then(bigNumberToNumber),
          )
          .then((actual) => {
            expect(actual).to.eq(amount);
          });
      });
    });

    describe('command burnToken', () => {
      const name = 'An Awesome Token';
      const symbol = 'AAT';
      const decimals = 18;
      const cap = 1e8;
      const amount = 100;

      beforeEach(() => {
        const data = arrayify(
          defaultAbiCoder.encode(
            ['uint256', 'uint256', 'bytes32[]', 'string[]', 'bytes[]'],
            [
              CHAIN_ID,
              ROLE_OWNER,
              [getRandomID(), getRandomID()],
              ['deployToken', 'mintToken'],
              [
                defaultAbiCoder.encode(
                  ['string', 'string', 'uint8', 'uint256', 'address'],
                  [name, symbol, decimals, cap, ADDRESS_ZERO],
                ),
                defaultAbiCoder.encode(
                  ['string', 'address', 'uint256'],
                  [symbol, wallets[0].address, amount],
                ),
              ],
            ],
          ),
        );

        return getSignedMultisigExecuteInput(data, owners.slice(1, 3)).then(
          (input) => contract.execute(input),
        );
      });

      it('should allow the owners to burn tokens', async () => {
        const destinationBtcAddress = '1KDeqnsTRzFeXRaENA6XLN1EwdTujchr4L';
        const salt = id(
          `${destinationBtcAddress}-${wallets[0].address}-${Date.now()}`,
        );

        const dataFirstBurn = arrayify(
          defaultAbiCoder.encode(
            ['uint256', 'uint256', 'bytes32[]', 'string[]', 'bytes[]'],
            [
              CHAIN_ID,
              ROLE_OWNER,
              [getRandomID()],
              ['burnToken'],
              [defaultAbiCoder.encode(['string', 'bytes32'], [symbol, salt])],
            ],
          ),
        );
        const dataSecondBurn = arrayify(
          defaultAbiCoder.encode(
            ['uint256', 'uint256', 'bytes32[]', 'string[]', 'bytes[]'],
            [
              CHAIN_ID,
              ROLE_OWNER,
              [getRandomID()],
              ['burnToken'],
              [defaultAbiCoder.encode(['string', 'bytes32'], [symbol, salt])],
            ],
          ),
        );

        const tokenAddress = await contract.tokenAddresses(symbol);
        const tokenContract = new Contract(
          tokenAddress,
          BurnableMintableCappedERC20.abi,
          wallets[0],
        );

        const depositHandlerAddress = getCreate2Address(
          contract.address,
          salt,
          keccak256(`0x${DepositHandler.bytecode}`),
        );

        const burnAmount = amount / 2;

        return tokenContract
          .transfer(depositHandlerAddress, burnAmount)
          .then(() =>
            getSignedMultisigExecuteInput(dataFirstBurn, owners.slice(0, 2)),
          )
          .then((input) =>
            expect(contract.execute(input))
              .to.emit(tokenContract, 'Transfer')
              .withArgs(depositHandlerAddress, ADDRESS_ZERO, burnAmount),
          )
          .then(() => tokenContract.transfer(depositHandlerAddress, burnAmount))
          .then(() =>
            getSignedMultisigExecuteInput(dataSecondBurn, owners.slice(1, 3)),
          )
          .then((input) =>
            expect(contract.execute(input))
              .to.emit(tokenContract, 'Transfer')
              .withArgs(depositHandlerAddress, ADDRESS_ZERO, burnAmount),
          )
          .then(() =>
            tokenContract
              .balanceOf(depositHandlerAddress)
              .then(bigNumberToNumber),
          )
          .then((actual) => {
            expect(actual).to.eq(0);
          });
      });

      it('should allow the operators to burn tokens', async () => {
        const destinationBtcAddress = '1KDeqnsTRzFeXRaENA6XLN1EwdTujchr4L';
        const salt = id(
          `${destinationBtcAddress}-${wallets[0].address}-${Date.now()}`,
        );

        const dataFirstBurn = arrayify(
          defaultAbiCoder.encode(
            ['uint256', 'uint256', 'bytes32[]', 'string[]', 'bytes[]'],
            [
              CHAIN_ID,
              ROLE_OPERATOR,
              [getRandomID()],
              ['burnToken'],
              [defaultAbiCoder.encode(['string', 'bytes32'], [symbol, salt])],
            ],
          ),
        );
        const dataSecondBurn = arrayify(
          defaultAbiCoder.encode(
            ['uint256', 'uint256', 'bytes32[]', 'string[]', 'bytes[]'],
            [
              CHAIN_ID,
              ROLE_OPERATOR,
              [getRandomID()],
              ['burnToken'],
              [defaultAbiCoder.encode(['string', 'bytes32'], [symbol, salt])],
            ],
          ),
        );

        const tokenAddress = await contract.tokenAddresses(symbol);
        const tokenContract = new Contract(
          tokenAddress,
          BurnableMintableCappedERC20.abi,
          wallets[0],
        );

        const depositHandlerAddress = getCreate2Address(
          contract.address,
          salt,
          keccak256(`0x${DepositHandler.bytecode}`),
        );

        const burnAmount = amount / 2;

        return tokenContract
          .transfer(depositHandlerAddress, burnAmount)
          .then(() =>
            getSignedMultisigExecuteInput(dataFirstBurn, operators.slice(0, 2)),
          )
          .then((input) =>
            expect(contract.execute(input))
              .to.emit(tokenContract, 'Transfer')
              .withArgs(depositHandlerAddress, ADDRESS_ZERO, burnAmount),
          )
          .then(() => tokenContract.transfer(depositHandlerAddress, burnAmount))
          .then(() =>
            getSignedMultisigExecuteInput(
              dataSecondBurn,
              operators.slice(1, 3),
            ),
          )
          .then((input) =>
            expect(contract.execute(input))
              .to.emit(tokenContract, 'Transfer')
              .withArgs(depositHandlerAddress, ADDRESS_ZERO, burnAmount),
          )
          .then(() =>
            tokenContract
              .balanceOf(depositHandlerAddress)
              .then(bigNumberToNumber),
          )
          .then((actual) => {
            expect(actual).to.eq(0);
          });
      });
    });

    describe('command transferOwnership', () => {
      it('should owners to transfer ownership', async () => {
        await getSignedMultisigExecuteInput(
          makeTransferCommand('transferOwnership', operators, threshold + 1),
          owners,
        )
          .then((input) =>
            expect(contract.execute(input))
              .to.emit(contract, 'OwnershipTransferred')
              .withArgs(
                owners.map(get('address')),
                threshold,
                operators.map(get('address')),
                threshold + 1,
              ),
          )
          .then(() => contract.owners(2))
          .then((actual) => {
            expect(actual).to.deep.eq(operators.map(get('address')));
          });

        await getSignedMultisigExecuteInput(
          makeTransferCommand('transferOwnership', operators, threshold),
          operators,
        ).then((input) =>
          expect(contract.execute(input))
            .to.emit(contract, 'OwnershipTransferred')
            .withArgs(
              operators.map(get('address')),
              threshold + 1,
              operators.map(get('address')),
              threshold,
            ),
        );
      });

      it('should allow previous owners to burn tokens', () => {
        const name = 'An Awesome Token';
        const symbol = 'AAT';
        const decimals = 18;
        const cap = 1e8;
        const amount = 100;
        const data = arrayify(
          defaultAbiCoder.encode(
            ['uint256', 'uint256', 'bytes32[]', 'string[]', 'bytes[]'],
            [
              CHAIN_ID,
              ROLE_OWNER,
              [getRandomID(), getRandomID()],
              ['deployToken', 'mintToken'],
              [
                defaultAbiCoder.encode(
                  ['string', 'string', 'uint8', 'uint256', 'address'],
                  [name, symbol, decimals, cap, ADDRESS_ZERO],
                ),
                defaultAbiCoder.encode(
                  ['string', 'address', 'uint256'],
                  [symbol, wallets[0].address, amount],
                ),
              ],
            ],
          ),
        );

        return getSignedMultisigExecuteInput(data, owners.slice(1, 3))
          .then((input) => contract.execute(input))
          .then(() =>
            getSignedMultisigExecuteInput(
              makeTransferCommand('transferOwnership', operators, threshold),
              owners,
            ),
          )
          .then((input) =>
            expect(contract.execute(input))
              .to.emit(contract, 'OwnershipTransferred')
              .withArgs(
                owners.map(get('address')),
                threshold,
                operators.map(get('address')),
                threshold,
              ),
          )
          .then(() => contract.owners(2))
          .then((actual) => {
            expect(actual).to.deep.eq(operators.map(get('address')));
          })
          .then(async () => {
            const destinationBtcAddress = '1KDeqnsTRzFeXRaENA6XLN1EwdTujchr4L';
            const salt = id(
              `${destinationBtcAddress}-${wallets[0].address}-${Date.now()}`,
            );

            const data = arrayify(
              defaultAbiCoder.encode(
                ['uint256', 'uint256', 'bytes32[]', 'string[]', 'bytes[]'],
                [
                  CHAIN_ID,
                  ROLE_OWNER,
                  [getRandomID()],
                  ['burnToken'],
                  [
                    defaultAbiCoder.encode(
                      ['string', 'bytes32'],
                      [symbol, salt],
                    ),
                  ],
                ],
              ),
            );

            const tokenAddress = await contract.tokenAddresses(symbol);
            const tokenContract = new Contract(
              tokenAddress,
              BurnableMintableCappedERC20.abi,
              wallets[0],
            );

            const depositHandlerAddress = getCreate2Address(
              contract.address,
              salt,
              keccak256(`0x${DepositHandler.bytecode}`),
            );

            await tokenContract.transfer(depositHandlerAddress, amount);
            const input = await getSignedMultisigExecuteInput(
              data,
              owners.slice(0, 2),
            );

            await expect(contract.execute(input))
              .to.emit(tokenContract, 'Transfer')
              .withArgs(depositHandlerAddress, ADDRESS_ZERO, amount);
          });
      });
    });

    describe('command transferOperatorship', () => {
      it('should allow owners to transfer operatorship', async () => {
        await getSignedMultisigExecuteInput(
          makeTransferCommand('transferOperatorship', owners, threshold + 1),
          owners,
        )
          .then((input) =>
            expect(contract.execute(input))
              .to.emit(contract, 'OperatorshipTransferred')
              .withArgs(
                operators.map(get('address')),
                threshold,
                owners.map(get('address')),
                threshold + 1,
              ),
          )
          .then(() => contract.operators(2))
          .then((actual) => {
            expect(actual).to.deep.eq(owners.map(get('address')));
          });

        await getSignedMultisigExecuteInput(
          makeTransferCommand('transferOperatorship', owners, threshold),
          owners,
        ).then((input) =>
          expect(contract.execute(input))
            .to.emit(contract, 'OperatorshipTransferred')
            .withArgs(
              owners.map(get('address')),
              threshold + 1,
              owners.map(get('address')),
              threshold,
            ),
        );
      });

      it('should allow previous operators to burn tokens', () => {
        const name = 'An Awesome Token';
        const symbol = 'AAT';
        const decimals = 18;
        const cap = 1e8;
        const amount = 100;
        const data = arrayify(
          defaultAbiCoder.encode(
            ['uint256', 'uint256', 'bytes32[]', 'string[]', 'bytes[]'],
            [
              CHAIN_ID,
              ROLE_OWNER,
              [getRandomID(), getRandomID()],
              ['deployToken', 'mintToken'],
              [
                defaultAbiCoder.encode(
                  ['string', 'string', 'uint8', 'uint256', 'address'],
                  [name, symbol, decimals, cap, ADDRESS_ZERO],
                ),
                defaultAbiCoder.encode(
                  ['string', 'address', 'uint256'],
                  [symbol, wallets[0].address, amount],
                ),
              ],
            ],
          ),
        );

        return getSignedMultisigExecuteInput(data, owners.slice(1, 3))
          .then((input) => contract.execute(input))
          .then(() =>
            getSignedMultisigExecuteInput(
              makeTransferCommand('transferOperatorship', owners, threshold),
              owners,
            ),
          )
          .then((input) =>
            expect(contract.execute(input))
              .to.emit(contract, 'OperatorshipTransferred')
              .withArgs(
                operators.map(get('address')),
                threshold,
                owners.map(get('address')),
                threshold,
              ),
          )
          .then(() => contract.operators(2))
          .then((actual) => {
            expect(actual).to.deep.eq(owners.map(get('address')));
          })
          .then(async () => {
            const destinationBtcAddress = '1KDeqnsTRzFeXRaENA6XLN1EwdTujchr4L';
            const salt = id(
              `${destinationBtcAddress}-${wallets[0].address}-${Date.now()}`,
            );

            const data = arrayify(
              defaultAbiCoder.encode(
                ['uint256', 'uint256', 'bytes32[]', 'string[]', 'bytes[]'],
                [
                  CHAIN_ID,
                  ROLE_OPERATOR,
                  [getRandomID()],
                  ['burnToken'],
                  [
                    defaultAbiCoder.encode(
                      ['string', 'bytes32'],
                      [symbol, salt],
                    ),
                  ],
                ],
              ),
            );

            const tokenAddress = await contract.tokenAddresses(symbol);
            const tokenContract = new Contract(
              tokenAddress,
              BurnableMintableCappedERC20.abi,
              wallets[0],
            );

            const depositHandlerAddress = getCreate2Address(
              contract.address,
              salt,
              keccak256(`0x${DepositHandler.bytecode}`),
            );

            await tokenContract.transfer(depositHandlerAddress, amount);
            const input = await getSignedMultisigExecuteInput(
              data,
              operators.slice(1, 3),
            );

            await expect(contract.execute(input))
              .to.emit(tokenContract, 'Transfer')
              .withArgs(depositHandlerAddress, ADDRESS_ZERO, amount);
          });
      });
    });

    describe('sendToken', () => {
      it('should burn internal token and emit an event', async () => {
        const tokenName = 'Test Token';
        const tokenSymbol = 'TEST';
        const decimals = 18;
        const cap = 1e9;

        const data = arrayify(
          defaultAbiCoder.encode(
            ['uint256', 'uint256', 'bytes32[]', 'string[]', 'bytes[]'],
            [
              CHAIN_ID,
              ROLE_OWNER,
              [getRandomID(), getRandomID()],
              ['deployToken', 'mintToken'],
              [
                defaultAbiCoder.encode(
                  ['string', 'string', 'uint8', 'uint256', 'address'],
                  [tokenName, tokenSymbol, decimals, cap, ADDRESS_ZERO],
                ),
                defaultAbiCoder.encode(
                  ['string', 'address', 'uint256'],
                  [tokenSymbol, owners[0].address, 1e6],
                ),
              ],
            ],
          ),
        );
        await contract.execute(
          await getSignedMultisigExecuteInput(data, owners.slice(0, 2)),
        );

        const tokenAddress = await contract.tokenAddresses(tokenSymbol);
        const token = new Contract(
          tokenAddress,
          BurnableMintableCappedERC20.abi,
          owners[0],
        );

        const issuer = owners[0].address;
        const spender = contract.address;
        const amount = 1000;
        const destination = operators[1].address.toString().replace('0x', '');

        await expect(await token.approve(spender, amount))
          .to.emit(token, 'Approval')
          .withArgs(issuer, spender, amount);

        await expect(
          await contract.sendToken('polygon', destination, tokenSymbol, amount),
        )
          .to.emit(token, 'Transfer')
          .withArgs(issuer, ADDRESS_ZERO, amount)
          .to.emit(contract, 'TokenSent')
          .withArgs(issuer, 'polygon', destination, tokenSymbol, amount);
      });

      it('should lock external token and emit an event', async () => {
        const tokenName = 'Test Token';
        const tokenSymbol = 'TEST';
        const decimals = 18;
        const cap = 1e9;

        const token = await deployContract(owners[0], MintableCappedERC20, [
          tokenName,
          tokenSymbol,
          decimals,
          cap,
        ]);

        await token.mint(owners[0].address, 1000000);

        const data = arrayify(
          defaultAbiCoder.encode(
            ['uint256', 'uint256', 'bytes32[]', 'string[]', 'bytes[]'],
            [
              CHAIN_ID,
              ROLE_OWNER,
              [getRandomID()],
              ['deployToken'],
              [
                defaultAbiCoder.encode(
                  ['string', 'string', 'uint8', 'uint256', 'address'],
                  [tokenName, tokenSymbol, decimals, cap, token.address],
                ),
              ],
            ],
          ),
        );
        await contract.execute(
          await getSignedMultisigExecuteInput(data, owners.slice(0, 2)),
        );

        const issuer = owners[0].address;
        const locker = contract.address;
        const amount = 1000;
        const destination = operators[1].address.toString().replace('0x', '');

        await expect(await token.approve(locker, amount))
          .to.emit(token, 'Approval')
          .withArgs(issuer, locker, amount);

        await expect(
          await contract.sendToken('polygon', destination, tokenSymbol, amount),
        )
          .to.emit(token, 'Transfer')
          .withArgs(issuer, locker, amount)
          .to.emit(contract, 'TokenSent')
          .withArgs(issuer, 'polygon', destination, tokenSymbol, amount);
      });
    });
  });
});
