// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface IVeilPassBuy {
    function buy() external;
}

/// @dev Test double for a hostile $VEIL: the first `transferFrom` of a run calls
///      back into `VeilPass.buy()` before moving anything. A pass that credited
///      the wallet from a value read before the transfers, or that allowed the
///      re-entry at all, would open two periods for one price. Never deployed.
contract MockReentrantVeil is ERC20 {
    address public pass;
    bool private entered;

    constructor() ERC20("Reentrant Veil", "RVEIL") {
        _mint(msg.sender, 1_000_000_000 ether);
    }

    function setPass(address pass_) external {
        pass = pass_;
    }

    function transferFrom(address from, address to, uint256 value) public override returns (bool) {
        if (!entered && pass != address(0)) {
            entered = true;
            IVeilPassBuy(pass).buy();
        }
        return super.transferFrom(from, to, value);
    }
}
