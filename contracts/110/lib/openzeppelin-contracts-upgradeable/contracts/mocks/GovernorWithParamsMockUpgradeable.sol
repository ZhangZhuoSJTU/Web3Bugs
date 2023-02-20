// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "../governance/extensions/GovernorCountingSimpleUpgradeable.sol";
import "../governance/extensions/GovernorVotesUpgradeable.sol";
import "../proxy/utils/Initializable.sol";

contract GovernorWithParamsMockUpgradeable is Initializable, GovernorVotesUpgradeable, GovernorCountingSimpleUpgradeable {
    event CountParams(uint256 uintParam, string strParam);

    function __GovernorWithParamsMock_init(string memory name_, IVotesUpgradeable token_) internal onlyInitializing {
        __EIP712_init_unchained(name_, version());
        __Governor_init_unchained(name_);
        __GovernorVotes_init_unchained(token_);
    }

    function __GovernorWithParamsMock_init_unchained(string memory, IVotesUpgradeable) internal onlyInitializing {}

    function quorum(uint256) public pure override returns (uint256) {
        return 0;
    }

    function votingDelay() public pure override returns (uint256) {
        return 4;
    }

    function votingPeriod() public pure override returns (uint256) {
        return 16;
    }

    function _getVotes(
        address account,
        uint256 blockNumber,
        bytes memory params
    ) internal view virtual override(GovernorUpgradeable, GovernorVotesUpgradeable) returns (uint256) {
        uint256 reduction = 0;
        // If the user provides parameters, we reduce the voting weight by the amount of the integer param
        if (params.length > 0) {
            (reduction, ) = abi.decode(params, (uint256, string));
        }
        // reverts on overflow
        return super._getVotes(account, blockNumber, params) - reduction;
    }

    function _countVote(
        uint256 proposalId,
        address account,
        uint8 support,
        uint256 weight,
        bytes memory params
    ) internal virtual override(GovernorUpgradeable, GovernorCountingSimpleUpgradeable) {
        if (params.length > 0) {
            (uint256 _uintParam, string memory _strParam) = abi.decode(params, (uint256, string));
            emit CountParams(_uintParam, _strParam);
        }
        return super._countVote(proposalId, account, support, weight, params);
    }

    function cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 salt
    ) public returns (uint256 proposalId) {
        return _cancel(targets, values, calldatas, salt);
    }

    /**
     * @dev This empty reserved space is put in place to allow future versions to add new
     * variables without shifting down storage in the inheritance chain.
     * See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
     */
    uint256[50] private __gap;
}
