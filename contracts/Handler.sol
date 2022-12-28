// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract Handler is ReentrancyGuard, Ownable, Pausable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 private constant WORKER_MAX_TASK_COUNT = 10;

    struct DepositInfo {
        // Sender address on source chain
        address  sender;
        // Deposit token
        IERC20 token;
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
    // executorAddress => isExecutor
    mapping(address => bool) public _executors;

    event Deposited(
        address  indexed sender,
        address  indexed token,
        uint256  amount,
        bytes    recipient,
        bytes    task
    );

    event Claimed(
        address   indexed executor,
        address   indexed worker,
        bytes32 indexed taskId
    );

    modifier onlyExecutor {
        require(_executors[_msgSender()], "Not executor");
        _;
    }

    constructor()  {

    }

    function setExecutor(address executor) external onlyOwner {
        _executors[executor] = true;
    }

    function removeExecutor(address executor) external onlyOwner {
        _executors[executor] = false;
    }

    // Temporary transfer asset to contract and save the corresponding task data
    function deposit(
        address token,
        uint256 amount,
        bytes memory recipient,
        address worker,
        bytes32 taskId,
        bytes memory task
    ) external whenNotPaused nonReentrant {
        require(token != address(0), "Illegal token address");
        require(amount > 0, "Zero transfer");
        require(recipient.length > 0, "Illegal recipient data");
        require(worker != address(0), "Illegal worker address");
        require(_depositRecords[taskId].task.length == 0, "Duplicate task");
        require(task.length > 0, "Illegal task data");
        require(_activedTasks[worker].length < WORKER_MAX_TASK_COUNT, "Too many tasks");

        uint256 preBalance = IERC20(token).balanceOf(address(this));
        // Transfer from sender to contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 postBalance = IERC20(token).balanceOf(address(this));
        require(postBalance.sub(preBalance) == amount, "Transfer failed");

        // Put task id to actived task list
        bytes32[] storage tasks = _activedTasks[worker];
        tasks.push(taskId);
        // Save task details
        _depositRecords[taskId] = DepositInfo ({
            sender: msg.sender,
            token: IERC20(token),
            amount: amount,
            recipient: recipient,
            task: task
        });
        emit Deposited(msg.sender, token, amount, recipient, task);
    }

    // Executor claim all actived tasks
    function claim(address worker) external whenNotPaused onlyExecutor nonReentrant {
        require(worker != address(0), "Illegal worker address");
        bytes32[] memory tasks = _activedTasks[worker];
        for (uint i = 0; i < tasks.length; i++) {
            DepositInfo memory depositInfo = _depositRecords[tasks[i]];
            require(
                depositInfo.token.balanceOf(address(this))
                >= depositInfo.amount,
            "Insufficient balance");
            // Transfer asset to worker account
            depositInfo.token.safeTransfer(worker, depositInfo.amount);

            emit Claimed(
                msg.sender,
                worker,
                tasks[i]
            );
        }

        // Clear actived tasks list
        delete _activedTasks[worker];
    }

    function getActivedTasks(address worker) public view returns (bytes32[] memory) {
        return _activedTasks[worker];
    }

    function getTaskData(bytes32 taskId) public view returns (DepositInfo memory) {
        return _depositRecords[taskId];
    }
}
