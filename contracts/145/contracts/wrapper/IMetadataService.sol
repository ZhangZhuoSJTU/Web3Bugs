pragma solidity >=0.8.4;

interface IMetadataService {
    function uri(uint256) external view returns (string memory);
}
