CC = gcc
INC = -I${MARIADB_HOME}/include/mysql -I${TMAXDIR} -I. 

CFLAGS = -m64 -O2 -g -Wall -W ${INC} 
BDIR= ${AQTHOME}/cbin
TMAXDIR = /tmax

LDFLAGS = 
LDLIBS = -L${MARIADB_HOME}/lib -L${TMAXDIR}/lib64 -lmariadb -lcli
TARGETS = aqt_sendS aqt_sendM aqt_request aqt_reqsub aqt_sendM2 aqt_rnsend2
.PHONY: all clean
all : $(TARGETS:%=$(BDIR)/%)

${BDIR}/aqt_rnsend2: aqt_rnsend2.c
	${CC} ${CFLAGS} -o $@ $? -D_TMAX_MTLIB -pthread -L${MARIADB_HOME}/lib -L${TMAXDIR}/lib64 -lmariadb -lclithr 

${BDIR}/aqt_sendM2: aqt_sendM2.c
	${CC} ${CFLAGS} -o $@ $? -D_TMAX_MTLIB  -pthread -L${MARIADB_HOME}/lib -L${TMAXDIR}/lib64  -lmariadb -lclithr

${BDIR}/aqt_sendS: aqt_sendS.c
	${CC} ${CFLAGS} -o $@ $? -L${MARIADB_HOME}/lib -lmariadb 

${BDIR}/aqt_request: aqt_request.c
	${CC} ${CFLAGS} -o $@ $? -L${MARIADB_HOME}/lib -lmariadb 

${BDIR}/aqt_sendM: aqt_sendM.c
	${CC} ${CFLAGS} -o $@ $? ${LDLIBS} 

${BDIR}/aqt_reqsub: aqt_reqsub.c
	${CC} ${CFLAGS} -o $@ $? ${LDLIBS} 

.c.o:

clean:
	rm $(TARGETS:%=$(BDIR)/%)

#%.o: %.c aqt2.h