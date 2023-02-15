//SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IL2LPTGateway {
    event DepositFinalized(
        address indexed _l1Token,
        address indexed _from,
        address indexed _to,
        uint256 _amount
    );

    event WithdrawalInitiated(
        address _l1Token,
        address indexed _from,
        address indexed _to,
        uint256 indexed _l2ToL1Id,
        uint256 _exitNum,
        uint256 _amount
    );

    function outboundTransfer(
        address _token,
        address _to,
        uint256 _amount,
        bytes calldata _data
    ) external returns (bytes memory);

    function finalizeInboundTransfer(
        address _token,
        address _from,
        address _to,
        uint256 _amount,
        bytes calldata _data
    ) external;

    // if token is not supported this should return 0x0 address
    function calculateL2TokenAddress(address _l1Token)
        external
        view
        returns (address);

    // used by router
    function counterpartGateway() external view returns (address);
}
