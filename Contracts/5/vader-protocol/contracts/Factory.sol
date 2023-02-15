// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.3;

import "./Synth.sol"; 

// Factory Contract
contract Factory {

    bool private inited;
    address public VADER;
    address public USDV;
    address public POOLS;

    address[] public arraySynths;
    mapping(address => address) public getSynth;
    mapping(address => bool) public isSynth;

    event CreateSynth(address indexed token, address indexed pool);

    modifier onlyPOOLS() {
        require(msg.sender == POOLS, "!POOLS");
        _;
    }
    
    constructor(){
    }
    function init(address _pool) public {
        require(inited == false);
        inited = true;
        POOLS = _pool;
    }

    //Create a synth asset
    function deploySynth(address token) external onlyPOOLS returns(address synth) {
        require(getSynth[token] == address(0), "CreateErr");
        Synth newSynth;
        newSynth = new Synth(token);  
        synth = address(newSynth);
        _addSynth(token, synth);
        emit CreateSynth(token, synth);
    }

    function mintSynth(address synth, address member, uint amount) external onlyPOOLS returns(bool) {
         Synth(synth).mint(member, amount); 
        return true;
    }

    // function getSynth(address token) public view returns (address synth){
    //     return mapToken_Synth[token];
    // }
    // function isSynth(address token) public view returns (bool _isSynth){
    //     if(_isListedSynth[token] == true){
    //         return true;
    //     }
    // }

    function _addSynth(address _token, address _synth) internal {
        getSynth[_token] = _synth;
        arraySynths.push(_synth); 
        isSynth[_synth] = true;
    }

}