// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../vaults/yearnv2/v032/IYearnV2Vault.sol";
import "../vaults/yearnv2/v032/IYearnV2Strategy.sol";
import "../interfaces/IERC20Detailed.sol";

contract MockYearnV2Vault is ERC20, IYearnV2Vault {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IERC20 public token;
    uint256 public override depositLimit;
    uint256 public override totalDebt;

    uint256 public total;
    uint256 public airlock;
    mapping(address => uint256) public strategiesDebtLimit;
    mapping(address => uint256) public strategiesTotalDebt;
    mapping(address => uint256) public strategiesDebtRatio;

    address public depositRecipient;
    address public withdrawRecipient;
    address[] public override withdrawalQueue;

    uint256 public amount;

    uint256[] public debtRatios;

    constructor(address _token) public ERC20("Vault", "Vault") {
        _setupDecimals(18);
        token = IERC20(_token);
    }

    function approveStrategies(address[] calldata strategyArray) external {
        for (uint256 i = 0; i < strategyArray.length; i++) {
            token.approve(strategyArray[i], type(uint256).max);
        }
    }

    function setStrategies(address[] calldata _strategies) external {
        for (uint256 i = 0; i < _strategies.length; i++) {
            require(_strategies[i] != address(0), "Invalid strategy address.");
        }
        withdrawalQueue = _strategies;
    }

    function setStrategyDebtRatio(address strategy, uint256 debtRatio) external {
        strategiesDebtRatio[strategy] = debtRatio;
    }

    function getStrategiesDebtRatio() external view returns (uint256[] memory ratios) {
        ratios = new uint256[](withdrawalQueue.length);
        for (uint256 i = 0; i < withdrawalQueue.length; i++) {
            ratios[i] = strategiesDebtRatio[withdrawalQueue[i]];
        }
    }

    function strategies(address _strategy) external view override returns (StrategyParams memory result) {
        result.debtRatio = strategiesDebtRatio[_strategy];
    }

    function setTotalAssets(uint256 _total) external {
        total = _total;
    }

    function totalAssets() public view override returns (uint256) {
        uint256 val = token.balanceOf(address(this));
        for (uint256 i = 0; i < withdrawalQueue.length; i++) {
            val = val.add(token.balanceOf(withdrawalQueue[i]));
        }
        return val;
    }

    function setAirlock(uint256 _airlock) external {
        airlock = _airlock;
    }

    function setTotalDebt(uint256 _totalDebt) public {
        totalDebt = _totalDebt;
    }

    function deposit(uint256 _amount, address _recipient) external override {
        totalDebt = totalDebt.add(_amount);
        total = total.add(_amount);
        token.safeTransferFrom(msg.sender, address(this), _amount);
        // uint256 available = _amount;
        // if (airlock < _amount) {
        //      available = airlock;
        // }
        // airlock = airlock.sub(available);
        // total = total.add(available);
        depositRecipient = _recipient;
    }

    function withdrawByStrategy(
        address[20] calldata _strategies,
        uint256 maxShares,
        address recipient,
        uint256 maxLoss
    ) external override returns (uint256) {}

    function withdraw(
        uint256 maxShares,
        address _recipient,
        uint256 maxLoss
    )
        external
        override
        returns (
            uint256,
            uint256,
            uint256,
            uint256
        )
    {
        maxLoss;
        uint256 _total = token.balanceOf(address(this));
        uint256 _amount = maxShares;
        if (_total < _amount) {
            //     available = total;
            for (uint256 i = 0; i < withdrawalQueue.length; i++) {
                address strategy = withdrawalQueue[i];
                uint256 stratDebt = strategiesDebtLimit[strategy];
                if (stratDebt > 0) {
                    strategiesDebtLimit[strategy] = 0;
                    IYearnV2Strategy(strategy).withdraw(stratDebt);
                    totalDebt = totalDebt.sub(stratDebt);
                }
            }
        }
        token.safeTransfer(_recipient, _amount);
        withdrawRecipient = _recipient;
    }

    function report(
        uint256 _gain,
        uint256 _loss,
        uint256 _debtPayment
    ) external override returns (uint256) {
        _gain;
        _loss;
        _debtPayment;
        address strategy = msg.sender;
        uint256 sBalance = token.balanceOf(strategy);
        if (sBalance > strategiesDebtLimit[strategy]) {
            uint256 outAmount = sBalance.sub(strategiesDebtLimit[strategy]);
            token.safeTransferFrom(strategy, address(this), outAmount);
        } else {
            uint256 inAmount = strategiesDebtLimit[strategy].sub(sBalance);
            token.safeTransfer(
                strategy,
                inAmount > token.balanceOf(address(this)) ? token.balanceOf(address(this)) : inAmount
            );
        }
    }

    function updateStrategyDebtRatio(address strategy, uint256 debtRatio) external override {
        strategiesDebtRatio[strategy] = debtRatio;
    }

    function debtOutstanding(address) external view override returns (uint256) {
        return 0;
    }

    function setStrategyTotalDebt(address _strategy, uint256 _totalDebt) external {
        strategiesTotalDebt[_strategy] = _totalDebt;
    }

    function pricePerShare() external view override returns (uint256) {
        if (this.totalAssets() == 0) {
            return uint256(10)**IERC20Detailed(address(token)).decimals();
        } else {
            return this.totalAssets().mul(IERC20Detailed(address(token)).decimals()).div(this.totalSupply());
        }
    }

    function getStrategyDebtLimit(address strategy) external view returns (uint256) {
        return strategiesDebtLimit[strategy];
    }

    function getStrategyTotalDebt(address strategy) external view returns (uint256) {
        return strategiesTotalDebt[strategy];
    }
}
