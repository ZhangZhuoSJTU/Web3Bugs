// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "../ProposalFactory.sol";
import "../../facades/LimboLike.sol";
import "../../facades/LimboDAOLike.sol";

/**
* @author Justin Goro
* @notice Occasionally tokens are added to Limbo that are not elligible for staking. This can either happen by mistake or because tokens earn other tokens.
* This proposal allows the orderly withdrawal of such tokens. 
* If it is known in advance that a token earns tokens such as a rebase token, it's better to use a proxy wrapper token via the proxy registry.
*/
contract WithdrawERC20Proposal is Proposal {
    struct Parameters {
        address token;
        address destination;
    }
    Parameters params;
    LimboLike limbo;

    constructor(address _dao) Proposal(_dao, "Withdraw errant tokens") {
        (address _limbo, , , , , , ) = LimboDAOLike(_dao).domainConfig();
        limbo = LimboLike(_limbo);
    }

    function parameterize(address token, address destination)
        public
        notCurrent
    {
        params.token = token;
        params.destination = destination;
    }

    function execute() internal override returns (bool) {
        limbo.withdrawERC20(params.token, params.destination);
        return true;
    }
}
