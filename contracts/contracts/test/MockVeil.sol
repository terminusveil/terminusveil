// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Test double for $VEIL: a plain ERC-20 minted to the deployer. Never deployed.
contract MockVeil is ERC20 {
    constructor() ERC20("Mock Veil", "VEIL") {
        _mint(msg.sender, 1_000_000_000 ether);
    }
}
