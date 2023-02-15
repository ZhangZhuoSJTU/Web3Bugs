// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "./NFTXEligibility.sol";

interface Avastar {
    enum Generation {ONE, TWO, THREE, FOUR, FIVE}
    enum Series {PROMO, ONE, TWO, THREE, FOUR, FIVE}
    enum Gender {ANY, MALE, FEMALE}

    function getPrimeByTokenId(uint256 _tokenId) external view returns (
        uint256 tokenId,
        uint256 serial,
        uint256 traits,
        Generation generation,
        Series series,
        Gender gender,
        uint8 ranking
    );
}

contract NFTXAvastarRank60Eligibility is NFTXEligibility {

    function name() public pure override virtual returns (string memory) {    
        return "AvastarRank60";
    }

    function finalized() public view override virtual returns (bool) {    
        return true;
    }

   function targetAsset() public pure override virtual returns (address) {
        return 0xF3E778F839934fC819cFA1040AabaCeCBA01e049;
   }

    event NFTXEligibilityInit();

    function __NFTXEligibility_init_bytes(
        bytes memory /* configData */
    ) public override virtual initializer {
        __NFTXEligibility_init();
    }

    // Parameters here should mirror the config struct. 
    function __NFTXEligibility_init() public initializer {
        emit NFTXEligibilityInit();
    }

    function _checkIfEligible(
        uint256 _tokenId
    ) internal view override virtual returns (bool) {        
        (,,,,,,uint8 ranking) = Avastar(targetAsset()).getPrimeByTokenId(_tokenId);
        return ranking > 60;
    }
}
