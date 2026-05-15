       IDENTIFICATION DIVISION.
       PROGRAM-ID. EMPLOYEE.
       AUTHOR. THESIS-FIXTURE.

       ENVIRONMENT DIVISION.

       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  WS-EMPLOYEE-RECORD.
           05  EMP-ID             PIC 9(5).
           05  EMP-NAME           PIC X(30).
           05  EMP-DEPARTMENT     PIC X(20).
           05  EMP-SALARY         PIC S9(7)V99 COMP-3.
           05  EMP-HIRE-DATE      PIC 9(8).
           05  EMP-STATUS         PIC X.
               88  EMP-ACTIVE     VALUE 'A'.
               88  EMP-TERMINATED VALUE 'T'.
       01  WS-ANNUAL-RAISE        PIC S9(7)V99 COMP-3.
       01  WS-RAISE-PERCENT       PIC V99 VALUE 0.03.

       PROCEDURE DIVISION.
       MAIN-PROCEDURE.
           PERFORM APPLY-RAISE
           STOP RUN.

       APPLY-RAISE.
           IF NOT EMP-ACTIVE
               DISPLAY 'Skipping terminated employee: ' EMP-NAME
               STOP RUN
           END-IF
           COMPUTE WS-ANNUAL-RAISE = EMP-SALARY * WS-RAISE-PERCENT
           ADD WS-ANNUAL-RAISE TO EMP-SALARY
           DISPLAY 'Updated salary for ' EMP-NAME ': ' EMP-SALARY.
