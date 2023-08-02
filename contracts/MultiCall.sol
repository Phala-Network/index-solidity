
// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import "hardhat/console.sol";

contract MultiCall {

    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    struct Settlement {
        address asset;
        address worker;
    }

    struct Call {
        // The call metadata
        address target;
        bytes callData;
        uint256 value;
        bool allowFailure;

        // The settlement metadata
        bool needSettle;
        uint256 updateOffset;
        uint256 updateLen;
        address spendAsset;
        address receiveAsset;
        // The call index that whose result will be the input of call
        uint inputCall;
        // Current call index
        uint callIndex;
    }

    struct Result {
        bool success;
        bytes returnData;
    }

    constructor() {
    }

    function callAndSettle(Call[] calldata calls) public payable returns (Result[] memory returnData) {
    
        uint256 length = calls.length;
        require(length > 1, 'Too few calls');

        returnData = new Result[](length);
        Call memory inputCall;
        uint256 settleAmount = 0;

        for (uint256 i = 0; i < length;) {
            console.log("===> Start execute call: ", i);
            Result memory result = returnData[i];
            Call memory calli = calls[i];

            // update calldata from second call
            if (i > 0 && calli.inputCall == inputCall.callIndex && calli.spendAsset == inputCall.receiveAsset) {
                // Update settleAmount to calldata from offset
                console.log("===> Update settleAmount to calldata from offset: ", settleAmount);
                bytes memory settleAmountBytes = abi.encodePacked(settleAmount);
                require(inputCall.needSettle, 'Input call must be settled');
                require(calli.updateLen == 32, 'Unsupported update length');

                console.log("===> Calldata before update: ");
                console.logBytes(calli.callData);
                for(uint j = 0; j < calli.updateLen; j++) {
                    calli.callData[j + calli.updateOffset] = settleAmountBytes[j];
                }
                console.log("===> Calldata after update: ");
                console.logBytes(calli.callData);
            }

            uint256 preBalance;
            uint256 postBalance;
            // Read balance before execution
            if (calli.needSettle) {
                preBalance = IERC20(calli.receiveAsset).balanceOf(msg.sender);
            }

            console.log("===> Ready to execute call");
            // Execute
            (result.success, result.returnData) = calli.target.call(calli.callData);
            console.log("===> Execute result: ", result.success);
            console.log("===> Return data:");
            console.logBytes(result.returnData);
            if (!calli.allowFailure) {
                require(result.success, string(abi.encodePacked(string("Call failed: "), string(result.returnData))));
            }
            unchecked { ++i; }

            // Settle balance after execution
            if (calli.needSettle) {
                postBalance = IERC20(calli.receiveAsset).balanceOf(msg.sender);
                settleAmount = postBalance.sub(preBalance);
                inputCall = calli;
                console.log("===> Call", calli.callIndex, "been settled: ", settleAmount);
            }
        }
    }
}