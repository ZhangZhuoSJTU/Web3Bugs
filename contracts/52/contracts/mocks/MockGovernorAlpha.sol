// SPDX-License-Identifier: UNLICENSED

pragma solidity =0.8.9;

import "../governance/GovernorAlpha.sol";

contract MockGovernorAlpha is GovernorAlpha {
    constructor(
        address guardian_,
        address xVader_,
        address feeReceiver_,
        uint256 feeAmount_,
        address council_
    )
        GovernorAlpha(
            guardian_,
            xVader_,
            feeReceiver_,
            feeAmount_,
            council_
        )
    {}

    function votingPeriod() public pure override returns (uint256) {
        return 50;
    }

    /// @notice mock function to get chain id from CHAINID opcode.
    /// Using ganache in truffle sets chainid but the a separate ganache or ganache in solidity-coverage
    /// does not set the CHAINID opcode and it default to 1, which results in web3.eth.getChainId and CHAINID opcode
    /// both returning different values.
    /// https://github.com/ethereum/web3.py/issues/1677
    function CHAINID() public view returns (uint256 chainId) {
        assembly {
            chainId := chainid()
        }
    }
}
