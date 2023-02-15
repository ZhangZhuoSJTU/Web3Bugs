import { BigNumber } from '@ethersproject/bignumber';

module.exports = {
    "mainnet": {
        "blockchain": {
            "url": ""
        },
        "actors": {
            "admin": "",
            "proxyAdmin": "",
            "deployer": "",
            "verifier": ""
        },
        "tx": {
            "gas": "",
            "gasPrice": ""
        },
        "strategies": {
            "max": 5,
            "aave": {
                "wethGateway": "",
                "protocolDataProvider": "",
                "lendingPoolAddressesProvider": ""
            }
        },
        "repayments": {
            "votingPassRatio": "",
            "votingExtensionlength":"",
            "gracePenalty": "",
            "gracePeriodFraction":""
        },
        "pool": {
            "collectionPeriod": "",
            "loanWithdrawalDuration": "",
            "marginCallDuration": "",
            "gracePeriodPenaltyFraction": "",
            "liquidatorRewardFraction": "",
            "poolCancelPenalityFraction": 0
        },
        "creditLines": {
            "defaultStrategy": "0x0000000000000000000000000000000000000000"
        }
    },
    "kovan": {
        "blockchain": {
            "url": "https://kovan.infura.io/v3/9dc997986f8840daa0e6ccb1d8d0d757"
        },
        "actors": {
            "admin": "0xa9c24587019c197ccbc5c8998aae197fc1c5ab45",
            "proxyAdmin": "0x5649e99ff6358dd3e290b439e1f4b5513bb41bd4",
            "deployer": "0x5a9bac41426ad1637e9b4fa7d4aa9c69a0315802",
            "verifier": "0x85aa82e9c7dd8c5c4878e1fdb80d72689ab61922",
            "borrower": "0x364c1d9dc06d8877e8d2ca2355579d0f887835a3",
            "lender": "0x44b277e95b5a11e744aa3969f37eeedba6718335"
        },
        "tx": {
            "gas": "8000000",
            "gasPrice": "1000000000"
        },
        "strategies": {
            "max": 5,
            "aave": {
                "wethGateway": "0xA61ca04DF33B72b235a8A28CfB535bb7A5271B70",
                "protocolDataProvider": "0x3c73A5E5785cAC854D468F727c606C07488a29D6",
                "lendingPoolAddressesProvider": "0x88757f2f99175387aB4C6a4b3067c77A695b0349"
            }
        },
        "repayments": {
            "gracePenaltyRate": BigNumber.from(10).mul(BigNumber.from(10).pow(28)),
            "gracePeriodFraction": BigNumber.from(10).mul(BigNumber.from(10).pow(28))
        },
        "pool": {
            _collectionPeriod: BigNumber.from(10000),
            _loanWithdrawalDuration: BigNumber.from(200),
            _marginCallDuration: BigNumber.from(300),
            _minborrowFraction: BigNumber.from(1).mul(BigNumber.from(10).pow(29)),
            _gracePeriodPenaltyFraction: BigNumber.from(5).mul(BigNumber.from(10).pow(28)),
            _liquidatorRewardFraction: BigNumber.from(15).mul(BigNumber.from(10).pow(28)),
            _poolCancelPenalityFraction: BigNumber.from(10).mul(BigNumber.from(10).pow(28)),
            _protocolFeeFraction: BigNumber.from(1).mul(BigNumber.from(10).pow(26)),
        },
        "oracle": {
            "usd": "0x9326BFA02ADD2366b30bacB125260Af641031331"
        },
        "USDT": "0x8d40f9B7fd9AF24AAf8F8871af7026AeCCFB2b1e"
    },
    "ganache": {
        "blockchain": {
            "url": "http://127.0.0.1:8545",
            "mnemonic": "myth like bonus scare over problem client lizard pioneer submit female collect"
        },
        "actors": {
            "admin": "0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1",
            "proxyAdmin": "0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0",
            "deployer": "0x22d491Bde2303f2f43325b2108D26f1eAbA1e32b",
            "verifier": "0xE11BA2b4D45Eaed5996Cd0823791E0C93114882d",
            "borrower": "0xd03ea8624C8C5987235048901fB614fDcA89b117"
        },
        "tx": {
            "gas": "6721975",
            "gasPrice": "1000000000"
        },
        "strategies": {
            "max": 5,
            "aave": {
                "wethGateway": "0xf8aC10E65F2073460aAD5f28E1EABE807DC287CF",
                "protocolDataProvider": "0x3c73A5E5785cAC854D468F727c606C07488a29D6",
                "lendingPoolAddressesProvider": "0x88757f2f99175387aB4C6a4b3067c77A695b0349"
            }
        },
        "repayments": {
            "votingPassRatio": 50000000,
            "votingExtensionlength":5000,
            "gracePenalty": 500000000,
            "gracePeriodFraction":5000000
        },
        "pool": {
            "collectionPeriod": 900,
            "loanWithdrawalDuration": 120,
            "marginCallDuration": 120,
            "gracePeriodPenaltyFraction": 5000000,
            "liquidatorRewardFraction": 5000000
        },
        "OpenBorrowPool": {
            "poolSize": "40000000000000000",
            "minBorrowAmountFraction": 50000000,
            "borrowTokenType": "0x0000000000000000000000000000000000000000",
            "collateralTokenType": "0x17e91224c30c5b0B13ba2ef1E84FE880Cb902352",
            "collateralRatio": 10000000,
            "borrowRate": "6000000",
            "repaymentInterval": "86400",
            "noOfRepaymentIntervals": 15,
            "investedTo": "0x0000000000000000000000000000000000000000",
            "collateralAmount": "500000000000000000",
            "transferFromSavingsAccount": false,
            "salt": "borrower"
        },
        "oracle": {
            "usd": "0x9326BFA02ADD2366b30bacB125260Af641031331"
        },
        "USDT": "0x17e91224c30c5b0B13ba2ef1E84FE880Cb902352"
    },
    "network": "kovan"
}