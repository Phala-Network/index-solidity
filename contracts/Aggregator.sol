// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

contract Aggregator is ReentrancyGuard, Ownable, Pausable {
    struct DepositInfo {
        // Sender address on source chain
        address  sender;
        // Deposit amount
        uint256  amount;
        // Recipient address on dest chain
        bytes    recipient;
        // Encoded execution plan produced by Solver
        bytes    task;
	}

    // taskId => DepositInfo
	mapping(bytes32 => DepositInfo) public _depositRecords;
	// workerAddress => taskId[]
	mapping(address => bytes32[]) public _activedTasks;

    mapping(address => bool) private _executors;

    modifier onlyExecutor {
        require(_executors[_msgSender()], "NotExecutor");
        _;
    }

    constructor()  {

    }

    function set_executor(address executor) external onlyOwner {
        _executors[executor] = true;
    }

    function remove_executor(address executor) external onlyOwner {
        _executors[executor] = false;
    }

    // Temporary transfer asset to contract and save the corresponding task data
	function deposit(
		address token,
		uint256 amount,
		uint256 recipientLen,
		bytes memory recipient,
		bytes32 taskId,
		uint256 taskLen,
		bytes memory task
	) external whenNotPaused nonReentrant {

		// Transfer from sender to contract
        // bool ret = ERC20(token).transferFrom(msg.sender, address(this), amount);

    }

	// Executor claims asset to worker account and consumes a pending task
	function claim(bytes32 taskId, address worker) external whenNotPaused onlyExecutor nonReentrant {
		// Transfer asset to worker account

        // Remove `DepositInfo` from records

	}

    function getActivedTasks(address worker) public view returns (bytes32[] memory) {
        return _activedTasks[worker];
    }

    function getTaskData(bytes32 taskId) public view returns (DepositInfo memory) {
        return _depositRecords[taskId];
    }
}