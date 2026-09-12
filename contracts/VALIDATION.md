# Validation: USYC, wallet display and fork additions

`forge build --sizes`: **PASS**, Solidity 0.8.30 / Prague / optimizer 200.
Shell/JavaScript syntax checks pass. **73 Solidity test/invariant entry points compile**,
including 13 new cases. They have not been executed successfully in this sandbox.
The previous revision's 60 passing tests, retained below, do not validate these additions.

| Contract | Runtime bytes | Initcode bytes (before arguments) |
| --- | ---: | ---: |
| CascadeVault | 16,807 | 24,171 |
| CascadeVaultUSYC | 18,539 | 26,120 |
| DateMetadata | 3,320 | 3,348 |
| DatedDollarERC20 implementation | 2,860 | 3,047 |
| MockUSYC | 4,086 | 4,845 |

Each date's CREATE2 view clone has 45 bytes of runtime; its implementation is shared within the vault.
Both vaults remain below 24,576 bytes. Metadata is rendered outside the vault runtime.
New tests cover price-derived income excluding flows, extension intervals, losses/recovery/reserve floor,
liquidity suspension, claimed yield preservation, mock Teller operations, dynamic base64 metadata,
ISO dates, fixed ERC-20 symbols, CREATE2 addresses, shared balances/supply, date-scoped approvals,
early-M protection through ERC-20 views, and a real-USDC proxy fork smoke case.

## Execution blocked

The required fork and demo commands were attempted, with these results:

- `scripts/fork.sh`: upstream RPC DNS lookup denied/failed in the sandbox.
- `forge test --fork-url http://127.0.0.1:8545 -vv`: fork initialization failed with
  `Operation not permitted (os error 1)` opening the loopback TCP connection.
- `node scripts/yield-demo.mjs`: `connect EPERM 127.0.0.1:8545` before any transaction
  or balance-sheet output.

No `SHEET` output is available; no yield-demo success is claimed. No transaction was broadcast.
The fork-only testing directive was preserved; no isolated execution substitute was run.

There is also an upstream execution-model limitation:
[Circle's Arc compatibility guide](https://www.arc.io/blog/arc-compatibility-guide-for-existing-evm-apps)
says ordinary Anvil cannot reproduce Arc's precompiles. Fork funding therefore verifies an actual
USDC balance slot and fails closed if none works; it does not silently replace USDC code.
Even after network access is restored, standard Anvil may require an Arc-aware replacement for
real native-USDC transfers. The ordinary vault unit cases use local mocks on the fork; the
separate real-proxy smoke test and USYC demo deliberately expose that compatibility boundary.

The default deployment remains USDC-only. `deployments/` was not modified.
Local fork/deployment state lives in ignored `.local/`; generated wallets are local-only unless
the live demo is explicitly selected with `--live`.

---

## Historical evidence: revision before USYC and wallet views

The following sizes, gas and passing counts belong to the previous source, not this revision.

### Previous local validation

Standard Foundry 1.5.1, Solidity 0.8.30, Prague EVM, optimizer 200 runs.

| Check | Result |
| --- | --- |
| `forge build --sizes` | Pass |
| `forge test -vv` | **60 passed, 0 failed, 0 skipped**, seven suites |
| Stateful invariant tests | Four properties, each 128 runs × 64 handler calls |
| Solidity fuzz tests | 256 runs each: entitlement arithmetic, heap operations, persistent mixed invoice settlement |
| JavaScript tests | **10 passed**: three demo tests and seven journal/preflight tests |
| Lockfile validation | Clean-directory `npm ci --dry-run --offline --ignore-scripts` passes |
| Architecture SVG | Generated without a browser; XML parsing passes |

Runtime: **15,459 bytes**, up **1,158 bytes** from the previous version.
Initcode before constructor arguments: **16,255 bytes**. EIP-170 runtime margin: **9,117 bytes**.
No storage packing change or separately linked library.

The test fixture now asserts its ERC-20 transfer result. Build output has no
`erc20-unchecked-transfer` warning; existing style/typecast lint diagnostics remain.

## Gas report

Single-bucket command:
`forge test --match-contract CascadeVaultGasTest --gas-report --isolate`.

Fixed 10-USDC principal, EOA recipients, six-decimal mock USDC, positive funded yield for claim.
These are the vault call measurements from the gas report, not aggregate test-function gas.

| Function | Minimum | Average | Median | Maximum | Calls |
| --- | ---: | ---: | ---: | ---: | ---: |
| issue | 276,620 | 319,651 | 287,941 | 362,120 | 9 |
| pay (expectedOutstanding overload) | 149,867 | 149,867 | 149,867 | 149,867 | 1 |
| extend | 248,126 | 248,126 | 248,126 | 248,126 | 1 |
| claim | 158,214 | 158,214 | 158,214 | 158,214 | 1 |

The issue row includes fixture issuance. Do not mix its average with the 4,096 fixture issues
in the fragmented suite.

## Fragmented accounts

Command: `forge test --match-contract FragmentedGasTest --gas-report --isolate -vvvv`.

Each test starts with **1,024 distinct mature IDs**, one USDC each, in one holder's heap.
Each operation consumes 32 complete buckets. Selected-date paths use the newest 32 IDs in
descending order, skipping the older 992; payment goes to an initially empty EOA.
Convenience withdrawal removes the oldest 32 IDs instead.

| Operation | Vault call gas |
| --- | ---: |
| Heap-first convenience withdrawal, 32 buckets | **3,150,899** |
| Selected-date withdrawal, 32 buckets | **831,045** |
| Selected-date spot extension, 32 buckets | **959,771** |
| Caller-ordered payment, 32 buckets | **2,655,516** |

These are specific heap layouts, not worst-case bounds or Arc fee quotes. Heap updates still
cost O(log N) per affected date. Selected dates let a holder skip unwanted dust; they do not
make arbitrary fragmentation free. Duplicate checks cost at most 496 comparisons per 32-ID list.

## Regression coverage and limits

New tests cover persistent invoices with mixed partial issuance/payment and rejected retries;
stateful reuse of existing invoices; arbitrary payment order across UTC midnight; explicit spot
extension; selected mature-date validation, atomic failure and 32/33 boundaries; 1,024-bucket
accounts; false-return and no-return ERC-20 movements; and hostile ERC-1155 callbacks that
reenter or return an invalid acceptance selector. The extend → transfer → early-M payment
regression remains green.

Invariant handler calls include unavailable-action no-ops and explicitly expected rejected retries.
They are not a claim that every generated call was a successful vault operation.

Offline journal tests cover repeated resumed prefixes, pending transactions, lost RPC acknowledgements,
failure before RPC acceptance, mined failures, immutable run identity/maturity, and explicit zero-income
consent. Signed transactions are saved before submission; retries use identical bytes and never
automatically replace mined failures. Preserve the run directory and use the original arguments.

The lockfile pins the complete ethers dependency tree, including registry URLs and integrity hashes
recovered from existing host lockfiles. A fresh package download/install was not performed.
Browser-only render dependencies were removed because the fallback SVG renderer uses Node built-ins.
No suitable browser-free Mermaid renderer was found in the local pnpm package index; the SVG is a
hand-laid counterpart of the Mermaid source, ready for external rasterization.

No live RPC calls, broadcasts, or Blockscout submissions were made in this hardening pass.
The parallel deployment's `deployments/` files were not modified. Live Arc validation belongs to
the separate redeployment run; this report describes the revised source and local tests.
