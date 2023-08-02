// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";
import '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import '@openzeppelin/contracts/access/Ownable.sol';
import '@openzeppelin/contracts/security/Pausable.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import '@openzeppelin/contracts/utils/math/SafeMath.sol';

contract Handler is ReentrancyGuard, Ownable, Pausable {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    address self;

    uint256 private constant WORKER_MAX_TASK_COUNT = 10;

    struct DepositInfo {
        // Sender address on source chain
        address sender;
        // Deposit token
        IERC20 token;
        // Deposit amount
        uint256 amount;
        // Recipient address on dest chain
        bytes recipient;
        // Encoded execution plan produced by Solver
        string task;
    }

    // taskId => DepositInfo
    mapping(bytes32 => DepositInfo) public _depositRecords;
    // workerAddress => taskId[]
    mapping(address => bytes32[]) public _activedTasks;
    // workerAddress => isWorker
    mapping(address => bool) public _workers;

    event Deposited(
        address indexed sender,
        address indexed token,
        uint256 amount,
        bytes recipient,
        string task
    );

    event Claimed(address indexed worker, bytes32 indexed taskId);
    event Dropped(address indexed worker, bytes32 indexed taskId);

    modifier onlyWorker() {
        require(_workers[_msgSender()], 'Not worker');
        _;
    }

    constructor() {
        self = address(this);
    }

    function setMultiWorkers(address[] memory workers) external onlyOwner {
        require(workers.length < 100, 'Too many workers');
        for (uint i = 0; i < workers.length; i++) {
            _workers[workers[i]] = true;
        }
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
        string memory task
    ) external whenNotPaused nonReentrant {
        require(token != address(0), 'Illegal token address');
        require(amount > 0, 'Zero transfer');
        require(recipient.length > 0, 'Illegal recipient data');
        require(worker != address(0), 'Illegal worker address');
        require(
            bytes(_depositRecords[taskId].task).length == 0,
            'Duplicate task'
        );
        require(bytes(task).length > 0, 'Illegal task data');
        require(
            _activedTasks[worker].length < WORKER_MAX_TASK_COUNT,
            'Too many tasks'
        );

        uint256 preBalance = IERC20(token).balanceOf(self);
        // Transfer from sender to contract
        IERC20(token).safeTransferFrom(msg.sender, self, amount);
        uint256 postBalance = IERC20(token).balanceOf(self);
        require(postBalance.sub(preBalance) == amount, 'Transfer failed');

        // Put task id to actived task list
        bytes32[] storage tasks = _activedTasks[worker];
        tasks.push(taskId);
        // Save task details
        _depositRecords[taskId] = DepositInfo({
            sender: msg.sender,
            token: IERC20(token),
            amount: amount,
            recipient: recipient,
            task: task
        });
        emit Deposited(msg.sender, token, amount, recipient, task);
    }

    // Drop task data and trigger asset beeing transfered back to task depositor
    function drop(bytes32 taskId) external whenNotPaused onlyWorker nonReentrant {
        DepositInfo memory depositInfo = this.findActivedTask(msg.sender, taskId);
        // Check if task is exist
        require(depositInfo.sender != address(0), "Task does not exist");

        // Remove task
        removeTask(msg.sender, taskId);

        // Transfer asset back to task depositor account
        require(
            depositInfo.token.balanceOf(self) >=
                depositInfo.amount,
            'Insufficient balance'
        );
        depositInfo.token.safeTransfer(depositInfo.sender, depositInfo.amount);

        emit Dropped(msg.sender, taskId);
    }

    // Worker claim last actived task that belong to this worker
    function claim(bytes32 taskId) external whenNotPaused onlyWorker nonReentrant {
        DepositInfo memory depositInfo = this.findActivedTask(msg.sender, taskId);
        // Check if task is exist
        require(depositInfo.sender != address(0), "Task does not exist");

        // Remove task
        removeTask(msg.sender, taskId);

        // Transfer asset to worker account
        require(
            depositInfo.token.balanceOf(self) >=
                depositInfo.amount,
            'Insufficient balance'
        );
        depositInfo.token.safeTransfer(msg.sender, depositInfo.amount);

        emit Claimed(msg.sender, taskId);
    }

    // Worker claim all actived tasks that belong to this worker
    function claimAll() external whenNotPaused onlyWorker nonReentrant {
        bytes32[] memory tasks = _activedTasks[msg.sender];
        for (uint256 i = 0; i < tasks.length; i++) {
            DepositInfo memory depositInfo = _depositRecords[tasks[i]];
            require(
                depositInfo.token.balanceOf(self) >=
                    depositInfo.amount,
                'Insufficient balance'
            );
            // Transfer asset to worker account
            depositInfo.token.safeTransfer(msg.sender, depositInfo.amount);

            emit Claimed(msg.sender, tasks[i]);
        }

        // Clear actived tasks list
        delete _activedTasks[msg.sender];
    }

    function findActivedTask(address worker, bytes32 taskId) public view returns (DepositInfo memory depositInfo) {
        bytes32[] memory tasks = _activedTasks[worker];
        uint checkIndex = 0;
        for (; checkIndex < tasks.length; checkIndex++) {
            if (taskId == tasks[checkIndex]) return _depositRecords[taskId];
        }
        return depositInfo;
    }

    function getLastActivedTask(address worker)
        public
        view
        returns (bytes32)
    {
        bytes32[] memory tasks = _activedTasks[worker];
        if (tasks.length > 0) return tasks[tasks.length - 1];
        else return bytes32(0);
    }

    function getActivedTasks(address worker)
        public
        view
        returns (bytes32[] memory)
    {
        return _activedTasks[worker];
    }

    function getTaskData(bytes32 taskId)
        public
        view
        returns (DepositInfo memory)
    {
        return _depositRecords[taskId];
    }

    function removeTask(address worker, bytes32 taskId) internal {
        bytes32[] memory tasks = _activedTasks[worker];
        uint checkIndex = 0;
        for (; checkIndex < tasks.length; checkIndex++) {
            if (taskId == tasks[checkIndex]) break;
        }
        // Task not found
        if (checkIndex >= tasks.length) return;

        // If tasks has more than 1 item, we should keep remaining items
        if (tasks.length == 1) {
            _activedTasks[worker] = new bytes32[](0);
        } else {
            bytes32[] memory remainingTasks = new bytes32[](tasks.length - 1);
            for (uint i = 0; i < tasks.length; i++) {
                if (i < checkIndex) {
                    remainingTasks[i] = tasks[i];
                } else {
                    // Shift
                    remainingTasks[i - 1] = tasks[i];
                }
            }
            // Assign remain tasks to storage
            _activedTasks[worker] = remainingTasks;
        }
    }
}
