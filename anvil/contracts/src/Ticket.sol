// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/// @dev EIP-5192 Minimal Soulbound NFT
interface IERC5192 {
    /// Emitted when the locking status is changed to locked.
    event Locked(uint256 tokenId);
    /// Emitted when the locking status is changed to unlocked.
    event Unlocked(uint256 tokenId);
    /// Returns true if the token is locked.
    function locked(uint256 tokenId) external view returns (bool);
}

contract TicketSBT is ERC721, Ownable, IERC5192 {
    using Strings for uint256;

    error SoulBoundTokenTransferBlocked();

    uint256 private _id;
    string private _base;

    mapping(uint256 => bool) private _locked; // always true after mint

    constructor(string memory name_, string memory symbol_, string memory baseURI_) ERC721(name_, symbol_) Ownable(msg.sender) {
        _base = baseURI_;
    }

    // ----- ERC721 hook to block all transfers -----
    function _update(address to, uint256 tokenId, address auth) internal virtual override returns (address) {
        address from = _ownerOf(tokenId);

        // Allow minting (from == address(0)) and burning (to == address(0))
        if (from != address(0) && to != address(0)) {
            revert SoulBoundTokenTransferBlocked();
        }

        return super._update(to, tokenId, auth);
    }

    // ----- Block approvals -----
    function approve(address, uint256) public virtual override {
        revert SoulBoundTokenTransferBlocked();
    }

    function setApprovalForAll(address, bool) public virtual override {
        revert SoulBoundTokenTransferBlocked();
    }

    // ----- Mint / Burn -----
    function mint(address to) external onlyOwner returns (uint256 tokenId) {
        tokenId = ++_id;
        _safeMint(to, tokenId);       // ERC721Receiver 체크 포함
        _locked[tokenId] = true;
        emit Locked(tokenId);
    }

    function burn(uint256 tokenId) external onlyOwner {
        _burn(tokenId);
        delete _locked[tokenId];
    }

    // ----- EIP-5192 -----
    function locked(uint256 tokenId) external view override returns (bool) {
        _requireOwned(tokenId);
        return _locked[tokenId];
    }

    // ----- Metadata -----
    function _baseURI() internal view override returns (string memory) {
        return _base;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        string memory base = _baseURI();
        return bytes(base).length == 0 ? "" : string(abi.encodePacked(base, tokenId.toString(), ".json"));
    }

    // ----- ERC165 -----
    function supportsInterface(bytes4 interfaceId) public view override(ERC721) returns (bool) {
        // IERC5192 = 0xb45a3c0e
        return interfaceId == 0xb45a3c0e || super.supportsInterface(interfaceId);
    }

    // ----- Additional utility functions -----
    function totalSupply() public view returns (uint256) {
        return _id;
    }
}