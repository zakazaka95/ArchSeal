# ADR-0001: Contract state is authoritative

Status: Accepted

The ArchSeal interface must display review identities, pinned commits, policies, verdicts, evidence completeness, and seal hashes read from accepted GenLayer contract state. Browser-generated or locally restored verdicts must never be presented as an on-chain seal.

An accepted transaction is not proof of successful execution by itself. The client must check the execution result before reading and displaying the resulting contract state.
