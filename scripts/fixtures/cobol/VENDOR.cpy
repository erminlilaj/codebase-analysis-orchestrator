       01  VENDOR-RECORD.
           05  VEND-ID            PIC X(6).
           05  VEND-NAME          PIC X(40).
           05  VEND-CONTACT       PIC X(30).
           05  VEND-PAYMENT-TERMS PIC X(10).
           05  VEND-BALANCE-DUE   PIC S9(9)V99 COMP-3.
           05  VEND-STATUS        PIC X.
               88  VEND-ACTIVE    VALUE 'A'.
               88  VEND-SUSPENDED VALUE 'S'.
