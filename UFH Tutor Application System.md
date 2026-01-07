# UFH Tutor Application System



###### Build a full-stack, secure, accessible, and responsive tutor application website specifically for University of Fort Hare (UFH) students.



##### Target Users



University of Fort Hare students applying to become tutors



Admin users (UFH staff / recruiters)



###### Core Requirements

###### 1\. Authentication \& User Accounts



Students must be able to log in using their official University of Fort Hare student email address and password



If a student does not have an account:



Provide account registration using student email + password



###### Implement:



Secure password hashing



Email format validation (restrict to UFH student email domain)



Login error handling and feedback



Password reset functionality



###### 2\. Student Tutor Application Form



Collect all information a recruiter would normally request in a job application, including but not limited to:



Personal Information



Full names



Student number



Date of birth



Gender (optional)



Nationality



Residential address



Contact number



Email (auto-filled from account)



Academic Information



Degree program



Faculty and department



Current year of study



Subjects/modules completed



Subjects/modules applying to tutor



Academic transcript upload



Employment-Style Information



Previous tutoring experience (if any)



Work experience (if any)



Skills and competencies



Languages spoken



Availability (days and times)



Motivation / cover letter (text area)



###### 3\. Document Uploads



Allow students to securely upload required documents:



Certified ID copy (must be clearly stated as certified)



Academic transcript



CV / Resume (PDF)



Proof of registration



Any additional supporting documents



###### Requirements:



Accept only secure file types (PDF, JPG, PNG)



File size limits



Upload progress indicators



Clear validation and error messages



##### 4\. Admin Dashboard (Backend)



Create a separate admin panel with authentication.



Admins must be able to:



View all submitted tutor applications



Search and filter applications (by faculty, subject, status, etc.)



Open full application details



View and download uploaded documents



Approve or reject applications



When rejecting:



Admin must provide a reason for rejection



Reason is saved and visible to the student



Change application status:



Pending



Approved



Rejected



##### 5\. Student Dashboard



After logging in, students should be able to:



View application status in real time



See admin feedback or rejection reasons



Edit application while still pending



Receive confirmation messages after submission



View a friendly progress tracker (e.g., Submitted → Under Review → Approved/Rejected)



##### 6\. Accessibility \& UX



Fully accessible (WCAG-friendly):



Proper labels



Keyboard navigation



Screen-reader support



Mobile-first responsive design



Works smoothly on:



Desktop



Tablet



Mobile devices



Fun, interactive UI:



Friendly illustrations or icons



Progress bars



Smooth animations (subtle, not distracting)



Positive, student-friendly tone



##### 7\. Technical Requirements



Full-stack architecture:



Frontend + Backend + Database



Secure API communication



Role-based access control (Student vs Admin)



Form validation (client + server side)



Secure file storage



Error handling and logging



##### 8\. Branding \& Theme



University-student friendly look and feel



Professional but welcoming



Use neutral academic colors with fun highlights



Clear call-to-action buttons



##### 9\. Optional Enhancements (Nice to Have)



Email notifications for:



Account creation



Application submission



Approval or rejection



Admin analytics dashboard



Application submission deadlines



Save draft functionality



Final Output Expectation



Deliver:



A fully working full-stack web application



Clean, well-structured code



Accessible, responsive UI



Secure backend with admin control



Ready for real student usage



Design inspiration: Modern university portals with clean layouts, academic professionalism balanced with student-friendly warmth. Using UFH's academic identity with deep blues, fresh teals, and warm gold accents.



#### First version features:



Landing page with clear CTAs

Authentication (UFH email validation)

Multi-step application form

Student dashboard with status tracker

Admin dashboard for reviewing applications

Document upload system



##### ✅ Features Implemented:



Landing page with beautiful hero, benefits section, and application process overview

Authentication with UFH email validation (@ufh.ac.za), secure password requirements, and role-based access

Multi-step application form (5 steps: Personal → Academic → Experience → Documents → Review)

Document uploads with file validation (PDF/JPG/PNG, 5MB limit)

Student dashboard with real-time status tracking and progress visualization

Admin dashboard with search, filters, application review, approve/reject with reasons

Secure database with RLS policies protecting all data

Accessible design with proper labels, keyboard navigation, and semantic HTML

🎨 Design: Professional academic blue with warm gold accents, responsive layout, smooth animations, and WCAG-friendly accessibility.



🔐 Security: Role-based access control, secure file storage, input validation with Zod, and Row Level Security on all tables.



To test as admin, you'll need to manually add an admin role for a user in the database after they sign up.



### **Fixes:**

On the sign up page, i must be able to toggle between admin/student user login

Figure out how the backend will work

Before application is under review, student is given a chance to edit their application, however, the edit button goes to the 404 not found page. It should allow the user to edit their info and all changes must reflect in the database.

When the application is under review, the view button also goes to the 404 not found page, that button should allow the user to view their application and its info and status.



