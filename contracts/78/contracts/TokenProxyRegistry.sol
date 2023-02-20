// SPDX-License-Identifier: MIT
pragma solidity 0.8.4;
import "./DAO/Governable.sol";

///@author Justin Goro
///@title Token Proxy Registry for exotic token registration on Limbo
/**@notice
Exotic tokens may cause Limbo to act unpredictably. The token type that inspired the writing of this class is the rebase token.
Since Limbo keeps track of balances, a token who's balance changes dynamically will fall our of sync with Limbo balances.
By using a proxy token, we can neutralize balance changes within limbo without changing Limbo code. If we were to force Limbo to dynamically account for changing 
balances then we might impose additional gas costs on all users. This scenario offloads additional gas consumption to stakers of rebase tokens only. From a security standpoint, arbitrary rebase logic
could open up unanticipated security holes. This proxy forces governance to neutralize such holes on a per token basis, allowing Limbo to adapt over time without requiring disruptive changes to the protocol.
*/
contract TokenProxyRegistry is Governable {
    struct TokenConfig{
        address baseToken;
        bool migrateBaseToBehodler;
    }
    mapping (address=>TokenConfig) public tokenProxy;

    constructor (address dao) Governable(dao){

    }

    function setProxy (address baseToken, address proxy, bool migrateBase) public onlySuccessfulProposal {
        tokenProxy[proxy] = TokenConfig(baseToken, migrateBase);
    }
}