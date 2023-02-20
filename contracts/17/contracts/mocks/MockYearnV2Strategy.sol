// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/IVault.sol";
import "../vaults/yearnv2/v032/IYearnV2Strategy.sol";
import "../vaults/yearnv2/v032/IYearnV2Vault.sol";
import "./MockYearnV2Vault.sol";

contract MockYearnV2Strategy is ERC20, IYearnV2Strategy {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    IERC20 public token;

    uint256 public harvestAmount;
    uint256 public estimatedAmount;
    bool public worthHarvest;

    address public override vault;
    address public override keeper;
    address public pool;

    constructor(address _token) public ERC20("Strategy", "Strategy") {
        _setupDecimals(18);
        token = IERC20(_token);
    }

    function withdraw(uint256 _amount) external override {
        token.transfer(vault, _amount);
    }

    function harvest() external override {
        // MockYearnV2Vault valt = MockYearnV2Vault(vault);
        // uint256 debtLimit = valt.getStrategyDebtLimit(address(this));
        // uint256 lastTotalDebt = valt.getStrategyTotalDebt(address(this));
        // uint256 balance = token.balanceOf(address(this));
        uint256 gain = 0;
        uint256 loss = 0;
        uint256 delt = 0;
        // if(balance > lastTotalDebt){
        //     gain = balance.sub(lastTotalDebt);
        // } else {
        //     loss = lastTotalDebt.sub(balance);
        // }
        // if(debtLimit >= balance) {
        //     delt = debtLimit.sub(balance);
        // }else {
        //     uint256 overflow = balance.sub(debtLimit);
        //     token.safeTransfer(vault, overflow);
        // }
        IYearnV2Vault(vault).report(gain, loss, delt);
    }

    function setHarvestAmount(uint256 _amount) external {
        harvestAmount = _amount;
    }

    function setVault(address _vault) external override {
        vault = _vault;
        token.safeApprove(_vault, type(uint256).max);
    }

    function setKeeper(address _keeper) external override {
        keeper = _keeper;
    }

    function setPool(address _pool) external {
        pool = _pool;
    }

    function setWorthHarvest(bool _worthHarvest) external {
        worthHarvest = _worthHarvest;
    }

    function harvestTrigger(uint256 callCost) public view override returns (bool) {
        callCost;
        return worthHarvest;
    }

    function estimatedTotalAssets() public view override returns (uint256) {
        // return estimatedAmount;
        return token.balanceOf(address(this));
    }

    function setEstimatedAmount(uint256 _estimatedAmount) external {
        estimatedAmount = _estimatedAmount;
    }
}
