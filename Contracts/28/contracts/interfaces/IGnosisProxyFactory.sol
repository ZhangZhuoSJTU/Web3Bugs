pragma solidity 0.6.12;
import "./ISafeGnosis.sol";
interface IGnosisProxyFactory {
    function createProxy(
        ISafeGnosis masterCopy, bytes memory data) external returns(ISafeGnosis proxy);

 
}

