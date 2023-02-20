pragma solidity 0.6.12;


//----------------------------------------------------------------------------------
//    I n s t a n t
//
//        .:mmm.         .:mmm:.       .ii.  .:SSSSSSSSSSSSS.     .oOOOOOOOOOOOo.
//      .mMM'':Mm.     .:MM'':Mm:.     .II:  :SSs..........     .oOO'''''''''''OOo.
//    .:Mm'   ':Mm.   .:Mm'   'MM:.    .II:  'sSSSSSSSSSSSSS:.  :OO.           .OO:
//  .'mMm'     ':MM:.:MMm'     ':MM:.  .II:  .:...........:SS.  'OOo:.........:oOO'
//  'mMm'        ':MMmm'         'mMm:  II:  'sSSSSSSSSSSSSS'     'oOOOOOOOOOOOO'
//
//----------------------------------------------------------------------------------
//
// Chef Gonpachi's Post Auction Launcher
//
// A post auction contract that takes the proceeds and creates a liquidity pool
//
// 
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// The above copyright notice and this permission notice shall be included 
// in all copies or substantial portions of the Software.
//
// Made for Sushi.com 
// 
// Enjoy. (c) Chef Gonpachi
// <https://github.com/chefgonpachi/MISO/>
//
// ---------------------------------------------------------------------
// SPDX-License-Identifier: GPL-3.0                        
// ---------------------------------------------------------------------

import "../OpenZeppelin/utils/ReentrancyGuard.sol";
import "../Access/MISOAccessControls.sol";
import "../Utils/SafeTransfer.sol";
import "../Utils/BoringMath.sol";
import "../UniswapV2/UniswapV2Library.sol";
import "../UniswapV2/interfaces/IUniswapV2Pair.sol";
import "../UniswapV2/interfaces/IUniswapV2Factory.sol";
import "../interfaces/IWETH9.sol";
import "../interfaces/IERC20.sol";
import "../interfaces/IMisoAuction.sol";



contract PostAuctionLauncher is MISOAccessControls, SafeTransfer, ReentrancyGuard {
    using BoringMath for uint256;
    using BoringMath128 for uint128;
    using BoringMath64 for uint64;
    using BoringMath32 for uint32;
    using BoringMath16 for uint16;


    /// @notice Number of seconds per day.
    uint256 private constant SECONDS_PER_DAY = 24 * 60 * 60;
    address private constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;
    uint256 private constant LIQUIDITY_PRECISION = 10000;
    
    /// @notice MISOLiquidity template id.
    uint256 public constant liquidityTemplate = 3;

    /// @notice First Token address.
    IERC20 public token1;
    /// @notice Second Token address.
    IERC20 public token2;
    /// @notice Uniswap V2 factory address.
    IUniswapV2Factory public factory;
    /// @notice WETH contract address.
    address private immutable weth;


    /// @notice LP pair address.
    address public tokenPair;
    /// @notice Withdraw wallet address.
    address public wallet;
    /// @notice Token market contract address.
    IMisoAuction public market;

    struct LauncherInfo {
        uint32 locktime;
        uint64 unlock;
        uint16 liquidityPercent;
        bool launched;
        uint128 liquidityAdded;
    }
    LauncherInfo public launcherInfo;

    /// @notice Emitted when LP contract is initialised.
    event InitLiquidityLauncher(address indexed token1, address indexed token2, address factory, address sender);
    /// @notice Emitted when LP is launched.
    event LiquidityAdded(uint256 liquidity);
    /// @notice Emitted when wallet is updated.
    event WalletUpdated(address indexed wallet);
    /// @notice Emitted when launcher is cancelled.
    event LauncherCancelled(address indexed wallet);

    constructor (address _weth) public {
        weth = _weth;
    }


    /**
     * @notice Initializes main contract variables (requires launchwindow to be more than 2 days.)
     * @param _market Auction address for launcher.
     * @param _factory Uniswap V2 factory address.
     * @param _admin Contract owner address.
     * @param _wallet Withdraw wallet address.
     * @param _liquidityPercent Percentage of payment currency sent to liquidity pool.
     * @param _locktime How long the liquidity will be locked. Number of seconds.
     */
    function initAuctionLauncher(
            address _market,
            address _factory,
            address _admin,
            address _wallet,
            uint256 _liquidityPercent,
            uint256 _locktime
    )
        public
    {
        require(_locktime < 10000000000, 'PostAuction: Enter an unix timestamp in seconds, not miliseconds');
        require(_liquidityPercent <= LIQUIDITY_PRECISION, 'PostAuction: Liquidity percentage greater than 100.00% (>10000)');
        require(_liquidityPercent > 0, 'PostAuction: Liquidity percentage equals zero');
        require(_admin != address(0), "PostAuction: admin is the zero address");
        require(_wallet != address(0), "PostAuction: wallet is the zero address");

        initAccessControls(_admin);

        market = IMisoAuction(_market);
        token1 = IERC20(market.paymentCurrency());
        token2 = IERC20(market.auctionToken());

        if (address(token1) == ETH_ADDRESS) {
            token1 = IERC20(weth);
        }

        uint256 d1 = uint256(token1.decimals());
        uint256 d2 = uint256(token2.decimals());
        require(d2 >= d1);

        factory = IUniswapV2Factory(_factory);
        bytes32 pairCodeHash = IUniswapV2Factory(_factory).pairCodeHash();
        tokenPair = UniswapV2Library.pairFor(_factory, address(token1), address(token2), pairCodeHash);
   
        wallet = _wallet;
        launcherInfo.liquidityPercent = BoringMath.to16(_liquidityPercent);
        launcherInfo.locktime = BoringMath.to32(_locktime);

        uint256 initalTokenAmount = market.getTotalTokens().mul(_liquidityPercent).div(LIQUIDITY_PRECISION);
        _safeTransferFrom(address(token2), msg.sender, initalTokenAmount);

        emit InitLiquidityLauncher(address(token1), address(token2), address(_factory), _admin);
    }

    receive() external payable {
        if(msg.sender != weth ){
             depositETH();
        }
    }

    /// @notice Deposits ETH to the contract.
    function depositETH() public payable {
        require(address(token1) == weth || address(token2) == weth, "PostAuction: Launcher not accepting ETH");
        if (msg.value > 0 ) {
            IWETH(weth).deposit{value : msg.value}();
        }
    }

    /**
     * @notice Deposits first Token to the contract.
     * @param _amount Number of tokens to deposit.
     */
    function depositToken1(uint256 _amount) external returns (bool success) {
        return _deposit( address(token1), msg.sender, _amount);
    }

    /**
     * @notice Deposits second Token to the contract.
     * @param _amount Number of tokens to deposit.
     */
    function depositToken2(uint256 _amount) external returns (bool success) {
        return _deposit( address(token2), msg.sender, _amount);
    }

    /**
     * @notice Deposits Tokens to the contract.
     * @param _amount Number of tokens to deposit.
     * @param _from Where the tokens to deposit will come from.
     * @param _token Token address.
     */
    function _deposit(address _token, address _from, uint _amount) internal returns (bool success) {
        require(!launcherInfo.launched, "PostAuction: Must first launch liquidity");
        require(launcherInfo.liquidityAdded == 0, "PostAuction: Liquidity already added");

        require(_amount > 0, "PostAuction: Token amount must be greater than 0");
        _safeTransferFrom(_token, _from, _amount);
        return true;
    }


    /**
     * @notice Checks if market wallet is set to this launcher
     */
    function marketConnected() public view returns (bool)  {
        return market.wallet() == address(this);
    }

    /**
     * @notice Finalizes Token sale and launches LP.
     * @return liquidity Number of LPs.
     */
    function finalize() external nonReentrant returns (uint256 liquidity) {
        // GP: Can we remove admin, let anyone can finalise and launch?
        // require(hasAdminRole(msg.sender) || hasOperatorRole(msg.sender), "PostAuction: Sender must be operator");
        require(marketConnected(), "PostAuction: Auction must have this launcher address set as the destination wallet");
        require(!launcherInfo.launched);

        if (!market.finalized()) {
            market.finalize();
        }
        require(market.finalized());

        launcherInfo.launched = true;
        if (!market.auctionSuccessful() ) {
            return 0;
        }

        /// @dev if the auction is settled in weth, wrap any contract balance 
        uint256 launcherBalance = address(this).balance;
        if (launcherBalance > 0 ) {
            IWETH(weth).deposit{value : launcherBalance}();
        }
        
        (uint256 token1Amount, uint256 token2Amount) =  getTokenAmounts();

        /// @dev cannot start a liquidity pool with no tokens on either side
        if (token1Amount == 0 || token2Amount == 0 ) {
            return 0;
        }

        address pair = factory.getPair(address(token1), address(token2));
        if(pair == address(0)) {
            createPool();
        }

        /// @dev add liquidity to pool via the pair directly
        _safeTransfer(address(token1), tokenPair, token1Amount);
        _safeTransfer(address(token2), tokenPair, token2Amount);
        liquidity = IUniswapV2Pair(tokenPair).mint(address(this));
        launcherInfo.liquidityAdded = BoringMath.to128(uint256(launcherInfo.liquidityAdded).add(liquidity));

        /// @dev if unlock time not yet set, add it.
        if (launcherInfo.unlock == 0 ) {
            launcherInfo.unlock = BoringMath.to64(block.timestamp + uint256(launcherInfo.locktime));
        }
        emit LiquidityAdded(liquidity);
    }


    function getTokenAmounts() public view returns (uint256 token1Amount, uint256 token2Amount) {
        token1Amount = getToken1Balance().mul(uint256(launcherInfo.liquidityPercent)).div(LIQUIDITY_PRECISION);
        token2Amount = getToken2Balance(); 

        uint256 tokenPrice = market.tokenPrice();  
        uint256 d2 = uint256(token2.decimals());
        uint256 maxToken1Amount = token2Amount.mul(tokenPrice).div(10**(d2));
        uint256 maxToken2Amount = token1Amount
                                    .mul(10**(d2))
                                    .div(tokenPrice);

        /// @dev if more than the max.
        if (token2Amount > maxToken2Amount) {
            token2Amount =  maxToken2Amount;
        } 
        /// @dev if more than the max.
        if (token1Amount > maxToken1Amount) {
            token1Amount =  maxToken1Amount;
        }

    }

    /**
     * @notice Withdraws LPs from the contract.
     * @return liquidity Number of LPs.
     */
    function withdrawLPTokens() external returns (uint256 liquidity) {
        require(hasAdminRole(msg.sender) || hasOperatorRole(msg.sender), "PostAuction: Sender must be operator");
        require(launcherInfo.launched, "PostAuction: Must first launch liquidity");
        require(block.timestamp >= uint256(launcherInfo.unlock), "PostAuction: Liquidity is locked");
        liquidity = IERC20(tokenPair).balanceOf(address(this));
        require(liquidity > 0, "PostAuction: Liquidity must be greater than 0");
        _safeTransfer(tokenPair, wallet, liquidity);
    }

    /// @notice Withraws deposited tokens and ETH from the contract to wallet.
    function withdrawDeposits() external {
        require(hasAdminRole(msg.sender) || hasOperatorRole(msg.sender), "PostAuction: Sender must be operator");
        require(launcherInfo.launched, "PostAuction: Must first launch liquidity");

        uint256 token1Amount = getToken1Balance();
        if (token1Amount > 0 ) {
            _safeTransfer(address(token1), wallet, token1Amount);
        }
        uint256 token2Amount = getToken2Balance();
        if (token2Amount > 0 ) {
            _safeTransfer(address(token2), wallet, token2Amount);
        }
    }

    // TODO     
    // GP: Sweep non relevant ERC20s / ETH


    //--------------------------------------------------------
    // Setter functions
    //--------------------------------------------------------


    /**
     * @notice Admin can set the wallet through this function.
     * @param _wallet Wallet is where funds will be sent.
     */
    function setWallet(address payable _wallet) external {
        require(hasAdminRole(msg.sender));
        require(_wallet != address(0), "Wallet is the zero address");

        wallet = _wallet;

        emit WalletUpdated(_wallet);
    }

    function cancelLauncher() external {
        require(hasAdminRole(msg.sender));
        require(!launcherInfo.launched);

        launcherInfo.launched = true;
        emit LauncherCancelled(msg.sender);

    }

    //--------------------------------------------------------
    // Helper functions
    //--------------------------------------------------------

    /**
     * @notice Creates new SLP pair through SushiSwap.
     */
    function createPool() public {
        factory.createPair(address(token1), address(token2));
    }

    //--------------------------------------------------------
    // Getter functions
    //--------------------------------------------------------

    /**
     * @notice Gets the number of first token deposited into this contract.
     * @return uint256 Number of WETH.
     */
    function getToken1Balance() public view returns (uint256) {
         return token1.balanceOf(address(this));
    }

    /**
     * @notice Gets the number of second token deposited into this contract.
     * @return uint256 Number of WETH.
     */
    function getToken2Balance() public view returns (uint256) {
         return token2.balanceOf(address(this));
    }

    /**
     * @notice Returns LP token address..
     * @return address LP address.
     */
    function getLPTokenAddress() public view returns (address) {
        return tokenPair;
    }
    /**
     * @notice Returns LP Token balance.
     * @return uint256 LP Token balance.
     */
    function getLPBalance() public view returns (uint256) {
         return IERC20(tokenPair).balanceOf(address(this));
    }


    //--------------------------------------------------------
    // Init functions
    //--------------------------------------------------------


    /**
     * @notice Decodes and hands auction data to the initAuction function.
     * @param _data Encoded data for initialization.
     */

    function init(bytes calldata _data) external payable {

    }

    function initLauncher(
        bytes calldata _data
    ) public {
        (
            address _market,
            address _factory,
            address _admin,
            address _wallet,
            uint256 _liquidityPercent,
            uint256 _locktime
        ) = abi.decode(_data, (
            address,
            address,
            address,
            address,
            uint256,
            uint256
        ));
        initAuctionLauncher( _market, _factory,_admin,_wallet,_liquidityPercent,_locktime);
    }

    /**
     * @notice Collects data to initialize the auction and encodes them.
     * @param _market Auction address for launcher.
     * @param _factory Uniswap V2 factory address.
     * @param _admin Contract owner address.
     * @param _wallet Withdraw wallet address.
     * @param _liquidityPercent Percentage of payment currency sent to liquidity pool.
     * @param _locktime How long the liquidity will be locked. Number of seconds.
     * @return _data All the data in bytes format.
     */
    function getLauncherInitData(
            address _market,
            address _factory,
            address _admin,
            address _wallet,
            uint256 _liquidityPercent,
            uint256 _locktime
    )
        external 
        pure
        returns (bytes memory _data)
    {
            return abi.encode(_market,
                                _factory,
                                _admin,
                                _wallet,
                                _liquidityPercent,
                                _locktime
            );
    }

}
