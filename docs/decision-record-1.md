\# Decision Record #1: AI Model Selection and Trust Rules



\## 1. Model and Gateway Choice



\*\*Selected AI Gateway:\*\* OpenRouter



\*\*Selected Model:\*\* DeepSeek V3.2



\*\*Development Environment:\*\* OpenCode



\*\*Reason for the Decision:\*\*

OpenRouter was selected because it provides access to AI models through a unified gateway and supports the project's low-cost development requirement. DeepSeek V3.2 was selected for coding assistance, debugging, and implementation tasks.



\*\*Alternatives Considered:\*\*

\- Ollama (local models): Considered as a possible local alternative, but not selected as the primary model because local hardware requirements and setup may limit performance.

\- Paid models: Not selected as the primary option due to the project's cost constraints.



\*\*Consequences:\*\*

\- Development requires internet access when using OpenRouter.

\- Model usage may be affected by provider availability and usage limits.

\- A local Ollama fallback may be considered after it has been installed and tested.



\## 2. Trust Rules for AI-Generated Changes



\### Changes requiring line-by-line review and testing



The following must be manually reviewed and tested before merging:



\- Fee calculation and termly balance calculations.

\- Payment recording and financial data.

\- Database schema changes.

\- Transaction handling.

\- Data deletion and migrations.

\- Security and authentication boundaries.



The fee calculation requirement includes:



\*\*45,000 XOF + (D × 5,000 XOF)\*\*



Any implementation of this formula must be checked against the project requirements before acceptance.



\### Changes requiring a lighter review



The following may receive a lighter review, but must still be tested:



\- Boilerplate code.

\- UI styling and layout.

\- Test scaffolding.

\- Non-critical presentation changes.



\## 3. Approval Rule



AI-generated code must not be merged automatically. A human must review the changes, run relevant tests, and confirm that the changes meet project requirements before merging.

