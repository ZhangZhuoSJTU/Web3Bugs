// SPDX-License-Identifier: MIT
pragma solidity >= 0.6.12;

interface INFTOracle {
    /// @notice Get the latest exchange rate.
    /// @param pair address of the NFTPair calling the oracle
    /// @param tokenId tokenId of the NFT in question 
    /// @return success if no valid (recent) rate is available, return false else true.
    /// @return rate The rate of the requested asset / pair / pool.
    function get(address pair, uint256 tokenId) external returns (bool success, uint256 rate);

    /// @notice Check the last exchange rate without any state changes.
    /// @param pair address of the NFTPair calling the oracle
    /// @param tokenId tokenId of the NFT in question 
    /// @return success if no valid (recent) rate is available, return false else true.
    /// @return rate The rate of the requested asset / pair / pool.
    function peek(address pair, uint256 tokenId) external view returns (bool success, uint256 rate);

    /// @notice Check the current spot exchange rate without any state changes. For oracles like TWAP this will be different from peek().
    /// @param pair address of the NFTPair calling the oracle
    /// @param tokenId tokenId of the NFT in question 
    /// (string memory collateralSymbol, string memory assetSymbol, uint256 division) = abi.decode(data, (string, string, uint256));
    /// @return rate The rate of the requested asset / pair / pool.
    function peekSpot(address pair, uint256 tokenId) external view returns (uint256 rate);

    /// @notice Returns a human readable (short) name about this oracle.
    /// @param pair address of the NFTPair calling the oracle
    /// @param tokenId tokenId of the NFT in question 
    /// @return (string) A human readable symbol name about this oracle.
    function symbol(address pair, uint256 tokenId) external view returns (string memory);

    /// @notice Returns a human readable name about this oracle.
    /// @param pair address of the NFTPair calling the oracle
    /// @param tokenId tokenId of the NFT in question 
    /// @return (string) A human readable name about this oracle.
    function name(address pair, uint256 tokenId) external view returns (string memory);
}
