import { BigNumber } from '@ethersproject/bignumber';
import { Address } from 'hardhat-deploy/dist/types';

export const depositValueToTest: BigNumber = BigNumber.from('1000000000000000000'); // 1 ETH (or) 10^18 Tokens
export const zeroAddress: Address = '0x0000000000000000000000000000000000000000';
export const randomAddress: Address = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

export const aaveYieldParams = {
    _wethGateway: '0xcc9a0B7c43DC2a5F023Bb9b738E45B0Ef6B06E04',
    _protocolDataProvider: '0x057835Ad21a177dbdd3090bB1CAE03EaCF78Fc6d',
    _lendingPoolAddressesProvider: '0xb53c1a33016b2dc2ff3653530bff1848a515c8c5',
};

//Yearn Protocol Addresses
export const LINK_Yearn_Protocol_Address = '0x881b06da56bb5675c54e4ed311c21e54c5025298'; // @prateek to check if update needed in upgrade v2
export const USDC_Yearn_Protocol_Address = '0x5f18c75abdae578b483e5f43f12a39cf75b973a9';
export const USDT_Yearn_Protocol_Address = '0x2f08119C6f07c006695E079AAFc638b8789FAf18';
export const DAI_Yearn_Protocol_Address = '0xACd43E627e64355f1861cEC6d3a6688B31a6F952'; // TODO: To be upgraded to v2
export const INCH_Yearn_Protocol_Address = '0xB8C3B7A2A618C552C23B1E4701109a9E756Bab67';
export const INCH_Token_Address = '0x111111111117dC0aa78b770fA6A738034120C302';
export const YFI_Token_Address = '0xBA2E7Fed597fd0E3e70f5130BcDbbFE06bB94fe1';
export const YFI_Yearn_Protocol_Address = '0xBA2E7Fed597fd0E3e70f5130BcDbbFE06bB94fe1';
export const HEGIC_Token_Address = '0x584bC13c7D411c00c01A62e8019472dE68768430';
export const HEGIC_Yearn_Protocol_Address = '0xe11ba472F74869176652C35D30dB89854b5ae84D';
export const COMP_Yearn_Protocol_Address = '0x629c759D1E83eFbF63d84eb3868B564d9521C129'; //yvCurve-Compound
export const COMP_CURVE_POOL = '0x845838DF265Dcd2c412A1Dc9e959c7d08537f8a2'; //Curve-Compound
//WETH = ETH
//WBTC = BTC
export const ETH_Yearn_Protocol_Address = '0xe1237aa7f535b0cc33fd973d66cbf830354d16c7'; // TODO: To be upgraded to v2
export const WETH_Yearn_Protocol_Address = '0xe1237aA7f535b0CC33Fd973D66cBf830354D16c7'; // TODO: To be upgraded to v2
export const WBTC_Yearn_Protocol_Address = '0xA696a63cc78DfFa1a63E9E50587C197387FF6C7E';
// '0xcb550a6d4c8e3517a939bc79d0c7093eb7cf56b5';

//Account Holders
export const Binance7 = '0xbe0eb53f46cd790cd13851d5eff43d12404d33e8';
export const WhaleAccount = '0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503';
export const USDTWhale = '0x34ea4138580435B5A521E460035edb19Df1938c1';
export const WBTCWhale = '0x28C6c06298d514Db089934071355E5743bf21d60'; // Binance 14
export const UNIWhale = '0x72A53cDBBcc1b9efa39c834A540550e23463AAcB';
export const INCHWhale = '0x72A53cDBBcc1b9efa39c834A540550e23463AAcB';

export const aLink = '0xa06bC25B5805d5F8d82847D191Cb4Af5A3e873E0';

//Pool creation constants
const collateralRatio = BigNumber.from(60).mul(BigNumber.from(10).pow(28));
const poolSize = BigNumber.from('100000000000000000000'); // 100e18 dai

export const createPoolParams = {
    _poolSize: poolSize,
    _borrowAmountRequested: depositValueToTest,
    _idealCollateralRatio: collateralRatio,
    _collateralRatio: collateralRatio,
    _borrowRate: BigNumber.from(1).mul(BigNumber.from(10).pow(28)),
    _repaymentInterval: BigNumber.from(1000),
    _noOfRepaymentIntervals: BigNumber.from(25),
    _collateralAmount: BigNumber.from('3000000000000000000000'), // 3000e18
    _collateralAmountForETH: BigNumber.from('10000000000000000000'), // 10 ETH
    _collateralAmountForUNI: BigNumber.from('10000000000000000000'), // 1 UNI
    _collateralAmountForWBTC: BigNumber.from('100000000'), // 1 BTC
    _loanWithdrawalDuration: BigNumber.from(15000000),
    _collectionPeriod: BigNumber.from(5000000),
};

// address _borrowTokenType,
// address _collateralTokenType,
// address _poolSavingsStrategy,
// bool _transferFromSavingsAccount,
// bytes32 _salt

export const testPoolFactoryParams = {
    _collectionPeriod: BigNumber.from(10000),
    _loanWithdrawalDuration: BigNumber.from(200),
    _marginCallDuration: BigNumber.from(300),
    _minborrowFraction: BigNumber.from(1).mul(BigNumber.from(10).pow(29)),
    _gracePeriodPenaltyFraction: BigNumber.from(5).mul(BigNumber.from(10).pow(28)),
    _liquidatorRewardFraction: BigNumber.from(15).mul(BigNumber.from(10).pow(28)),
    _poolCancelPenalityFraction: BigNumber.from(10).mul(BigNumber.from(10).pow(28)),
    _protocolFeeFraction: BigNumber.from(1).mul(BigNumber.from(10).pow(26)),
};

export const creditLineFactoryParams = {
    _liquidatorRewardFraction: BigNumber.from(10).mul(BigNumber.from(10).pow(28)),
    _protocolFeeFraction: BigNumber.from(2).mul(BigNumber.from(10).pow(26)),
};

export const repaymentParams = {
    gracePenalityRate: BigNumber.from(10).mul(BigNumber.from(10).pow(28)),
    gracePeriodFraction: BigNumber.from(10).mul(BigNumber.from(10).pow(28)),
};

export const extensionParams = {
    votingPassRatio: BigNumber.from(10).pow(28).mul(50),
};

export const verificationParams = {
    activationDelay: 0
}

// Pool inputs to be manullay added
// address _borrower,
// address _borrowAsset,
// address _collateralAsset,
// address _poolSavingsStrategy,
// bool _transferFromSavingsAccount,

export const OperationalAmounts = {
    _amountLent: BigNumber.from(1000000),
};

export const ChainLinkAggregators = {
    'LINK/USD': '0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c',
    'USDC/USD': '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
    'USDT/USD': '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D',
    'COMP/USD': '0xdbd020CAeF83eFd542f4De03e3cF0C28A4428bd5',
    'UNI/USD': '0x553303d460EE0afB37EdFf9bE42922D8FF63220e',
    'ETH/USD': '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
    'DAI/USD': '0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9',
    'INCH/USD': '0xc929ad75B72593967DE83E7F7Cda0493458261D9',
    'YFI/USD': '0xA027702dbb89fbd58938e4324ac03B58d812b0E1',
    'HEGIC/USD': '0xBFC189aC214E6A4a35EBC281ad15669619b75534',
    'BTC/USD': '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c',
};
