// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.3;
import "./interfaces/iDAO.sol";
import "./Pool.sol";  

contract PoolFactory { 
    address public BASE;
    address public WBNB;
    address public DEPLOYER;
    uint public curatedPoolSize;    // Max amount of pools that can be curated status
    address[] public arrayPools;    // Array of all deployed pools
    address[] public arrayTokens;   // Array of all listed tokens

    mapping(address=>address) private mapToken_Pool;
    mapping(address=>bool) public isListedPool;
    mapping(address=>bool) public isCuratedPool;

    event CreatePool(address indexed token, address indexed pool);
    event AddCuratePool(address indexed pool, bool Curated);
    event RemoveCuratePool(address indexed pool, bool Curated);

    // Restrict access
    modifier onlyDAO() {
        require(msg.sender == DEPLOYER || msg.sender == _DAO().DAO());
        _;
    }

    constructor (address _base, address _wbnb) {
        BASE = _base;
        WBNB = _wbnb;
        curatedPoolSize = 10;
        DEPLOYER = msg.sender;
    }

    function _DAO() internal view returns(iDAO) {
        return iBASE(BASE).DAO();
    }

    // Can purge deployer once DAO is stable and final
    function purgeDeployer() external onlyDAO {
        DEPLOYER = address(0);
    }

    // Anyone can create a pool and add liquidity at the same time
    function createPoolADD(uint256 inputBase, uint256 inputToken, address token) external payable returns(address pool){
        require(getPool(token) == address(0)); // Must be a valid token
        require((inputToken > 0 && inputBase >= (10000*10**18)), "!min"); // User must add at least 10,000 SPARTA liquidity & ratio must be finite
        Pool newPool; address _token = token;
        if(token == address(0)){_token = WBNB;} // Handle BNB -> WBNB
        require(_token != BASE && iBEP20(_token).decimals() == 18); // Token must not be SPARTA & it's decimals must be 18
        newPool = new Pool(BASE, _token); // Deploy new pool
        pool = address(newPool); // Get address of new pool
        mapToken_Pool[_token] = pool; // Record the new pool address in PoolFactory
        _handleTransferIn(BASE, inputBase, pool); // Transfer SPARTA liquidity to new pool
        _handleTransferIn(token, inputToken, pool); // Transfer TOKEN liquidity to new pool
        arrayPools.push(pool); // Add pool address to the pool array
        arrayTokens.push(_token); // Add token to the listed array
        isListedPool[pool] = true; // Record pool as currently listed
        Pool(pool).addForMember(msg.sender); // Perform the liquidity-add for the user
        emit CreatePool(token, pool);
        return pool;
    }

    // Can create pools initially with no liquidity (not public)
    function createPool(address token) external onlyDAO returns(address pool){
        require(getPool(token) == address(0)); // Must be a valid token
        Pool newPool; address _token = token;
        if(token == address(0)){_token = WBNB;} // Handle BNB -> WBNB
        newPool = new Pool(BASE, _token); // Deploy new pool
        pool = address(newPool); // Get address of new pool
        mapToken_Pool[_token] = pool; // Record the new pool address in PoolFactory
        arrayPools.push(pool); // Add pool address to the pool array
        arrayTokens.push(_token); // Add token to the listed array
        isListedPool[pool] = true; // Record pool as currently listed
        emit CreatePool(token, pool);
        return pool;
    }

    // Add pool to the Curated list, enabling it's synths & dividends & dao/vault weight
    function addCuratedPool(address token) external onlyDAO {
        require(token != BASE); // Token must not be SPARTA
        address _pool = getPool(token); // Get pool address
        require(isListedPool[_pool] == true); // Pool must be valid
        require(curatedPoolCount() < curatedPoolSize, "maxCurated"); // Must be room in the Curated list
        isCuratedPool[_pool] = true; // Record pool as Curated
        emit AddCuratePool(_pool, isCuratedPool[_pool]);
    }

    // Remove pool from the Curated list
    function removeCuratedPool(address token) external onlyDAO {
        require(token != BASE); // Token must not be SPARTA
        address _pool = getPool(token); // Get pool address
        require(isCuratedPool[_pool] == true); // Pool must be Curated
        isCuratedPool[_pool] = false; // Record pool as not curated
        emit RemoveCuratePool(_pool, isCuratedPool[_pool]);
    }

    function curatedPoolCount() internal view returns (uint){
        uint cPoolCount; 
        for(uint i = 0; i< arrayPools.length; i++){
            if(isCuratedPool[arrayPools[i]] == true){
                cPoolCount += 1;
            }
        }
        return cPoolCount;
    }

    // Transfer assets into new pool
    function _handleTransferIn(address _token, uint256 _amount, address _pool) internal returns(uint256 actual){
        if(_amount > 0) {
            uint startBal = iBEP20(_token).balanceOf(_pool); 
            iBEP20(_token).transferFrom(msg.sender, _pool, _amount); 
            actual = iBEP20(_token).balanceOf(_pool) - (startBal);
        }
    }

    //======================================HELPERS========================================//

    function getPool(address token) public view returns(address pool){
        if(token == address(0)){
            pool = mapToken_Pool[WBNB];   // Handle BNB
        } else {
            pool = mapToken_Pool[token];  // Handle normal token
        } 
        return pool;
    }

    function isPool(address pool) external view returns (bool){
        if(isListedPool[pool] == true){
            return true;
        }
        return  false;
    }

    function poolCount() external view returns(uint256){
        return arrayPools.length;
    }

    function tokenCount() external view returns(uint256){
        return arrayTokens.length;
    }

    function getToken(uint256 i) external view returns(address){
        return arrayTokens[i];
    }

    function getPoolArray(uint256 i) external view returns(address){
        return arrayPools[i];
    }
}