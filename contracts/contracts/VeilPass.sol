// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Veil Pass
/// @notice A 30-day pass to the Key, paid in $VEIL. A fixed share of every pass
///         burns; the rest goes to the house wallet. No funds rest here.
///         Phase 2 of the Terminus Veil desk.
/// @dev    No owner, no pause, no upgrade, no withdraw, no ETH. `priceSetter`
///         can change `price` and hand its role on, nothing else. `burnBps`,
///         `house` and `veil` are fixed at deploy. A pass is access, not a
///         share: it carries no claim, no vote and no fee.
///
///         $VEIL is a plain ERC-20, but every buy hands control to it twice
///         (`transferFrom`), so the buys are `nonReentrant` and `_buy` reads
///         `activeUntil` after the transfers. Both are load-bearing; see `_buy`.
contract VeilPass is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable veil;
    address public immutable house;
    uint16 public immutable burnBps;
    uint64 public constant PERIOD = 30 days;
    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    address public priceSetter;
    uint256 public price;
    mapping(address => uint64) public activeUntil;

    event Bought(
        address indexed wallet,
        address indexed payer,
        uint256 paid,
        uint256 burned,
        uint64 activeUntil
    );
    event PriceSet(uint256 price);
    event PriceSetterHanded(address indexed to);

    constructor(IERC20 veil_, address house_, uint16 burnBps_, uint256 price_, address priceSetter_) {
        require(address(veil_) != address(0), "VeilPass: veil");
        require(house_ != address(0), "VeilPass: house");
        require(burnBps_ >= 1 && burnBps_ <= 10_000, "VeilPass: burnBps");
        require(price_ != 0, "VeilPass: price");
        require(priceSetter_ != address(0), "VeilPass: setter");
        veil = veil_;
        house = house_;
        burnBps = burnBps_;
        price = price_;
        priceSetter = priceSetter_;
        emit PriceSet(price_);
    }

    modifier onlySetter() {
        require(msg.sender == priceSetter, "VeilPass: setter");
        _;
    }

    /// @notice Buy a pass for yourself. Approve `price` of $VEIL to this contract first.
    /// @dev Unguarded: `price` can change between your read and your transaction.
    ///      A purchase interface calls the `maxPrice` form below.
    function buy() external nonReentrant {
        _buy(msg.sender);
    }

    /// @notice Buy a pass for yourself at no more than `maxPrice` of $VEIL.
    /// @dev `price` is mutable by the price setter, so this is the form to send
    ///      from an interface: it fails rather than spend more than the figure
    ///      the buyer was shown.
    function buy(uint256 maxPrice) external nonReentrant {
        require(price <= maxPrice, "VeilPass: price");
        _buy(msg.sender);
    }

    /// @notice Buy a pass for another wallet; you pay.
    /// @dev Unguarded, like `buy()`; the `maxPrice` form below is the one to send.
    function buyFor(address wallet) external nonReentrant {
        require(wallet != address(0), "VeilPass: wallet");
        _buy(wallet);
    }

    /// @notice Buy a pass for another wallet at no more than `maxPrice`; you pay.
    function buyFor(address wallet, uint256 maxPrice) external nonReentrant {
        require(wallet != address(0), "VeilPass: wallet");
        require(price <= maxPrice, "VeilPass: price");
        _buy(wallet);
    }

    /// @notice True while the wallet's pass has time left.
    function isActive(address wallet) external view returns (bool) {
        return activeUntil[wallet] > block.timestamp;
    }

    function setPrice(uint256 newPrice) external onlySetter {
        require(newPrice != 0, "VeilPass: price");
        price = newPrice;
        emit PriceSet(newPrice);
    }

    function handPriceSetter(address to) external onlySetter {
        require(to != address(0), "VeilPass: setter");
        priceSetter = to;
        emit PriceSetterHanded(to);
    }

    function _buy(address wallet) private {
        uint256 paid = price;
        uint256 burned = (paid * burnBps) / 10_000;
        uint256 rest = paid - burned;
        if (burned != 0) veil.safeTransferFrom(msg.sender, DEAD, burned);
        if (rest != 0) veil.safeTransferFrom(msg.sender, house, rest);
        // This read must stay below the transfers. The callers are
        // `nonReentrant`, so a token that calls back cannot re-enter today;
        // reading here means that even if it could, the outer buy extends from
        // what the inner one wrote and no paid period is overwritten. Reading
        // above the transfers would silently drop the shorter of the two.
        // Nothing else is at stake in the order: no funds rest here, both
        // transfers move the payer's tokens straight to DEAD and the house.
        uint64 current = activeUntil[wallet];
        uint64 from = current > block.timestamp ? current : uint64(block.timestamp);
        uint64 until = from + PERIOD;
        activeUntil[wallet] = until;
        emit Bought(wallet, msg.sender, paid, burned, until);
    }
}
