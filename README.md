
# NafaSchool
### A Simple and Reliable School Fee Management System

## 1. The Problem

Complexe Scolaire Les Palmiers is a low-cost private school located in Pikine, Senegal, with approximately 380 pupils. The school currently records school fee payments manually in paper ledgers and later transfers the information into spreadsheets.

This manual process creates problems with tracking payments, calculating outstanding balances, and reconciling cash and mobile-money transactions. Sometimes payments are lost or parents are incorrectly informed that they still owe school fees.

NafaSchool is designed to provide a reliable digital system for pupil registration, school fee management, payment recording, and automatic calculation of outstanding balances.

## 2. The User

The primary user of NafaSchool is Mariama Diallo, the school administrator of Complexe Scolaire Les Palmiers.

She is responsible for registering pupils and their guardians, setting termly school fees, recording cash and mobile-money payments, and monitoring outstanding balances.

The application will be designed to be simple, reliable, and practical for a school with limited financial and technological resources.

## 3. What NafaSchool Will Not Do

NafaSchool will focus specifically on pupil registration, guardian information, termly fee schedules, payment recording, and outstanding balance management.

The application will not include:

- Student grading or examination management.
- School timetabling.
- Messaging or communication services.
- Management of multiple schools.

The main objective is to provide one reliable school fee management system that helps the administrator maintain accurate payment records and reduce errors in fee reconciliation.

## 4. API (development)

- `GET /health` — service health check.
- `POST /pupils` — register a pupil and guardian.
- `POST /payments` — record a school fee payment.

> **Development only:** `POST /payments` is currently unauthenticated and has no
> authorisation checks. It must not be treated as production-ready until
> authentication, authorisation, rate limiting and audit logging are added.

See [docs/payments-api.md](docs/payments-api.md) for the payment contract,
installment policy, migration steps and test instructions.


