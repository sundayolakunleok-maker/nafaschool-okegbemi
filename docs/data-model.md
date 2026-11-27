# NafaSchool Database Data Model

## 1. Project Overview

NafaSchool is a school fee management system for Complexe Scolaire Les Palmiers in Pikine, Senegal. It manages pupil information, guardian details, school fee schedules and payment records.

The database will use PostgreSQL to store financial records centrally.

## 2. Database Entities

### A. Guardian

Stores parent or guardian details.

| Field | Data Type | Description |
|---|---|---|
| id | INTEGER | Primary key |
| name | TEXT | Guardian's full name |
| phone | TEXT | Guardian's phone number |

### B. Pupil

Stores pupil information and links each pupil to a guardian.

| Field | Data Type | Description |
|---|---|---|
| id | INTEGER | Primary key |
| name | TEXT | Pupil's full name |
| class | TEXT | Pupil's class |
| guardian_id | INTEGER | Foreign key referencing Guardian |

### C. FeeSchedule

Stores the approved school fee for each term.

| Field | Data Type | Description |
|---|---|---|
| id | INTEGER | Primary key |
| term | TEXT | Academic term |
| amount | INTEGER | Fee amount in XOF |
| installments_allowed | INTEGER | Maximum number of installments |

Project fee amount: 90,000 XOF.

Maximum installments: 3.

### D. Payment

Stores individual payments made by pupils.

| Field | Data Type | Description |
|---|---|---|
| id | INTEGER | Primary key |
| pupil_id | INTEGER | Foreign key referencing Pupil |
| amount | INTEGER | Amount paid in XOF |
| method | TEXT | Payment method |
| request_id | TEXT | Unique client request identifier |
| recorded_at | TIMESTAMPTZ | Date and time payment was recorded |

## 3. Relationships

- One guardian can be associated with many pupils.
- Each pupil belongs to one guardian.
- One pupil can have many payment records.
- Each payment belongs to one pupil.
- A fee schedule defines the approved fee and installment limit for a term.

## 4. Data Integrity Rules

1. Every pupil must have a valid guardian.
2. Every payment must belong to an existing pupil.
3. Payment amounts must be positive.
4. Each payment request ID must be unique to prevent duplicate payment records.
5. Fee amounts and installment limits are stored in the FeeSchedule table.
6. Outstanding balances and installments used are calculated by the server, not stored as permanent pupil fields.
7. Database constraints protect relationships and required fields.

## 5. Server-Side Calculations

The backend will calculate:

- Total fees due.
- Total payments received.
- Number of installments used.
- Outstanding balance.

Calculations will use central PostgreSQL records rather than figures supplied by the browser.

## 6. Database Technology

- Database: PostgreSQL
- Hosting: Neon PostgreSQL
- Application: NafaSchool
- Currency: West African CFA franc (XOF)

This data model supports accurate payment records, reliable balance calculations and future reporting.
