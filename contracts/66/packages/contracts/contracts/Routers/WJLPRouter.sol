// SPDX-License-Identifier: UNLICENSED

pragma solidity 0.6.11;

import "../Interfaces/IYetiRouter.sol";
import "../Interfaces/IWAsset.sol";
import "../Interfaces/IJoeZapper.sol";
import "../Interfaces/IERC20.sol";
import "../Dependencies/SafeMath.sol";

contract WJLPRouter is IYetiRouter {
    using SafeMath for uint256;

    address internal activePoolAddress;
    address public JLPAddress;
    address public WJLPAddress;
    IJoeZapper public joeZapper;
    IWAsset public WJLP;
    address internal yusdTokenAddress;

    constructor(
        address _activePoolAddress,
        address _JLPAddress,
        address _WJLPAddress,
        address _joeZapperAddress,
        address _yusdTokenAddress
    ) public {
        activePoolAddress = _activePoolAddress;
        JLPAddress = _JLPAddress;
        WJLPAddress = _WJLPAddress;
        WJLP = IWAsset(_WJLPAddress);
        joeZapper = IJoeZapper(_joeZapperAddress);
        yusdTokenAddress = _yusdTokenAddress;
        // Approve the WJLP contract to take any of this contract's JLP tokens.
        IERC20(_WJLPAddress).approve(address(WJLP), 2**256 - 1);
    }

    // Converts any starting ERC20 into a wrapped JLP token and sends it to the ActivePool
    // If _startingTokenAddress (the starting token address) is the base JLP, then just wrap it and send.
    // If _startingTokenAddress is not the base JLP, then convert tokenAddress from _from into JLP and then wrap it and send
    // for this function endingTokenAddress is always the underlying JLP.
    function route(
        address _fromUser,
        address _startingTokenAddress,
        address _endingTokenAddress,
        uint256 _amount,
        uint256 _minSwapAmount
    ) public override returns (uint256) {
        require(_endingTokenAddress == WJLPAddress, "Ending token address must be WJLP");
        // JLP -> WJLP then send to active pool
        if (_startingTokenAddress == JLPAddress) {
            _wrapJLP(_amount, _fromUser, _fromUser);
            return _amount;
        }
        // Other ERC20 -> JLP -> WJLP then send to active pool
        else {
            IERC20(_startingTokenAddress).transferFrom(_fromUser, address(this), _amount);
            uint256 initial_balance = IERC20(JLPAddress).balanceOf(address(this));
            _zapInToken(_startingTokenAddress, _amount);
            uint256 post_balance = IERC20(JLPAddress).balanceOf(address(this));
            uint256 differenceJLP = post_balance.sub(initial_balance);
            require(differenceJLP >= _minSwapAmount, "Zap did not produce enough JLP");
            _wrapJLP(differenceJLP, address(this), _fromUser);
            return differenceJLP;
        }
    }

    function unRoute(
        address _fromUser,
        address _startingTokenAddress,
        address _endingTokenAddress,
        uint256 _amount,
        uint256 _minSwapAmount
    ) external override returns (uint256 _amountOut) {
        // todo
    }

    // takes the min swap amount in and uses avax passed in
    // function routeAVAX(
    //     address _fromUser,
    //     address _endingTokenAddress,
    //     uint256 _minSwapAmount
    // ) public payable override {
    //     uint256 initial_balance = IERC20(JLPAddress).balanceOf(address(this));
    //     _zapInAvax(msg.value);
    //     uint256 post_balance = IERC20(JLPAddress).balanceOf(address(this));
    //     uint256 differenceJLP = post_balance.sub(initial_balance);
    //     require(differenceJLP >= _minSwapAmount, "Zap did not produce enough JLP");
    //     _wrapJLP(differenceJLP, address(this), _fromUser);
    // }

    // Wraps the JLP that it has and turns it into WJLP. Sends directly to active pool
    function _wrapJLP(
        uint256 _amount,
        address _fromUser,
        address _owner
    ) internal {
        WJLP.wrap(_amount, address(this), activePoolAddress, _owner);
    }

    // takes avax and zaps it into the specific JLP token.
    function _zapInAvax(uint256 _amount) internal {
        // _to is the resultJLP
        joeZapper.zapIn{value: _amount}(JLPAddress);
    }

    // takes erc20 token and zaps it into the specific JLP token.
    function _zapInToken(address _startingTokenAddress, uint256 _amount) internal {
        // _to is the resultJLP
        joeZapper.zapInToken(_startingTokenAddress, _amount, JLPAddress);
    }
}
