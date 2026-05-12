       IDENTIFICATION DIVISION.
       PROGRAM-ID. PAYROLL.

       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01  EMP-RECORD.
           05  EMP-ID             PIC 9(5).
           05  EMP-NAME           PIC X(30).
           05  GROSS-PAY          PIC S9(7)V99 COMP-3.
           05  TAX-RATE           PIC V99 VALUE 0.22.
           05  NET-PAY            PIC S9(7)V99 COMP-3.

       PROCEDURE DIVISION.
       COMPUTE-PAY.
           COMPUTE NET-PAY = GROSS-PAY * (1 - TAX-RATE).
           DISPLAY 'Net pay for ' EMP-NAME ': ' NET-PAY.
           STOP RUN.
