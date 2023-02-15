pragma solidity 0.6.12;

// Interface for performing a swap within the sYETI contract 
// Takes in YUSD and swaps for YETI

interface IsYETIRouter {
    // Must require that the swap went through successfully with at least min yeti out amounts out. 
    function swap(uint256 _YUSDAmount, uint256 _minYETIOut, address _to) external returns (uint256[] memory amounts);
}