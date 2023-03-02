//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IReferrals.sol";

contract Referrals is Ownable, IReferrals {

    bool private isInit;

    address public protocol;

    mapping(bytes32 => address) private _referral;
    mapping(address => bytes32) private _referred;

    /**
    * @notice used by any address to create a ref code
    * @param _hash hash of the string code
    */
    function createReferralCode(bytes32 _hash) external {
        require(_referral[_hash] == address(0), "Referral code already exists");
        _referral[_hash] = _msgSender();
        emit ReferralCreated(_msgSender(), _hash);
    }

    /**
    * @notice set the ref data
    * @dev only callable by trading
    * @param _referredTrader address of the trader
    * @param _hash ref hash
    */
    function setReferred(address _referredTrader, bytes32 _hash) external onlyProtocol {
        if (_referred[_referredTrader] != bytes32(0)) {
            return;
        }
        if (_referredTrader == _referral[_hash]) {
            return;
        }
        _referred[_referredTrader] = _hash;
        emit Referred(_referredTrader, _hash);
    }

    function getReferred(address _trader) external view returns (bytes32) {
        return _referred[_trader];
    }

    function getReferral(bytes32 _hash) external view returns (address) {
        return _referral[_hash];
    }

    // Owner

    function setProtocol(address _protocol) external onlyOwner {
        protocol = _protocol;
    }

    /**
    * @notice deprecated
    */
    function initRefs(
        address[] memory _codeOwners,
        bytes32[] memory _ownedCodes,
        address[] memory _referredA,
        bytes32[] memory _referredTo
    ) external onlyOwner {
        require(!isInit);
        isInit = true;
        uint _codeOwnersL = _codeOwners.length;
        uint _referredAL = _referredA.length;
        for (uint i=0; i<_codeOwnersL; i++) {
            _referral[_ownedCodes[i]] = _codeOwners[i];
        }
        for (uint i=0; i<_referredAL; i++) {
            _referred[_referredA[i]] = _referredTo[i];
        }
    }

    // Modifiers

    modifier onlyProtocol() {
        require(_msgSender() == address(protocol), "!Protocol");
        _;
    }

    event ReferralCreated(address _referrer, bytes32 _hash);
    event Referred(address _referredTrader, bytes32 _hash);

}