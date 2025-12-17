#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <mysql.h>
#include <pthread.h>
#include <stdbool.h>
#include <unistd.h>
#include "aqt2.h"
#define POOL_SIZE 5

// 커넥션 풀 구조체
typedef struct {
    MYSQL *conn;
    bool in_use;
} ConnectionWrapper;

ConnectionWrapper connection_pool[POOL_SIZE];
pthread_mutex_t pool_mutex;
pthread_cond_t pool_cond;

// MariaDB 서버 연결 초기화
void init_db_connection(MYSQL **conn) {
    *conn = mysql_init(NULL);
    if (!(*conn)) {
        fprintf(stderr, "mysql_init failed\n");
        return;
    }
    if (!mysql_real_connect(*conn, DBHOST, DBUSER, DBPASS, DBNAME, DBPORT, DBSOCKET, 0)) {
        fprintf(stderr, "Failed to connect to database: %s\n", mysql_error(*conn));
        mysql_close(*conn);
        *conn = NULL;
    }
}

// 커넥션 풀 초기화
void init_connection_pool() {
    pthread_mutex_init(&pool_mutex, NULL);
    pthread_cond_init(&pool_cond, NULL);
    for (int i = 0; i < POOL_SIZE; ++i) {
        init_db_connection(&connection_pool[i].conn);
        connection_pool[i].in_use = false;
    }
}

// 풀에서 커넥션 가져오기
MYSQL* get_connection_from_pool() {
    pthread_mutex_lock(&pool_mutex);
    for (int i = 0; i < POOL_SIZE; ++i) {
        if (!connection_pool[i].in_use && connection_pool[i].conn) {
            // 커넥션 유효성 검사 (선택 사항이지만 권장)
            if (mysql_ping(connection_pool[i].conn) != 0) {
                // 연결이 끊어졌다면 다시 연결 시도
                mysql_close(connection_pool[i].conn);
                init_db_connection(&connection_pool[i].conn);
                if (!connection_pool[i].conn) {
                    continue; // 연결 실패 시 다음 커넥션 확인
                }
            }
            connection_pool[i].in_use = true;
            pthread_mutex_unlock(&pool_mutex);
            return connection_pool[i].conn;
        }
    }
    
    // 사용 가능한 커넥션이 없으면 대기 (또는 오류 반환)
    // 여기서는 간단히 NULL 반환
    pthread_mutex_unlock(&pool_mutex);
    return NULL;
}

// 풀로 커넥션 반환
void release_connection_to_pool(MYSQL *conn) {
    pthread_mutex_lock(&pool_mutex);
    for (int i = 0; i < POOL_SIZE; ++i) {
        if (connection_pool[i].conn == conn) {
            connection_pool[i].in_use = false;
            // 대기 중인 스레드에게 알림 (조건 변수 사용)
            pthread_cond_signal(&pool_cond); 
            break;
        }
    }
    pthread_mutex_unlock(&pool_mutex);
}

// 커넥션 풀 종료
void close_connection_pool() {
    for (int i = 0; i < POOL_SIZE; ++i) {
        if (connection_pool[i].conn) {
            mysql_close(connection_pool[i].conn);
        }
    }
    pthread_mutex_destroy(&pool_mutex);
    pthread_cond_destroy(&pool_cond);
}
