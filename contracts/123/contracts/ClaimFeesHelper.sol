// SPDX-License-Identifier: MIT
pragma solidity ^0.8.11;

import { IERC20 } from "@openzeppelin/contracts-0.8/token/ERC20/IERC20.sol";
import { IFeeDistributor } from "./mocks/balancer/MockFeeDistro.sol";

interface IBooster {
    function earmarkFees(address _feeDistro) external returns (bool);
}

/**
 * @title   ClaimFeesHelper
 * @author  ConvexFinance
 * @notice  Claim vecrv fees and distribute
 * @dev     Allows anyone to call `claimFees` that will basically collect any 3crv and distribute to cvxCrv
 *          via the booster.
 */
contract ClaimFeesHelper {
    IBooster public immutable booster;
    address public immutable voterProxy;

    mapping(address => uint256) public lastTokenTimes;
    IFeeDistributor public feeDistro;

    /**
     * @param _booster      Booster.sol, e.g. 0xF403C135812408BFbE8713b5A23a04b3D48AAE31
     * @param _voterProxy   CVX VoterProxy e.g. 0x989AEb4d175e16225E39E87d0D97A3360524AD80
     * @param _feeDistro    FeeDistro e.g. 0xA464e6DCda8AC41e03616F95f4BC98a13b8922Dc
     */
    constructor(
        address _booster,
        address _voterProxy,
        address _feeDistro
    ) {
        booster = IBooster(_booster);
        voterProxy = _voterProxy;
        feeDistro = IFeeDistributor(_feeDistro);
    }

    /**
     * @dev Claims fees from fee claimer, and pings the booster to distribute
     */
    function claimFees(IERC20 _token) external {
        uint256 tokenTime = feeDistro.getTokenTimeCursor(_token);
        require(tokenTime > lastTokenTimes[address(_token)], "not time yet");

        uint256 bal = IERC20(_token).balanceOf(voterProxy);
        feeDistro.claimToken(voterProxy, _token);

        // Loop through until something is transferred
        while (IERC20(_token).balanceOf(voterProxy) <= bal) {
            feeDistro.claimToken(voterProxy, _token);
        }

        booster.earmarkFees(address(_token));
        lastTokenTimes[address(_token)] = tokenTime;
    }
}
