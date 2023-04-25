CC = gcc
INC = -I${MARIADB}/include/mysql -I${TMAXDIR} -I. 

CFLAGS = -m64 -O2 -g -Wall -W ${INC} 
BDIR= ${AQTHOME}/cbin
TMAXDIR = /tmax
MARIADB = /usr/local/mysql

LDFLAGS = 
LDLIBS = -L${MARIADB}/lib -L${TMAXDIR}/lib64 -lmariadb -lcli
TARGETS = aqt_sendS aqt_sendM aqt_request aqt_reqsub aqt_sendM2 aqt_rnsend2
all : $(TARGETS:%=$(BDIR)/%)

${BDIR}/aqt_rnsend2: aqt_rnsend2.c
	${CC} ${CFLAGS} -o $@ $? -D_TMAX_MTLIB -pthread -L${MARIADB}/lib -L${TMAXDIR}/lib64 -lmariadb -lclithr 

${BDIR}/aqt_sendM2: aqt_sendM2.c
	${CC} ${CFLAGS} -o $@ $? -D_TMAX_MTLIB  -pthread -L${MARIADB}/lib -L${TMAXDIR}/lib64  -lmariadb -lclithr

${BDIR}/aqt_sendS: aqt_sendS.c
	${CC} ${CFLAGS} -o $@ $? -L${MARIADB}/lib -lmariadb 

${BDIR}/aqt_request: aqt_request.c
	${CC} ${CFLAGS} -o $@ $? -L${MARIADB}/lib -lmariadb 

${BDIR}/aqt_sendM: aqt_sendM.c
	${CC} ${CFLAGS} -o $@ $? ${LDLIBS} 

${BDIR}/aqt_reqsub: aqt_reqsub.c
	${CC} ${CFLAGS} -o $@ $? ${LDLIBS} 

.c.o:

#%.o: %.c aqt2.h