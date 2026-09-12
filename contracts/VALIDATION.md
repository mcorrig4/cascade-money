# Local validation

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
