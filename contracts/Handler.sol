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
    // workerAddress => isWorker
    mapping(address => bool) public _workers;

    event Deposited(
        address  indexed sender,
        address  indexed token,
        uint256  amount,
        bytes    recipient,
        bytes    task
    );

    event Claimed(
        address   indexed worker,
        bytes32 indexed taskId
    );

    modifier onlyWorker {
        require(_workers[_msgSender()], "Not worker");
        _;
    }

    constructor()  {

    }

    function setWorker(address worker) external onlyOwner {
        _workers[worker] = true;
    }

    function removeWorker(address worker) external onlyOwner {
        _workers[worker] = false;
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

    // Worker claim last actived task that belong to this worker
    function claim() external whenNotPaused onlyWorker nonReentrant {
        bytes32[] memory tasks = _activedTasks[msg.sender];
        if (tasks.length > 0) {
            bytes32 task_id = tasks[tasks.length - 1];
            // Remove last task from storage
            _activedTasks[msg.sender].pop();
            DepositInfo memory depositInfo = _depositRecords[task_id];
            require(
                depositInfo.token.balanceOf(address(this))
                >= depositInfo.amount,
            "Insufficient balance");
            // Transfer asset to worker account
            depositInfo.token.safeTransfer(msg.sender, depositInfo.amount);

            emit Claimed(
                msg.sender,
                task_id
            );
        }
    }

    // Worker claim all actived tasks that belong to this worker
    function claim_all() external whenNotPaused onlyWorker nonReentrant {
        bytes32[] memory tasks = _activedTasks[msg.sender];
        for (uint i = 0; i < tasks.length; i++) {
            DepositInfo memory depositInfo = _depositRecords[tasks[i]];
            require(
                depositInfo.token.balanceOf(address(this))
                >= depositInfo.amount,
            "Insufficient balance");
            // Transfer asset to worker account
            depositInfo.token.safeTransfer(msg.sender, depositInfo.amount);

            emit Claimed(
                msg.sender,
                tasks[i]
            );
        }

        // Clear actived tasks list
        delete _activedTasks[msg.sender];
    }

    function getLastActivedTask(address worker) public view returns (bytes32) {
        bytes32[] memory tasks = _activedTasks[worker];
        if (tasks.length > 0) return tasks[tasks.length - 1];
        else return bytes32(0);
    }

    function getActivedTasks(address worker) public view returns (bytes32[] memory) {
        return _activedTasks[worker];
    }

    function getTaskData(bytes32 taskId) public view returns (DepositInfo memory) {
        return _depositRecords[taskId];
    }
}
