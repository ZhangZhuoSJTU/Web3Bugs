import { BigNumberish, Signer } from 'ethers';

import { ERC20 } from '../../typechain/ERC20';
import { ERC20Detailed } from '../../typechain/ERC20Detailed';
import { IWETHGateway } from '../../typechain/IWETHGateway';
import { IyVault } from '../../typechain/IyVault';
import { ICEther } from '../../typechain/ICEther';
import { Token } from '../../typechain/Token';
import { IUniswapV3Factory } from '../../typechain/IUniswapV3Factory';

import { ERC20__factory } from '../../typechain/factories/ERC20__factory';
import { ERC20Detailed__factory } from '../../typechain/factories/ERC20Detailed__factory';
import { IWETHGateway__factory } from '../../typechain/factories/IWETHGateway__factory';
import { IyVault__factory } from '../../typechain/factories/IyVault__factory';
import { ICEther__factory } from '../../typechain/factories/ICEther__factory';
import { IYield__factory } from '../../typechain/factories/IYield__factory';
import { Token__factory } from '../../typechain/factories/Token__factory';
import { IUniswapV3Factory__factory } from '../../typechain/factories/IUniswapV3Factory__factory';

import { Address } from 'hardhat-deploy/dist/types';
import { IYield } from '../../typechain/IYield';

export default class DeployMockContracts {
    private _deployerSigner: Signer;

    constructor(deployerSigner: Signer) {
        this._deployerSigner = deployerSigner;
    }

    public async deployMockERC20(): Promise<ERC20> {
        return await (await new ERC20__factory(this._deployerSigner).deploy()).deployed();
    }

    public async getMockERC20(tokenAddress: Address): Promise<ERC20> {
        return await new ERC20__factory(this._deployerSigner).attach(tokenAddress);
    }

    public async deployMockERC20Detailed(name: string, symbol: string, decimals: BigNumberish): Promise<ERC20Detailed> {
        return await (await new ERC20Detailed__factory(this._deployerSigner).deploy(name, symbol, decimals)).deployed();
    }

    public async getMockERC20Detailed(tokenAddress: Address): Promise<ERC20Detailed> {
        return await new ERC20Detailed__factory(this._deployerSigner).attach(tokenAddress);
    }

    public async getMockIWETHGateway(wethGatewayAddress: Address): Promise<IWETHGateway> {
        return await IWETHGateway__factory.connect(wethGatewayAddress, this._deployerSigner);
    }

    public async getMockIyVault(vaultAddress: Address): Promise<IyVault> {
        return await IyVault__factory.connect(vaultAddress, this._deployerSigner);
    }

    public async getMockICEther(cethAddress: Address): Promise<ICEther> {
        return await ICEther__factory.connect(cethAddress, this._deployerSigner);
    }

    public async getYield(yieldAddress: Address): Promise<IYield> {
        return await IYield__factory.connect(yieldAddress, this._deployerSigner);
    }

    public async getIUniswapV3Factory(contractAddress: Address): Promise<IUniswapV3Factory> {
        return await IUniswapV3Factory__factory.connect(contractAddress, this._deployerSigner);
    }

    public async deployToken(name: string, symbol: string, initSupply: BigNumberish): Promise<Token> {
        return await (await new Token__factory(this._deployerSigner).deploy(name, symbol, initSupply)).deployed();
    }

    public async getToken(token: Address): Promise<Token> {
        return await Token__factory.connect(token, this._deployerSigner);
    }
}
