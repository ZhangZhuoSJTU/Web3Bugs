// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.3;
import "./Synth.sol";  

contract SynthFactory { 
    address public BASE;
    address public WBNB;
    address public DEPLOYER;

    address[] public arraySynths; // Array of all deployed synths
    mapping(address => address) private mapToken_Synth;
    mapping(address => bool) public isSynth;
    event CreateSynth(address indexed token, address indexed pool);

    constructor (address _base, address _wbnb) {
        BASE = _base;
        WBNB = _wbnb;
        DEPLOYER = msg.sender; 
    }

    // Restrict access
    modifier onlyDAO() {
        require(msg.sender == DEPLOYER, "!DAO");
        _;
    }

    function _DAO() internal view returns(iDAO) {
        return iBASE(BASE).DAO();
    }

    // Can purge deployer once DAO is stable and final
    function purgeDeployer() external onlyDAO {
        DEPLOYER = address(0);
    }

    // Anyone can create a synth if it's pool is curated
    function createSynth(address token) external returns(address synth){
        require(getSynth(token) == address(0), "exists"); // Synth must not already exist
        address _pool = iPOOLFACTORY(_DAO().POOLFACTORY()).getPool(token); // Get pool address
        require(iPOOLFACTORY(_DAO().POOLFACTORY()).isCuratedPool(_pool) == true, "!curated"); // Pool must be Curated
        Synth newSynth; address _token = token;
        if(token == address(0)){_token = WBNB;} // Handle BNB -> WBNB
        newSynth = new Synth(BASE, _token); // Deploy synth asset contract
        synth = address(newSynth); // Get new synth's address
        addSynth(_token, synth); // Record new synth contract with the SynthFactory
        emit CreateSynth(token, synth);
        return synth;
    }

    // Record synth with the SynthFactory
    function addSynth(address _token, address _synth) internal {
        require(_token != BASE); // Must not be SPARTA
        mapToken_Synth[_token] = _synth; // Record synth address
        arraySynths.push(_synth); // Add synth address to the array
        isSynth[_synth] = true; // Record synth as valid
    }

    //================================ Helper Functions ==================================//
    
    function getSynth(address token) public view returns(address synth){
        if(token == address(0)){
            synth = mapToken_Synth[WBNB];   // Handle BNB
        } else {
            synth = mapToken_Synth[token];  // Handle normal token
        } 
        return synth;
    }

    function synthCount() external view returns(uint256){
        return arraySynths.length;
    }

    function getSynthsArray(uint256 i) external view returns(address){
        return arraySynths[i];
    }
}