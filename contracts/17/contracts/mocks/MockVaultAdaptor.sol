// SPDX-License-Identifier: AGPLv3
pragma solidity >=0.6.0 <0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "../interfaces/IVault.sol";
import "../common/Constants.sol";

contract MockVaultAdaptor is IVault, Constants {
    using SafeMath for uint256;

    IERC20 public underlyingToken;
    uint256 public total = 0;
    uint256 public totalEstimated = 0;
    uint256 public amountAvailable;
    uint256 public countOfStrategies;
    address public override vault;
    address[] harvestQueue;
    uint256[] expectedDebtLimits;
    mapping(uint256 => uint256) strategyEstimatedAssets;

    address controller;
    uint256 amountToController;

    uint256 public gain;
    uint256 public loss;
    uint256 public startBlock;
    uint256 public swapInterestIncrement = 0;
    uint256 public strategiesLength;
    uint256 public investThreshold;
    uint256 public strategyRatioBuffer;

    constructor() public {}

    function setToken(address _token) external {}

    function setStrategiesLength(uint256 _strategiesLength) external {
        strategiesLength = _strategiesLength;
    }

    function setInvestThreshold(uint256 _investThreshold) external {
        investThreshold = _investThreshold;
    }

    function setStrategyRatioBuffer(uint256 _strategyRatioBuffer) external {
        strategyRatioBuffer = _strategyRatioBuffer;
    }

    function setUnderlyingToken(address _token) external {
        underlyingToken = IERC20(_token);
    }

    function setTotal(uint256 _total) external {
        total = _total;
    }

    function setController(address _controller) external {
        controller = _controller;
    }

    function setAmountToController(uint256 _amountToController) external {
        amountToController = _amountToController;
    }

    function setTotalEstimated(uint256 _totalEstimated) external {
        totalEstimated = _totalEstimated;
    }

    function setStrategyAssets(uint256 _index, uint256 _totalEstimated) external {
        strategyEstimatedAssets[_index] = _totalEstimated;
    }

    function setCountOfStrategies(uint32 _countOfStrategies) external {
        countOfStrategies = _countOfStrategies;
    }

    function setVault(address _vault) external {
        vault = _vault;
    }

    function setHarvestQueueAndLimits(address[] calldata _queue, uint256[] calldata _debtLimits) external {
        harvestQueue = _queue;
        expectedDebtLimits = _debtLimits;
    }

    function approve(address account, uint256 amount) external {
        underlyingToken.approve(account, amount);
    }

    function getHarvestQueueAndLimits() external view returns (address[] memory, uint256[] memory) {
        return (harvestQueue, expectedDebtLimits);
    }

    function strategyHarvest(uint256 _index) external override returns (bool) {}

    function strategyHarvestTrigger(uint256 _index, uint256 _callCost) external view override returns (bool) {}

    function deposit(uint256 _amount) external override {
        underlyingToken.transferFrom(msg.sender, address(this), _amount);
        // token.transfer(vault, _amount);
    }

    function withdraw(uint256 _amount) external override {
        underlyingToken.transfer(msg.sender, _amount);
    }

    function withdraw(uint256 _amount, address recipient) external override {
        recipient;
        underlyingToken.transfer(msg.sender, _amount);
    }

    function withdrawByStrategyOrder(
        uint256 _amount,
        address _recipient,
        bool pwrd
    ) external override {
        pwrd;
        underlyingToken.transfer(_recipient, _amount);
    }

    function depositAmountAvailable(uint256 _amount) external view returns (uint256) {
        _amount;
        return amountAvailable;
    }

    function setDepositAmountAvailable(uint256 _amountAvailable) external returns (uint256) {
        amountAvailable = _amountAvailable;
    }

    function addTotalAssets(uint256 addAsset) public {
        total += addAsset;
    }

    function startSwap(uint256 rate) external {
        startBlock = block.number;
        swapInterestIncrement = rate;
    }

    function getStartBlock() external view returns (uint256) {
        return startBlock;
    }

    function totalAssets() external view override returns (uint256) {
        uint256 interest = 0;
        if (startBlock != 0) {
            uint256 blockAdvancement = block.number.sub(startBlock);
            interest = blockAdvancement.mul(swapInterestIncrement);
        }
        return underlyingToken.balanceOf(address(this)).add(interest).add(total);
    }

    function updateStrategyRatio(uint256[] calldata debtratios) external override {}

    function getStrategiesLength() external view override returns (uint256) {
        return countOfStrategies;
    }

    function setGain(uint256 _gain) external {
        gain = _gain;
    }

    function setLoss(uint256 _loss) external {
        loss = _loss;
    }

    function getStrategyAssets(uint256 index) external view override returns (uint256) {
        return strategyEstimatedAssets[index];
    }

    function token() external view override returns (address) {
        return address(underlyingToken);
    }

    function withdrawByStrategyIndex(
        uint256 amount,
        address recipient,
        uint256 strategyIndex
    ) external override {}

    function investTrigger() external view override returns (bool) {}

    function invest() external override {}

    function withdrawToAdapter(uint256 amount) external {}
}
