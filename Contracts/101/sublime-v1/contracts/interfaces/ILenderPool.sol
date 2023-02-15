// SPDX-License-Identifier: MIT
pragma solidity 0.7.6;

interface ILenderPool {
    /**
     * @notice emitted when lender withdraws from pool of poole-credit-lines
     * @param amount amount that lender withdraws from borrow pool
     * @param lenderAddress address to which amount is withdrawn
     */
    event LiquidityWithdrawn(uint256 amount, address indexed lenderAddress);

    function create(
        uint256 _id,
        address _verifier,
        address _token,
        address _strategy,
        uint256 _borrowLimit,
        uint256 _minBorrowAmount,
        uint256 _collectionPeriod,
        bool _areTokensTransferable
    ) external;

    function start(uint256 _id) external;

    function borrowed(uint256 _id, uint256 _sharesBorrowed) external;

    function repaid(
        uint256 _id,
        uint256 _sharesRepaid,
        uint256 _interestShares
    ) external;

    function requestCancelled(uint256 _id) external;

    function terminate(uint256 id, address to) external;
}
