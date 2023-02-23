// SPDX-License-Identifier: AGPL-3.0

/**
                            .,;111;,.                                                                                                                                   
                        .:;1tffffffft1;:.                                                                                                                               
                    .:i1tfffffftttfffffft1i:,                                                                                                                           
               .,:i1tfffffft1i:,.,:i1tfffffftti;,.                                                                                                                      
           .,;ittfffffft1;:.         .:;1ttffffftt1;,.                                                                                                                  
       .:;1ttfftfftt1;,.                 .,;i1tffffftt1i:                                                                                                               
   ,:i1tttttttt1i:,.                          ,:i1ttfft;,    ..                                                                                                         
,i1tftttttt1i:.                                   .:;:    .;1tt1:                                                                                                       
1tttttt1;:.                   ,;i;,                     ,itttttf1.                                                                                                      
1ttttt;                     :ittttti:                .:1tttttt1:.       .:;;iiiiiiiiii;;;;:,.         .:;;iiiiiiiiii;;;;:,.               .,:;;iiiiiiiii;;:,.           
1ttttt;                  .;1ttttttttt1;.           ,ittttttti,          ;11111111111111111111i;,     .;11111111111111111111i;,         .:;i111111111111111111i;,        
1ttttt;                ,itttttt1i1tttttti,      .:itttttt1:.   .,       iiiiiii,,,,,,,,:;i1iii11;.   .iiiiiii,,,,,,,,:;i1iii11;.     .:i11ii1ii;:,,,,,,:;i1iii11i,      
1ttttt;             .:1tttttt1:. .:1tttti,    ,;1tttttti,    ,;11.      iiiiiii          .;iiiii1:   .iiiiiii          .;iiiii1:    ,i1iiiii;.           .,;1iii11;     
1ttt1t;           ,;1tt1ttti,       ,;;.    ,ittt1tt1;.    ,ittt1.      iiiiiii           .iiiii1;   .iiiiiii           .iiiii1;   .i1iiiii,                :1iiii1;    
1t1t1t;         ,ittt1tt1;.              .;1tt1ttti:      ,ttt1t1.      iiiiiii          .;iiiii1:   .iiiiiii          .;iiiii1:   :1iiii1:                  ;iiiiii    
1t111t;      .;1tt11tti:               ,i1tt1tt1;,        ,1111ti.      iiiiiii,,,,,,,::;i1iii11;.   .iiiiiii,,,,,,,::;i1iii11;.   :1iiii1:                  ;1iiiii    
i1tt1;.    ,;1t11tt1;,    ,:.       .:1tt11tti:.          ,1111ti.      iiiiiii11111111111111i;,     .iiiiiii11111111111111i;,     ,1iiiiii.                ,iiiii1i    
1ti:.   .:itt11tti:.   .:itt1;,   ,;1t111t1;,             ,1111ti.      iiiiiii;;;;;;;;;;;:,.        .iiiiiii;;;;;;;;;;;:,.         :11iiiii,             .:iiiii1i.    
:,    ,;1t111t1;,      ,1tt11t1i;i1t11tti:.               ,11111i.      iiiiiii                      .iiiiiii                        ,i11iii1i:,..    ..,;i1iii11;.     
    ,i1t1111i:.          ,;1t111t111t1i,                  ,11111i.      i1iii1i                      .i1iii1i                          ,;i111111iiiiiii1111111i;.       
 .:i111111i,               .:1111111:.                    ,11111i.      :iiiii,                       :iiiii,                            .,:;iii11111111iii;:,          
;1111111;,                    ,;i;,                    .,:i11111i.        ...                           ...                                   ..,,,,,,,,..              
:i111i:.   .,.                                     .,;i111111111:                                                                                                       
  .,,    ,;111i;:,.                           .,:;i11111111i;:.                                                                                                         
        .i111111111i:,.                   .,:;i11111111i:,.                                                                                                             
           .:;i11111111i;,.           .,;i11111111i;:,.                                                                                                                 
               .,;i11111111i;:.   .:;i11111111i;:.                                                                                                                      
                   .,:;i1111111iii1111111ii:,.                                                                                                                          
                       .,:;i111111111i;:,.                                                                                                                              
                            .:;iii;:.                                                                                                                                   
*/

pragma solidity =0.8.7;

import "./interfaces/IPPO.sol";
//solhint-disable-next-line max-line-length
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20BurnableUpgradeable.sol";
//solhint-disable-next-line max-line-length
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
import "prepo-shared-contracts/contracts/SafeOwnableUpgradeable.sol";

contract PPO is
  IPPO,
  SafeOwnableUpgradeable,
  ERC20BurnableUpgradeable,
  ERC20PermitUpgradeable
{
  ITransferHook private transferHook;

  function initialize(string memory _name, string memory _symbol)
    public
    initializer
  {
    __Ownable_init();
    __ERC20_init(_name, _symbol);
    __ERC20Permit_init(_name);
  }

  function setTransferHook(ITransferHook _newTransferHook)
    external
    override
    onlyOwner
  {
    transferHook = _newTransferHook;
  }

  function mint(address _recipient, uint256 _amount)
    external
    override
    onlyOwner
  {
    _mint(_recipient, _amount);
  }

  function burn(uint256 _amount)
    public
    override(IPPO, ERC20BurnableUpgradeable)
  {
    super.burn(_amount);
  }

  function burnFrom(address _account, uint256 _amount)
    public
    override(IPPO, ERC20BurnableUpgradeable)
  {
    super.burnFrom(_account, _amount);
  }

  function transferFromWithPermit(
    address _from,
    address _to,
    uint256 _amount,
    uint256 _deadline,
    uint8 _v,
    bytes32 _r,
    bytes32 _s
  ) external override {
    permit(_from, _msgSender(), _amount, _deadline, _v, _r, _s);
    transferFrom(_from, _to, _amount);
  }

  function getTransferHook() external view override returns (ITransferHook) {
    return transferHook;
  }

  function _beforeTokenTransfer(
    address _from,
    address _to,
    uint256 _amount
  ) internal override {
    require(address(transferHook) != address(0), "Transfer hook not set");
    transferHook.hook(_from, _to, _amount);
    super._beforeTokenTransfer(_from, _to, _amount);
  }
}
