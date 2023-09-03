
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import "hardhat/console.sol";

contract Test {
    address owner;
    address whitelistedCaller;

    event Claim(address token, uint amount);
    event Swap(address token1, address token2, uint amount1, uint amount2);
    event SwapNative(address token, uint amount1, uint amount2);
    event Bridge(address token, uint amount);
    event Nothing(uint amount);

    constructor() {
        owner = msg.sender;
    }

    function setCaller(address caller) public {
        require(msg.sender == owner, 'Permission denied');

        whitelistedCaller = caller;
    }

    function claim(address token, uint amount) public {
        console.log("---> claim: ", token, amount);
        console.log("---> claim details:", msg.sender, address(this), IERC20(token).balanceOf(address(this)));

        IERC20(token).transfer(msg.sender, amount);

        emit Claim(token, amount);
        console.log("---> claim done");
    }

    function swap(address token1, address token2, uint amount) public {
        console.log("---> swap: ", token1, token2, amount);
        IERC20(token1).transferFrom(msg.sender, address(this), amount);
        IERC20(token2).transfer(msg.sender, amount / 2);

        emit Swap(token1, token2, amount, amount / 2);
        console.log("---> swap done");
    }

    function swapNative(address token) public payable {
        console.log("---> swap native: ", token, msg.value);
        IERC20(token).transfer(msg.sender, msg.value / 2);

        emit SwapNative(token, msg.value, msg.value / 2);
        console.log("---> swap native done");
    }

    function bridge(address token, uint amount) public {
        console.log("---> bridge: ", token, amount);
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        emit Bridge(token, amount);
        console.log("---> bridge done");
    }

    function doNothing(uint amount) public {
        emit Nothing(amount);
    }
}
