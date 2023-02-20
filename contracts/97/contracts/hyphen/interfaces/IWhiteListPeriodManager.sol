// SPDX-License-Identifier: MIT
pragma solidity 0.8.0;

interface IWhiteListPeriodManager {
    function areWhiteListRestrictionsEnabled() external view returns (bool);

    function beforeLiquidityAddition(
        address _lp,
        address _token,
        uint256 _amount
    ) external;

    function beforeLiquidityRemoval(
        address _lp,
        address _token,
        uint256 _amount
    ) external;

    function beforeLiquidityTransfer(
        address _from,
        address _to,
        address _token,
        uint256 _amount
    ) external;

    function getMaxCommunityLpPositon(address _token) external view returns (uint256);

    function initialize(
        address _trustedForwarder,
        address _liquidityProviders,
        address _tokenManager
    ) external;

    function isExcludedAddress(address) external view returns (bool);

    function isTrustedForwarder(address forwarder) external view returns (bool);

    function owner() external view returns (address);

    function paused() external view returns (bool);

    function perTokenTotalCap(address) external view returns (uint256);

    function perTokenWalletCap(address) external view returns (uint256);

    function renounceOwnership() external;

    function setAreWhiteListRestrictionsEnabled(bool _status) external;

    function setCap(
        address _token,
        uint256 _totalCap,
        uint256 _perTokenWalletCap
    ) external;

    function setCaps(
        address[] memory _tokens,
        uint256[] memory _totalCaps,
        uint256[] memory _perTokenWalletCaps
    ) external;

    function setIsExcludedAddressStatus(address[] memory _addresses, bool[] memory _status) external;

    function setLiquidityProviders(address _liquidityProviders) external;

    function setPerTokenWalletCap(address _token, uint256 _perTokenWalletCap) external;

    function setTokenManager(address _tokenManager) external;

    function setTotalCap(address _token, uint256 _totalCap) external;

    function transferOwnership(address newOwner) external;
}
