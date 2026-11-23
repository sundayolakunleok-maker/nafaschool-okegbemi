\# NafaSchool Model Selection Policy



\## 1. Purpose



This policy explains how AI models are selected and used during the development of NafaSchool.



\## 2. Primary Model and Gateway



\- \*\*AI gateway:\*\* OpenRouter.

\- \*\*Primary model:\*\* DeepSeek V3.2.

\- \*\*Development tool:\*\* OpenCode.

\- \*\*Reason for selection:\*\* It provides access to an AI coding model while supporting the project's low-cost development requirement.



\## 3. Model Use Rules



\- Use the primary model for routine coding assistance, explanations, and development tasks.

\- Review AI-generated code before accepting or merging changes.

\- Run relevant tests after code changes.

\- Do not assume generated code is correct simply because it runs.

\- Do not submit real student, parent, or staff confidential information to an AI model.



\## 4. High-Risk Changes



Manually inspect and test changes involving:



\- Fee calculations and outstanding balances.

\- Payment recording and financial records.

\- Database structure and migrations.

\- User authentication and access permissions.

\- Data deletion and transaction handling.

\- Security and privacy controls.



\## 5. Lower-Risk Changes



Routine interface styling, boilerplate, and test scaffolding may receive a lighter review, but they must still be checked and tested.



\## 6. API Key and Data Protection



\- Keep API keys private.

\- Store credentials outside source code.

\- Never commit API keys or passwords to GitHub.

\- Use sample data during development and testing.



\## 7. Alternative Model



Ollama may be considered as a local fallback after installation and testing. It must not be described as an active fallback until it has been configured and verified.



\## 8. Review and Approval



AI-generated changes must be reviewed by a human before they are merged into the main branch. Automated tests and relevant manual checks must pass before acceptance.



\## 9. Policy Review



This policy should be reviewed when the primary model, AI gateway, project requirements, or data protection needs change.

