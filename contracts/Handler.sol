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

    uint256 private constant WORKER_MAX_REQUEST_COUNT = 10;

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
        string request;
    }

    // requestId => DepositInfo
    mapping(bytes32 => DepositInfo) public _depositRecords;
    // workerAddress => requestId[]
    mapping(address => bytes32[]) public _activedRequests;
    // workerAddress => isWorker
    mapping(address => bool) public _workers;

    event Deposited(
        address indexed sender,
        address indexed token,
        uint256 amount,
        bytes recipient,
        string request
    );

    event Claimed(address indexed worker, bytes32 indexed requestId);

    modifier onlyWorker() {
        require(_workers[_msgSender()], 'Not worker');
        _;
    }

    constructor() {}

    function setWorker(address worker) external onlyOwner {
        _workers[worker] = true;
    }

    function removeWorker(address worker) external onlyOwner {
        _workers[worker] = false;
    }

    // Temporary transfer asset to contract and save the corresponding request data
    function deposit(
        address token,
        uint256 amount,
        bytes memory recipient,
        address worker,
        bytes32 requestId,
        string memory request
    ) external whenNotPaused nonReentrant {
        require(token != address(0), 'Illegal token address');
        require(amount > 0, 'Zero transfer');
        require(recipient.length > 0, 'Illegal recipient data');
        require(worker != address(0), 'Illegal worker address');
        require(
            bytes(_depositRecords[requestId].request).length == 0,
            'Duplicate request'
        );
        require(bytes(request).length > 0, 'Illegal request data');
        require(
            _activedRequests[worker].length < WORKER_MAX_REQUEST_COUNT,
            'Too many requests'
        );

        uint256 preBalance = IERC20(token).balanceOf(address(this));
        // Transfer from sender to contract
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        uint256 postBalance = IERC20(token).balanceOf(address(this));
        require(postBalance.sub(preBalance) == amount, 'Transfer failed');

        // Put request id to actived request list
        bytes32[] storage requests = _activedRequests[worker];
        requests.push(requestId);
        // Save request details
        _depositRecords[requestId] = DepositInfo({
            sender: msg.sender,
            token: IERC20(token),
            amount: amount,
            recipient: recipient,
            request: request
        });
        emit Deposited(msg.sender, token, amount, recipient, request);
    }

    // Worker claim last actived request that belong to this worker
    function claim() external whenNotPaused onlyWorker nonReentrant {
        bytes32[] memory requests = _activedRequests[msg.sender];
        if (requests.length > 0) {
            bytes32 request_id = requests[requests.length - 1];
            // Remove last request from storage
            _activedRequests[msg.sender].pop();
            DepositInfo memory depositInfo = _depositRecords[request_id];
            require(
                depositInfo.token.balanceOf(address(this)) >=
                    depositInfo.amount,
                'Insufficient balance'
            );
            // Transfer asset to worker account
            depositInfo.token.safeTransfer(msg.sender, depositInfo.amount);

            emit Claimed(msg.sender, request_id);
        }
    }

    // Worker claim all actived requests that belong to this worker
    function claim_all() external whenNotPaused onlyWorker nonReentrant {
        bytes32[] memory requests = _activedRequests[msg.sender];
        for (uint256 i = 0; i < requests.length; i++) {
            DepositInfo memory depositInfo = _depositRecords[requests[i]];
            require(
                depositInfo.token.balanceOf(address(this)) >=
                    depositInfo.amount,
                'Insufficient balance'
            );
            // Transfer asset to worker account
            depositInfo.token.safeTransfer(msg.sender, depositInfo.amount);

            emit Claimed(msg.sender, requests[i]);
        }

        // Clear actived requests list
        delete _activedRequests[msg.sender];
    }

    function getLastActivedRequest(address worker)
        public
        view
        returns (bytes32)
    {
        bytes32[] memory requests = _activedRequests[worker];
        if (requests.length > 0) return requests[requests.length - 1];
        else return bytes32(0);
    }

    function getActivedRequests(address worker)
        public
        view
        returns (bytes32[] memory)
    {
        return _activedRequests[worker];
    }

    function getRequestData(bytes32 requestId)
        public
        view
        returns (DepositInfo memory)
    {
        return _depositRecords[requestId];
    }
}
