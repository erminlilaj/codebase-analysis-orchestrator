       01  CUSTOMER-RECORD.
           05  CUST-ID            PIC 9(6).
           05  CUST-NAME          PIC X(40).
           05  CUST-BALANCE       PIC S9(7)V99 COMP-3.
           05  CUST-STATUS        PIC X.
               88  CUST-ACTIVE    VALUE 'A'.
               88  CUST-INACTIVE  VALUE 'I'.
