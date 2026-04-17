# ADR 003: DocuSeal For Signature Execution

## Decision

Use DocuSeal for packet execution instead of building a custom signature engine.

## Why

- Non-core problem already solved by a purpose-built tool
- Supports signer workflows and template-driven packets
- Lower implementation and compliance burden than building signature capture in-house

## Consequences

- The internal app stores workflow truth and metadata, not signature UX state
- Template management is operationally important
