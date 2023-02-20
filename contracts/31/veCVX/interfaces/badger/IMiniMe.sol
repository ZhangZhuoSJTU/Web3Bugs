// SPDX-License-Identifier: MIT

// SPDX-License-Identifier: MIT
pragma solidity >=0.5.0 <0.8.0;

interface IMiniMe {
    event ClaimedTokens(
        address indexed _token,
        address indexed _controller,
        uint256 _amount
    );
    event Transfer(address indexed _from, address indexed _to, uint256 _amount);
    event NewCloneToken(address indexed _cloneToken, uint256 _snapshotBlock);
    event Approval(
        address indexed _owner,
        address indexed _spender,
        uint256 _amount
    );

    function claimTokens(address _token) external;

    function enableTransfers(bool _transfersEnabled) external;

    function generateTokens(address _owner, uint256 _amount)
        external
        returns (bool);

    function destroyTokens(address _owner, uint256 _amount)
        external
        returns (bool);
}
