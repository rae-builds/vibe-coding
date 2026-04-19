import { createClient } from 'redis';

// Serverless 환경에서 재사용하기 위해 밖에서 선언
let redisClient = null;

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed. GET 방식만 허용됩니다.' });
    }

    try {
        if (!process.env.REDIS_URL) {
            return res.status(500).json({ error: 'REDIS_URL 환경변수가 로드되지 않았습니다.' });
        }

        if (!redisClient) {
            const isRediss = process.env.REDIS_URL.startsWith('rediss://');
            redisClient = createClient({
                url: process.env.REDIS_URL,
                ...(isRediss ? { socket: { tls: true } } : {})
            });
            redisClient.on('error', (err) => console.error('Redis Client Error', err));
            await redisClient.connect();
        }

        let cursor = '0';
        let allKeys = [];

        // 1. SCAN 명령어를 통해 diary-* 패턴을 가진 모든 키 검색 (안전한 방식)
        do {
            const reply = await redisClient.scan(cursor, {
                MATCH: 'diary-*',
                COUNT: 100
            });
            cursor = reply.cursor.toString(); // 다음 커서도 문자열로 보장
            allKeys.push(...reply.keys);
        } while (cursor !== '0');

        // 일기가 하나도 없는 경우 빈 배열 반환
        if (allKeys.length === 0) {
            return res.status(200).json({ history: [] });
        }

        // 2. MGET 명령어를 통해 모든 키의 값을 한 번에 가져오기
        const values = await redisClient.mGet(allKeys);
        
        // 3. JSON 파싱 및 시간순(최신순) 정렬
        const history = values
            .filter(val => val !== null) // null 값 제거 (혹시 모를 삭제된 키 대비)
            .map(val => JSON.parse(val))
            .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); 

        return res.status(200).json({ history });
    } catch (error) {
        console.error("Redis History 조회 에러:", error);
        return res.status(500).json({ error: '히스토리 로딩 중 오류 발생: ' + error.message });
    }
}
