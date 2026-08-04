// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title BountyEscrow
/// @notice Single contract holding many bounties. Businesses fund bounties in
///         escrow; Researchers submit timestamped hashes; the Business (or the
///         Platform Admin while a Bounty is inDispute) judges. Report content
///         never touches the chain: only keccak fingerprints do.
/// @dev Deployed once via Remix to BOT Chain. The interface (functions, state
///      machine, events) is the hard contract from tasks 02/03/04 — locked
///      after deploy.
contract BountyEscrow {
    enum BountyState { Active, RefundPending, Closed }
    enum CloseReason { Cancel, Paid, Refunded }
    enum SubmissionState { Submitted, Accepted, Rejected }
    enum DisputeReason { ResearcherFlag, OwnerSilence }
    enum Resolution { Payout, Refunded, Dismissed }

    struct Submission {
        bytes32 hash;
        address submitter;
        uint256 timestamp;
        SubmissionState state;
    }

    struct Bounty {
        bytes32 scopeHash;
        uint256 escrow;
        uint256 deadline;
        address business;
        BountyState state;
        bool disputeRequested;
        bool inDispute;
        uint256 firstSubmissionTs;
        Submission[] submissions;
    }

    address public admin;
    uint256 public silenceWindow;
    uint256 public raiseCooldown;
    mapping(address => uint256) public lastRaiseAt;

    Bounty[] private allBounties;

    event BountyCreated(
        uint256 indexed bountyId,
        address indexed business,
        bytes32 scopeHash,
        uint256 escrow,
        uint256 deadline
    );
    event SubmissionSubmitted(
        uint256 indexed bountyId,
        uint256 indexed submissionId,
        address indexed submitter,
        bytes32 hash
    );
    event SubmissionJudged(uint256 indexed bountyId, uint256 indexed submissionId, bool accepted);
    event RefundRequested(uint256 indexed bountyId);
    event BountyClosed(uint256 indexed bountyId, CloseReason reason);
    event DisputeRaised(uint256 indexed bountyId, address indexed raiser, DisputeReason reason);
    event DisputeOpened(uint256 indexed bountyId, address indexed admin, DisputeReason reason);
    event DisputeResolved(uint256 indexed bountyId, address indexed admin, Resolution resolution);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);
    event SilenceWindowSet(uint256 value);
    event RaiseCooldownSet(uint256 value);

    error BountyNotFound();
    error ZeroValue();
    error DeadlineInPast();
    error DeadlinePassed();
    error ZeroHash();
    error WrongBountyState(BountyState required);
    error WrongSubmissionState(SubmissionState required);
    error NotBusiness();
    error NotAdmin();
    error InDispute();
    error NotInDispute();
    error HasSubmissions();
    error NoSubmissions();
    error PendingSubmissions();
    error SilenceUnavailable();
    error SilenceNotElapsed();
    error RaiseCooldown();
    error NotASubmitter();
    error ZeroAddress();
    error TransferFailed();

    constructor(uint256 _silenceWindow, uint256 _raiseCooldown) {
        admin = msg.sender;
        silenceWindow = _silenceWindow;
        raiseCooldown = _raiseCooldown;
    }

    /// @notice Rotate the Platform Admin address. One-step; the new admin takes over immediately.
    function transferAdmin(address newAdmin) external {
        if (msg.sender != admin) revert NotAdmin();
        if (newAdmin == address(0)) revert ZeroAddress();
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    /// @notice Tune the owner-silence window without a redeploy. Admin only.
    function setSilenceWindow(uint256 value) external {
        if (msg.sender != admin) revert NotAdmin();
        silenceWindow = value;
        emit SilenceWindowSet(value);
    }

    /// @notice Tune the per-address dispute-raise cooldown without a redeploy. Admin only.
    function setRaiseCooldown(uint256 value) external {
        if (msg.sender != admin) revert NotAdmin();
        raiseCooldown = value;
        emit RaiseCooldownSet(value);
    }

    /// @notice Create and fund a Bounty. msg.value becomes the escrowed reward.
    function createBounty(bytes32 scopeHash, uint256 deadline) external payable returns (uint256 bountyId) {
        if (msg.value == 0) revert ZeroValue();
        if (deadline <= block.timestamp) revert DeadlineInPast();
        allBounties.push();
        Bounty storage b = allBounties[allBounties.length - 1];
        b.scopeHash = scopeHash;
        b.escrow = msg.value;
        b.deadline = deadline;
        b.business = msg.sender;
        bountyId = allBounties.length - 1;
        emit BountyCreated(bountyId, msg.sender, scopeHash, msg.value, deadline);
    }

    /// @notice Record a submission hash. Anyone may submit; content never reaches the chain.
    function submitSubmission(uint256 bountyId, bytes32 hash) external returns (uint256 submissionId) {
        Bounty storage b = _requireBounty(bountyId);
        if (b.state != BountyState.Active) revert WrongBountyState(BountyState.Active);
        if (b.inDispute) revert InDispute();
        if (block.timestamp >= b.deadline) revert DeadlinePassed();
        if (hash == bytes32(0)) revert ZeroHash();
        if (b.firstSubmissionTs == 0) b.firstSubmissionTs = block.timestamp;
        b.submissions.push(
            Submission({ hash: hash, submitter: msg.sender, timestamp: block.timestamp, state: SubmissionState.Submitted })
        );
        submissionId = b.submissions.length - 1;
        emit SubmissionSubmitted(bountyId, submissionId, msg.sender, hash);
    }

    /// @notice Accept a submission: pays the full reward once and closes the Bounty as paid.
    function acceptSubmission(uint256 bountyId, uint256 submissionId) external {
        Bounty storage b = _requireBounty(bountyId);
        _requireJudger(b);
        if (b.state != BountyState.Active) revert WrongBountyState(BountyState.Active);
        Submission storage sub = b.submissions[submissionId];
        if (sub.state != SubmissionState.Submitted) revert WrongSubmissionState(SubmissionState.Submitted);
        sub.state = SubmissionState.Accepted;
        emit SubmissionJudged(bountyId, submissionId, true);
        _resolveDispute(b, bountyId, Resolution.Payout);
        b.state = BountyState.Closed;
        _pay(b, sub.submitter);
        emit BountyClosed(bountyId, CloseReason.Paid);
    }

    /// @notice Mark a single submission invalid.
    function rejectSubmission(uint256 bountyId, uint256 submissionId) external {
        Bounty storage b = _requireBounty(bountyId);
        _requireJudger(b);
        if (b.state != BountyState.Active) revert WrongBountyState(BountyState.Active);
        Submission storage sub = b.submissions[submissionId];
        if (sub.state != SubmissionState.Submitted) revert WrongSubmissionState(SubmissionState.Submitted);
        sub.state = SubmissionState.Rejected;
        emit SubmissionJudged(bountyId, submissionId, false);
    }

    /// @notice Mark every pending submission invalid in one transaction. No reduction for gas.
    function markAllInvalid(uint256 bountyId) external {
        Bounty storage b = _requireBounty(bountyId);
        _requireJudger(b);
        if (b.state != BountyState.Active) revert WrongBountyState(BountyState.Active);
        for (uint256 i = 0; i < b.submissions.length; i++) {
            Submission storage sub = b.submissions[i];
            if (sub.state == SubmissionState.Submitted) {
                sub.state = SubmissionState.Rejected;
                emit SubmissionJudged(bountyId, i, false);
            }
        }
    }

    /// @notice Cancel a Bounty that has zero submissions; escrow returns immediately.
    ///         Locked out while a dispute is open — only the Platform Admin moves funds then.
    function cancelBounty(uint256 bountyId) external {
        Bounty storage b = _requireBounty(bountyId);
        if (msg.sender != b.business) revert NotBusiness();
        if (b.inDispute) revert InDispute();
        if (b.submissions.length > 0) revert HasSubmissions();
        if (b.state != BountyState.Active) revert WrongBountyState(BountyState.Active);
        b.state = BountyState.Closed;
        _pay(b, b.business);
        emit BountyClosed(bountyId, CloseReason.Cancel);
    }

    /// @notice Request a refund once every submission is rejected; enter RefundPending.
    function requestRefund(uint256 bountyId) external {
        Bounty storage b = _requireBounty(bountyId);
        if (msg.sender != b.business) revert NotBusiness();
        if (b.inDispute) revert InDispute();
        if (b.state != BountyState.Active) revert WrongBountyState(BountyState.Active);
        if (b.submissions.length == 0) revert NoSubmissions();
        for (uint256 i = 0; i < b.submissions.length; i++) {
            if (b.submissions[i].state == SubmissionState.Submitted) revert PendingSubmissions();
        }
        b.state = BountyState.RefundPending;
        emit RefundRequested(bountyId);
    }

    /// @notice Confirm the refund (two-phase), returning escrow to the Business.
    function confirmRefund(uint256 bountyId) external {
        Bounty storage b = _requireBounty(bountyId);
        _requireJudger(b);
        if (b.state != BountyState.RefundPending) revert WrongBountyState(BountyState.RefundPending);
        _resolveDispute(b, bountyId, Resolution.Refunded);
        b.state = BountyState.Closed;
        _pay(b, b.business);
        emit BountyClosed(bountyId, CloseReason.Refunded);
    }

    /// @notice Raise a dispute with its reason. Non-admin raisers are guarded on-chain:
    ///         ResearcherFlag requires a submission on the bounty; OwnerSilence requires the
    ///         silence window to have elapsed; both paths share a per-address cooldown.
    function raiseDispute(uint256 bountyId, DisputeReason reason) external {
        Bounty storage b = _requireBounty(bountyId);
        _requireEscrowHeld(b);
        if (b.inDispute) revert InDispute();
        if (msg.sender != admin) {
            if (block.timestamp < lastRaiseAt[msg.sender] + raiseCooldown) revert RaiseCooldown();
            lastRaiseAt[msg.sender] = block.timestamp;
            if (reason == DisputeReason.ResearcherFlag) {
                if (!_hasSubmission(b, msg.sender)) revert NotASubmitter();
            } else {
                if (b.firstSubmissionTs == 0) revert SilenceUnavailable();
                if (block.timestamp < b.firstSubmissionTs + silenceWindow) revert SilenceNotElapsed();
            }
        }
        b.disputeRequested = true;
        emit DisputeRaised(bountyId, msg.sender, reason);
    }

    /// @notice Platform Admin opens the inDispute gate. Owner-silence is time-gated on-chain.
    function openDispute(uint256 bountyId, DisputeReason reason) external {
        if (msg.sender != admin) revert NotAdmin();
        Bounty storage b = _requireBounty(bountyId);
        _requireEscrowHeld(b);
        if (b.inDispute) revert InDispute();
        if (reason == DisputeReason.OwnerSilence) {
            if (b.firstSubmissionTs == 0) revert SilenceUnavailable();
            if (block.timestamp < b.firstSubmissionTs + silenceWindow) revert SilenceNotElapsed();
        }
        b.inDispute = true;
        emit DisputeOpened(bountyId, msg.sender, reason);
    }

    /// @notice Platform Admin closes the dispute, returning the Bounty to its prior state.
    function closeDispute(uint256 bountyId) external {
        if (msg.sender != admin) revert NotAdmin();
        Bounty storage b = _requireBounty(bountyId);
        if (!b.inDispute) revert NotInDispute();
        b.inDispute = false;
        emit DisputeResolved(bountyId, msg.sender, Resolution.Dismissed);
    }

    // ---------- read surface (task 04) ----------

    function bountyCount() external view returns (uint256) {
        return allBounties.length;
    }

    function bountyOf(uint256 bountyId) external view returns (Bounty memory) {
        return allBounties[bountyId];
    }

    function submissionCountOf(uint256 bountyId) public view returns (uint256) {
        return allBounties[bountyId].submissions.length;
    }

    function submissionAt(uint256 bountyId, uint256 index) external view returns (Submission memory) {
        return allBounties[bountyId].submissions[index];
    }

    function disputeFlag(uint256 bountyId) external view returns (bool disputeRequested, bool inDispute) {
        Bounty storage b = allBounties[bountyId];
        return (b.disputeRequested, b.inDispute);
    }

    // ---------- internals ----------

    function _requireJudger(Bounty storage b) private view {
        if (b.inDispute) {
            if (msg.sender != admin) revert NotAdmin();
        } else {
            if (msg.sender != b.business) revert NotBusiness();
        }
    }

    /// @notice Dispute machinery only applies while the escrow is still held by the contract.
    function _requireEscrowHeld(Bounty storage b) private view {
        if (b.state == BountyState.Closed) revert WrongBountyState(BountyState.Active);
    }

    function _hasSubmission(Bounty storage b, address who) private view returns (bool) {
        for (uint256 i = 0; i < b.submissions.length; i++) {
            if (b.submissions[i].submitter == who) return true;
        }
        return false;
    }

    function _requireBounty(uint256 bountyId) private view returns (Bounty storage) {
        if (bountyId >= allBounties.length) revert BountyNotFound();
        return allBounties[bountyId];
    }

    function _resolveDispute(Bounty storage b, uint256 bountyId, Resolution resolution) private {
        if (b.inDispute) {
            b.inDispute = false;
            emit DisputeResolved(bountyId, msg.sender, resolution);
        }
    }

    function _pay(Bounty storage b, address payee) private {
        (bool ok, ) = payee.call{ value: b.escrow }("");
        if (!ok) revert TransferFailed();
    }
}