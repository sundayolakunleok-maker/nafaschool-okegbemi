\# NafaSchool Architecture Decision Record #2



\*\*Project:\*\* NafaSchool School Fee Management System  

\*\*Feature:\*\* Recording School Fee Payments  

\*\*Decision:\*\* Simple Layered Monolithic Architecture with PostgreSQL  

\*\*Status:\*\* Accepted  

\*\*Author:\*\* Sunday Okegbemi  

\*\*Date:\*\* 25 November 2026



\## 1. Context



NafaSchool is being developed for Complexe Scolaire Les Palmiers in Pikine, Senegal. The school manages approximately 380 pupils and has one administrator, Mariama Diallo.



The application must work within a limited budget, support inexpensive devices, and account for unreliable internet connectivity. It will be developed and maintained by one developer.



Since the system handles school fee payments, protecting financial records and ensuring accurate balances are important requirements.



\## 2. Architecture Options Considered



Three main options were considered:



1\. \*\*SPA with localStorage:\*\* A simple browser-based application that stores records locally. It is inexpensive and easy to maintain but creates a risk of permanent data loss if browser storage or the device fails.

2\. \*\*Layered monolithic web application with PostgreSQL:\*\* A browser interface communicates with a backend API, which applies business rules and stores records in a central PostgreSQL database.

3\. \*\*Distributed/P2P architecture:\*\* Multiple devices maintain and synchronise records. This offers independent operation but introduces unnecessary synchronisation and maintenance complexity for a school with one administrator.



A further comparison examined how the layered architecture could handle temporary internet interruptions through a pending-payment queue.



\## 3. Decision



I selected a simple layered monolithic web application with PostgreSQL.



The application will have:



\- A presentation layer for the administrator's interface.

\- An API layer for receiving and validating requests.

\- An application layer for payment rules and balance calculations.

\- A data layer using PostgreSQL to store records.



Payment validation and balance calculations will take place on the server rather than relying on calculations performed in the browser.



\## 4. Reasons for the Decision



The selected architecture provides centralised financial records, database constraints, reliable transactions, and a foundation for backups and recovery.



It is suitable for a school with approximately 380 pupils and one administrator. It also allows the application to remain a single codebase that one developer can maintain.



\## 5. Alternatives Rejected



\*\*SPA with localStorage:\*\* Rejected because financial records stored only in browser storage could be lost through device failure, browser data clearing, or accidental deletion.



\*\*Distributed/P2P architecture:\*\* Rejected because the school does not currently need multiple devices independently synchronising payment records. The added complexity would be difficult to justify.



\## 6. Consequences and Trade-offs



The selected architecture introduces responsibilities such as hosting, database security, backups, maintenance, and internet availability.



During an internet interruption, Mariama may be unable to confirm a payment immediately. A pending-payment mechanism may be added, but a payment will only be treated as confirmed after successful server processing.



Regular backup and recovery testing will be required.



\## 7. Final Justification



I selected this architecture because school fee records are financial records that must be protected against accidental loss and incorrect calculations.



The system should remain simple enough for one developer to maintain while providing a safer and more reliable way to manage pupil payments than browser-only storage.



\*\*Decision owner:\*\* Sunday Okegbemi

