// SPDX-License-Identifier: MIT
pragma solidity ^0.7.6;

import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/utils/ReentrancyGuard.sol';
import '@openzeppelin/contracts-upgradeable/proxy/Initializable.sol';
import '@openzeppelin/contracts-upgradeable/token/ERC20/ERC20PausableUpgradeable.sol';

import '../ProtocolFeeCollector.sol';
import '../../PriceOracle.sol';
import '../../CreditLine/CreditLine.sol';
import '../../yield/StrategyRegistry.sol';
import '../../SublimeProxy.sol';
import '../../CreditLine/CreditLine.sol';
import '../../yield/NoYield.sol';
import '../../yield/CompoundYield.sol';
import '../../Verification/Verification.sol';
import '../../SavingsAccount/SavingsAccount.sol';
import '../Constants.sol';
import '../../mocks/MockCToken.sol';
import '../../mocks/MockToken.sol';
import '../../mocks/MockAdminVerifier.sol';
import '../interfaces/IProxyUpgrade.sol';
import '../../Verification/twitterVerifier.sol';
import '../../Verification/adminVerifier.sol';

contract Admin {
    using SafeERC20 for IERC20;
    using SafeMath for uint256;

    function changeImplementationAddressOfProxy(address proxy, address newImplementation) public {
        ProxyUpgrade(proxy).upgradeTo(newImplementation);
    }

    function getImplementationAddressOfProxy(SublimeProxy sublimeProxyInstance) public returns (address) {
        address implAddress = sublimeProxyInstance.implementation();
        return implAddress;
    }

    /******************************************************************************
     ******* SavingsAccount specific functions ************************************
     ******************************************************************************/

    function initSavingsAccount(address savingsAccount, address _owner) public {
        SavingsAccount(savingsAccount).initialize(_owner);
    }

    function addSavingsAccountStrategy(address _strategyRegistry, address _strategyAddress) public {
        StrategyRegistry(_strategyRegistry).addStrategy(_strategyAddress);
    }

    function updateMaxStrategies(address _strategyRegistry, uint256 _maxStrategies) public {
        StrategyRegistry(_strategyRegistry).updateMaxStrategies(_maxStrategies);
    }

    function removeStrategy(
        address _strategyRegistry,
        uint256 _strategyIndex,
        address _strategyAddress
    ) public {
        StrategyRegistry(_strategyRegistry).removeStrategy(_strategyIndex, _strategyAddress);
    }

    function updateStrategy(
        address _strategyRegistry,
        uint256 _strategyIndex,
        address _oldStrategy,
        address _newStrategy
    ) public {
        StrategyRegistry(_strategyRegistry).updateStrategy(_strategyIndex, _oldStrategy, _newStrategy);
    }

    function updateProtocolFeeFraction(address creditLine, uint256 protocolFee) public {
        CreditLine(creditLine).updateProtocolFeeFraction(protocolFee);
    }

    function setDepositLimitForCompoundYield(
        address payable _compound,
        address _asset,
        uint256 _limit
    ) public {
        CompoundYield(_compound).setDepositLimit(_asset, _limit);
    }

    function addTokenAddressForCompoundYield(
        address payable yield,
        address _asset,
        address _liquidityToken
    ) public {
        CompoundYield(yield).addTokenAddress(_asset, _liquidityToken);
        setDepositLimitForCompoundYield(yield, _asset, type(uint256).max);
    }

    function addTokenAddressForNoYield(address yield, address _asset) public {
        NoYield(yield).addTokenAddress(_asset);
    }

    function transferOwnership(address _contract, address _to) public {
        MockToken(_contract).transferOwnership(_to);
    }

    function emergencyWithdrawFromCompoundYield(
        address payable yield,
        address _asset,
        address _wallet
    ) public {
        CompoundYield(yield).emergencyWithdraw(_asset, _wallet);
    }

    function forceUpdateTokenAddressForCompoundYield(
        address payable yield,
        address _asset,
        address _liquidityToken
    ) public {
        CompoundYield(yield).forceUpdateTokenAddress(_asset, _liquidityToken);
    }

    function emergencyWithdrawFromNoYield(
        address yield,
        address _asset,
        uint256 _amount
    ) public {
        NoYield(yield).emergencyWithdraw(_asset, _amount);
    }

    /******************************************************************************
     ******* END SavingsAccount specific functions ************************************
     ******************************************************************************/

    /******************************************************************************
     ******* PriceOracle specific functions ***************************************
     ******************************************************************************/

    function deployPriceOracle(address _admin, uint32 _uniswapPriceAvgPeriod) public returns (address) {
        PriceOracle _priceOracle = new PriceOracle(Constants.CHAINLINK_HEARTBEAT);
        _priceOracle.initialize(_admin, _uniswapPriceAvgPeriod);

        return address(_priceOracle);
    }

    function setChainlinkFeedAddress(
        address priceOracle,
        address token,
        address aggregator,
        uint128 heartbeat
    ) public {
        PriceOracle(priceOracle).setChainlinkFeedAddress(token, aggregator, heartbeat);
    }

    // NEEDS FORKING
    function setUpAllOracles(address priceOracleAddress) public {
        PriceOracle priceOracle = PriceOracle(priceOracleAddress);

        priceOracle.setChainlinkFeedAddress(Constants.WETH, Constants.ETH_priceFeedChainlink, Constants.CHAINLINK_HEARTBEAT);
        priceOracle.setChainlinkFeedAddress(Constants.DAI, Constants.DAI_priceFeedChainlink, Constants.CHAINLINK_HEARTBEAT);
        priceOracle.setChainlinkFeedAddress(Constants.USDC, Constants.USDC_priceFeedChainlink, Constants.CHAINLINK_HEARTBEAT);
        priceOracle.setChainlinkFeedAddress(Constants.WBTC, Constants.WBTC_priceFeedChainlink, Constants.CHAINLINK_HEARTBEAT);

        priceOracle.setUniswapFeedAddress(Constants.USDC, Constants.WETH, Constants.USDC_ETH_priceFeedUniswap);
        priceOracle.setUniswapFeedAddress(Constants.WBTC, Constants.WETH, Constants.WBTC_WETH_priceFeedUniswap);
        priceOracle.setUniswapFeedAddress(Constants.WBTC, Constants.DAI, Constants.WBTC_DAI_priceFeedUniswap);
    }

    /******************************************************************************
     ******* END PriceOracle specific functions ***************************************
     ******************************************************************************/

    /******************************************************************************
     ******* Verification specific functions ***************************************
     ******************************************************************************/

    function initializeVerification(
        Verification verification,
        address _admin,
        uint256 _activationDelay
    ) public {
        verification.initialize(_admin, _activationDelay);
    }

    /******************************************************************************
     ******* End Verification specific functions ***************************************
     ******************************************************************************/

    /******************************************************************************
     ******* Verifier specific functions ***************************************
     ******************************************************************************/

    function initializeTwitterVerifier(
        TwitterVerifier twitterVerifier,
        address _admin,
        address _signerAddress,
        uint256 _signValidity,
        string calldata _name,
        string calldata _version
    ) public {
        twitterVerifier.initialize(_admin, _signerAddress, _signValidity, _name, _version);
    }

    function addVerifier(address _verification, address _verifier) public {
        Verification(_verification).addVerifier(_verifier);
    }

    function removeVerifier(address _verification, address _verifier) public {
        Verification(_verification).removeVerifier(_verifier);
    }

    function verifyUser(address _user, address _verifier) public {
        MockAdminVerifier verifier = MockAdminVerifier(payable(_verifier));
        verifier.registerUserViaOwner(_user);
    }

    function blacklistDigestInTwitterVerifier(TwitterVerifier verifier, bytes32 digest) public {
        verifier.blackListDigest(digest);
    }

    function blacklistDigestInAdminVerifier(AdminVerifier verifier, bytes32 digest) public {
        verifier.blackListDigest(digest);
    }

    function updateSignerInTwitterVerifier(TwitterVerifier verifier, address newSigner) public {
        verifier.updateSignerAddress(newSigner);
    }

    function updateSignerInAdminVerifier(AdminVerifier verifier, address newSigner) public {
        verifier.updateSignerAddress(newSigner);
    }

    function updateSignValidityInTwitterVerifier(TwitterVerifier verifier, uint256 signValidity) public {
        verifier.updateSignValidity(signValidity);
    }

    function updateSignValidityInAdminVerifier(AdminVerifier verifier, uint256 signValidity) public {
        verifier.updateSignValidity(signValidity);
    }

    function unregisterUserByAdminInAdminVerifier(AdminVerifier verifier, address user) public {
        verifier.unregisterUser(user);
    }

    function unregisterUserByAdminInTwitterVerifier(TwitterVerifier verifier, address user) public {
        verifier.unregisterUser(user);
    }

    function initializeAdminVerifier(
        AdminVerifier adminVerifier,
        address _admin,
        address _signerAddress,
        uint256 _signValidity,
        string calldata _name,
        string calldata _version
    ) public {
        adminVerifier.initialize(_admin, _signerAddress, _signValidity, _name, _version);
    }

    /******************************************************************************
     ******* END Verifier specific functions ***************************************
     ******************************************************************************/

    /******************************************************************************
     ******* Verification specific functions ***************************************
     ******************************************************************************/

    function registerMasterAddressInVerificaction(
        Verification verification,
        address _masterAddress,
        bool _isMasterLinked
    ) public {
        verification.registerMasterAddress(_masterAddress, _isMasterLinked);
    }

    function unregisterMasterAddressInVerification(
        Verification verification,
        address _masterAddress,
        address _verifier
    ) public {
        verification.unregisterMasterAddress(_masterAddress, _verifier);
    }

    function updateActivationDelayInVerification(Verification verification, uint256 _activationDelay) public {
        verification.updateActivationDelay(_activationDelay);
    }

    /******************************************************************************
     ******* End Verification specific functions ***************************************
     ******************************************************************************/

    /******************************************************************************
     ******* DEPLOYEMNT specific functions ***************************************
     ******************************************************************************/

    function deployVerification(address) public returns (address) {
        Verification _verification = new Verification();
        _verification.initialize(address(this), 0);

        return address(_verification);
    }

    function deployMockAdminVerifier(address _verification) public returns (address) {
        MockAdminVerifier _mockAdminVerifier = new MockAdminVerifier();
        _mockAdminVerifier.initialize(address(this), _verification, 'MockAdminVerifier', '1.0');

        return address(_mockAdminVerifier);
    }

    function deployStrategyRegistry(uint256 _maxStrategies) public returns (address) {
        StrategyRegistry _strategyRegistry = new StrategyRegistry();
        _strategyRegistry.initialize(address(this), _maxStrategies);

        return address(_strategyRegistry);
    }

    function deploySavingsAccount(address _strategyRegistry) public returns (address) {
        SavingsAccount _savingsAccount = new SavingsAccount(_strategyRegistry);
        _savingsAccount.initialize(address(this));

        return address(_savingsAccount);
    }

    function deployNoYield(
        address _admin,
        address _savingsAccount,
        address _treasury
    ) public returns (address) {
        NoYield _noYield = new NoYield(_treasury, _savingsAccount);
        _noYield.initialize(_admin);

        return address(_noYield);
    }

    function deployCompoundYield(
        address _admin,
        address _savingsAccount,
        address _mockWETH,
        address _treasury
    ) public returns (address) {
        CompoundYield _compoundYield = new CompoundYield(_mockWETH, _treasury, _savingsAccount);
        _compoundYield.initialize(_admin);

        return address(_compoundYield);
    }

    function deployMockCToken(
        address _underlying,
        address _compoundYield,
        address _noYield
    ) public returns (address) {
        MockCToken _mockCToken = new MockCToken(address(_underlying));
        addTokenAddressForCompoundYield(payable(_compoundYield), _underlying, address(_mockCToken));
        addTokenAddressForNoYield(_noYield, _underlying);
        return address(_mockCToken);
    }

    /******************************************************************************
     ******* END DEPLOYEMNT specific functions ***************************************
     ******************************************************************************/

    function transferToken(
        address token,
        address recipient,
        uint256 amount
    ) public {
        IERC20(token).safeTransfer(recipient, amount);
    }

    function getFunctionSignature(string memory signature) public pure returns (bytes4) {
        return bytes4(keccak256(bytes(signature)));
    }

    function execute(
        address target,
        uint256 value,
        bytes calldata callData
    ) public {
        (bool success, ) = target.call{value: value}(callData);
        require(success, 'Transaction execution reverted.');
    }

    function executeFuncSig(
        address target,
        uint256 value,
        string memory signature,
        bytes calldata callData
    ) public {
        (bool success, ) = target.call{value: value}(abi.encodePacked(getFunctionSignature(signature), callData));
        require(success, 'Transaction execution reverted.');
    }
}
