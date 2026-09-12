# Cascade: dated dollars on Arc

Solid arrows show vault operations and wallet views. Dashed arrows show the independent reference,
local test evidence, and participant-funded discount window. The backing boxes are alternatives:
USDC is the default; the USYC variant values shares using the backing price.

```mermaid
flowchart TB
    APPLE["Debtor / Apple"] -->|"issue: deposit USDC"| USDC
    subgraph ARC["Arc · EVM · USDC gas"]
        direction TB
        USDC["USDC<br/>6-decimal ERC-20 interface<br/>Default backing"] --> VAULT
        USYC["USYC backing<br/>(mock on testnet, real after allowlist)<br/>Price-valued shares · separate variant"] --> VAULT
        OWNER["Checkpoint owner<br/>Funded delta / backing-price index"] -->|"publish I(d)"| VAULT
        VAULT["Cascade vault<br/>Custody · invoices · backing check"]
        VAULT -->|"issue / claim mint"| DATES["Date mints · ERC-1155<br/>ID = UTC epoch day"]
        DATES -->|"ID ≤ today: spot<br/>Withdrawal burns liability"| VAULT
        DATES --> DISPLAY["Wallet display<br/>Per-date ERC-20 views<br/>On-chain JSON + SVG metadata"]
        DATES -->|"pay / transfer"| PAYEE["Creditor / next supplier<br/>Original date retained"]
        DATES <-->|"burn / mint"| EXTEND["Extend<br/>T1 → T2, only forward<br/>Assign added entitlement interval"]
        VAULT <--> LEDGER["Entitlement ledger<br/>Account · amount · S · E · claimed<br/>Claim mints today-dated spot"]
        EXTEND --> LEDGER
        VAULT -->|"withdraw"| HOLDER["Holder<br/>USDC / backing shares"]
    end
    VAULT -->|"events · balances · receipts"| FRONTEND["Cascade front end"]
    DATES -.->|"principal only"| WINDOW["Separate discount window<br/>Participant-funded · never vault reserve"]
    WINDOW -.->|"prices / yield curve"| FRONTEND
    REF["Python reference implementation<br/>Loss waterfall · stress scenarios<br/>Independent event stream"] -.-> FRONTEND
    LOCAL["Foundry tests<br/>Maturity / claims evidence"] -.-> FRONTEND
```

Date mints and their ERC-20 views share one ledger and one principal supply. Metadata is rendered
on-chain. The USYC mock is the demonstration stand-in; real USYC integration remains allowlist-gated.

Shot 5 uses extension events and entitlement intervals. Shot 7 uses the separate discount window
and reference pricing. Shot 9's accelerated maturity and loss stress are labeled local/reference
runs; public testnet time is never accelerated. Shot 11 uses [architecture.svg](architecture.svg).

The SVG is maintained directly at 1730 × 1200 with dedicated connector lanes and footer margins.
The Mermaid block records the same relationships. The legacy render script's layout has not been
updated in this revision; rasterize this SVG directly rather than regenerating it with that script.
