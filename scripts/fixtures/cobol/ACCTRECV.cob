       IDENTIFICATION DIVISION.
       PROGRAM-ID. ACCTRECV.
       AUTHOR. THESIS-FIXTURE.

       ENVIRONMENT DIVISION.

       DATA DIVISION.
       WORKING-STORAGE SECTION.
       COPY CUSTOMER.
       01  WS-OVERDUE-BALANCE     PIC S9(9)V99 COMP-3.
       01  WS-PENALTY-RATE        PIC V999 VALUE 0.015.
       01  WS-PENALTY-AMT         PIC S9(7)V99 COMP-3.
       01  WS-DAYS-OVERDUE        PIC 9(3).

       PROCEDURE DIVISION.
       MAIN-PROCEDURE.
           PERFORM APPLY-LATE-PENALTY
           STOP RUN.

       APPLY-LATE-PENALTY.
           IF NOT CUST-ACTIVE
               DISPLAY 'Inactive customer: ' CUST-NAME
               STOP RUN
           END-IF
           IF WS-DAYS-OVERDUE > 30
               COMPUTE WS-PENALTY-AMT =
                   CUST-BALANCE * WS-PENALTY-RATE
               ADD WS-PENALTY-AMT TO CUST-BALANCE
               DISPLAY 'Late penalty applied to: ' CUST-NAME
               DISPLAY 'New balance: ' CUST-BALANCE
           END-IF.
