# TeamSync: Student Portal & Academic Roles Workflow

This document provides a highly detailed overview of the entire Student experience on the TeamSync / SGP platform, mapping out every small feature. It also explains exactly how the **Faculty Guide** and **Department Coordinator** interact with the student's data and workflows.

---

## 1. Project & Proposal Module (Multi-Proposal Workflow)
The cornerstone of the project lifecycle. This is where students form their idea and get it approved.

### Student Capabilities
* **3-Slot Submission System:** Students can submit and manage up to 3 separate project ideas (slots).
* **Slot Counter:** A visual `X / 3 Used` counter shows how many submissions are currently consumed.
* **Drafts & Submission:** Proposals start as `DRAFT` and change to `SUBMITTED` when sent to the faculty.
* **Auto-Locking:** Once submitted, the proposal is strictly **locked**. Students cannot edit a pending proposal.
* **Revision Cycles:** If faculty requests revisions, the specific proposal unlocks. Students can edit and resubmit without consuming a new slot.
* **Rejection Refunds:** If a proposal is fully rejected, the slot is refunded, allowing the student to submit a completely new idea.
* **Independent Proposal Slots & Activation:** Students can create, draft, and submit up to 3 separate project proposals. Proposals are evaluated independently, and students can continue to draft and submit proposals up to their 3 active slots even if one proposal is already approved.
* **Post-Approval Change Requests:** Students cannot directly edit an approved project. They must use the "Request Changes" modal, selecting specific fields (e.g., Tech Stack, Problem Statement) they want to alter.

### Faculty Capabilities
* **Independent Review:** Faculty can review each of the 3 proposals independently.
* **Review Actions:** Faculty can click `APPROVE`, `REQUEST REVISION`, or `REJECT`.
* **Feedback:** Mandatory comments/feedback must be provided on Revisions and Rejections.
* **Granular Edit Approval:** When students request a change to an approved project, faculty can `APPROVE EDITING`, which temporarily unlocks *only* the requested fields (e.g., Tech Stack) for the students.

### Coordinator Capabilities
* **Oversight:** Coordinators can view all groups and their active proposal statuses across the entire department.
* **Force Approval/Rejection:** In edge cases, Coordinators can step in and forcefully approve or reject proposals if the assigned faculty is unavailable.

---

## 2. Software Requirements Specification (SRS) Module
A dedicated space to define the functional architecture of the project.

### Student Capabilities
* **FR & NFR Separation:** Requirements are strictly divided into Functional (FR-XXX) and Non-Functional (NFR-XXX). IDs are auto-generated.
* **Summary Metrics:** Dynamic counters display Total Requirements, Functional, Non-Functional, and Implemented metrics.
* **Feature Linking:** When creating a requirement, students can check boxes to link it directly to project `Features`. 
* **Full CRUD:** Students can View, Create, Edit, and Delete requirements.
* **Traceability Matrix:** A dynamic HTML table showing the real-time link chain: `Requirement → Features → Tasks → Bugs`. 
* **Dynamic Progress Tracking:** Requirement completion is updated based on the status of linked Features and Tasks (no fake/hardcoded progress allowed).

### Faculty Capabilities
* **Review & Verification:** Faculty have read-only access to view the SRS definitions to ensure they align with the approved proposal.
* **Matrix Auditing:** Faculty can use the Traceability Matrix to grade whether a student's code (Tasks/Bugs) actually maps back to the approved project requirements.
* **Commenting (Upcoming):** Faculty will be able to leave comments on specific requirements if they are poorly defined.

### Coordinator Capabilities
* **Global SRS View:** Coordinators can audit any group's Requirements page to ensure departmental quality standards are being met.

---

## 3. Work Management (Features & Kanban)
The day-to-day agile execution of the project.

### Student Capabilities
* **Feature Management:** Students define major project features (e.g., "Authentication System") which sit below Requirements but above Tasks.
* **Task Board (Kanban):** A standard To Do, In Progress, In Review, Done board.
* **Task Linking:** Tasks can be linked to `Features` or `Sprints`.
* **Bug Tracking:** Students can log Bugs and assign them to specific Tasks or Features.
* **Assignees:** Tasks and Bugs can be assigned to specific group members.

### Faculty Capabilities
* **Sprint Monitoring:** Faculty can view the Kanban board to track weekly progress.
* **Status Overrides:** Faculty can move tasks back to "In Progress" if a student falsely marks something as "Done" during a sprint review.
* **Defect Injection:** Faculty can log `Bugs` on a student's project if they find an issue during weekly evaluations.

### Coordinator Capabilities
* **Velocity Metrics:** Coordinators can see aggregate sprint progress to identify groups that are falling behind schedule.

---

## 4. Group & Member Management
The administrative core for students.

### Student Capabilities
* **View Members:** See the Enrollment Number, Role (Leader vs. Member), and Contact Info of teammates.
* **Faculty Guide Info:** See the name and contact details of their assigned Faculty Guide.

### Faculty Capabilities
* **Group List:** See all assigned groups in their dashboard.
* **Communication:** Direct access to student emails/contact info.

### Coordinator Capabilities
* **Group Creation/Mutation:** Coordinators are responsible for creating the groups, assigning students to them, and mapping groups to specific Faculty Guides.
* **Re-Assignment:** If a faculty member leaves, the Coordinator can re-assign the group to a new guide.

---

## 5. Security & Isolation Architecture

* **Strict Data Boundaries (Multi-Tenancy):** A student can **never** see the proposals, requirements, or tasks of another group. All database queries strictly filter by `projectId` and `groupId`.
* **Faculty Boundaries:** A Faculty member can **never** view data for groups that are not explicitly assigned to them.
* **Audit Logging:** Every major action (Proposal Submission, Faculty Approval, Requirement Deletion, Task Status Change) generates a timestamped log tracking *Who, What, and When*.
