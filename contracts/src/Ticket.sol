// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract Ticket {
    mapping(uint256 => address) public owners;
    mapping(address => uint256) public balances;
    
    uint256 private _tokenIdCounter = 1;
    
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    
    function mint(address to) public returns (uint256) {
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        
        owners[tokenId] = to;
        balances[to]++;
        
        emit Transfer(address(0), to, tokenId);
        
        return tokenId;
    }
    
    function ownerOf(uint256 tokenId) public view returns (address) {
        return owners[tokenId];
    }
    
    function balanceOf(address owner) public view returns (uint256) {
        return balances[owner];
    }
    
    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter - 1;
    }
}