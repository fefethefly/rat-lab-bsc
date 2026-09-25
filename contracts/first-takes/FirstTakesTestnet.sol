// SPDX-License-Identifier: MIT
pragma solidity 0.8.30;
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @dev Immutable data in runtime bytecode, preceded by STOP. Not executable artwork.
contract TakeData {
    constructor(bytes memory content) {
        require(content.length > 0 && content.length <= 23000, "data size");
        bytes memory runtime = abi.encodePacked(hex"00", content);
        assembly { return(add(runtime, 32), mload(runtime)) }
    }
}

/// @notice Test-only archival prototype. No auction, payments, royalties or production editions.
contract FirstTakesTestnet is ERC721 {
    using Strings for uint256;
    uint256 public constant MAX_SUPPLY = 16;
    address public immutable issuer;
    uint256 public totalSupply;
    mapping(bytes32 => bool) public archivedSource;
    struct Work { bytes32 sourceHash; bytes32 scoreHash; bytes32 wavHash; bytes32 htmlHash; bytes32 svgHash; address player; address cover; string title; bytes score; }
    mapping(uint256 => Work) private works;
    event Archived(uint256 indexed tokenId, bytes32 indexed sourceHash, bytes32 scoreHash, bytes32 wavHash);
    constructor() ERC721("RAT LAB First Takes TEST", "RATTEST") {
        require(block.chainid == 97 || block.chainid == 31337, "test chains only");
        issuer = msg.sender;
    }
    function archive(address recipient, bytes32 sourceHash, bytes32 scoreHash, bytes32 wavHash, bytes calldata score, bytes calldata html, bytes calldata svg, string calldata title) external returns (uint256 tokenId) {
        require(msg.sender == issuer, "issuer only");
        require(totalSupply < MAX_SUPPLY, "edition full");
        require(sourceHash != bytes32(0) && wavHash != bytes32(0) && !archivedSource[sourceHash], "duplicate or empty source");
        require(score.length > 0 && score.length <= 640 && score.length % 10 == 0 && sha256(score) == scoreHash, "invalid score");
        bytes memory nameBytes = bytes(title);
        require(nameBytes.length > 0 && nameBytes.length <= 48, "title size");
        for (uint256 i; i < nameBytes.length; i++) {
            bytes1 c = nameBytes[i];
            require((c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a) || (c >= 0x30 && c <= 0x39) || c == 0x20 || c == 0x2d || c == 0x2e, "title characters");
        }
        archivedSource[sourceHash] = true;
        tokenId = ++totalSupply;
        works[tokenId] = Work(sourceHash,scoreHash,wavHash,sha256(html),sha256(svg),address(new TakeData(html)),address(new TakeData(svg)),title,score);
        _safeMint(recipient,tokenId);
        emit Archived(tokenId,sourceHash,scoreHash,wavHash);
    }
    function work(uint256 id) external view returns (Work memory) { _requireOwned(id); return works[id]; }
    function scoreData(uint256 id) external view returns (bytes memory) { _requireOwned(id); return works[id].score; }
    function playerHTML(uint256 id) public view returns (bytes memory) { _requireOwned(id); return readData(works[id].player); }
    function coverSVG(uint256 id) public view returns (bytes memory) { _requireOwned(id); return readData(works[id].cover); }
    function readData(address location) private view returns (bytes memory result) {
        uint256 length = location.code.length - 1;
        result = new bytes(length);
        assembly { extcodecopy(location,add(result,32),1,length) }
    }
    function tokenURI(uint256 id) public view override returns (string memory) {
        _requireOwned(id);
        return string.concat("data:application/json;base64,",Base64.encode(bytes(string.concat(
            '{"name":"TEST / ',works[id].title,' #',id.toString(),
            '","description":"Test-only behavioral music archive. No monetary value, production edition or autonomous-composition claim. Source hash is an issuer attestation, not on-chain inference verification.","image":"data:image/svg+xml;base64,',Base64.encode(coverSVG(id)),
            '","animation_url":"data:text/html;base64,',Base64.encode(playerHTML(id)),
            '","attributes":[{"trait_type":"Network purpose","value":"TEST ONLY"},{"trait_type":"Mapping","value":"trajectory-keys-v1"}]}'
        ))));
    }
}
