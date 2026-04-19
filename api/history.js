import { createClient } from 'redis';
import { supabaseAdmin } from '../lib/supabase.js';

// Serverless 환경에서 재사용하기 위해 밖에서 선언
let redisClient = null;

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed. GET 방식만 허용됩니다.' });
    }

    try {
        // 1. 토큰 추출 및 검증
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: '인증 토큰이 없습니다. 다시 로그인해주세요.' });
        }
        const token = authHeader.split(' ')[1];

        if (!supabaseAdmin) {
            return res.status(500).json({ error: '서버 인증 모듈(SUPABASE_SERVICE_ROLE_KEY)이 설정되지 않았습니다.' });
        }

        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            return res.status(401).json({ error: '유효하지 않은 토큰입니다. 다시 로그인해주세요.' });
        }

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

        // 1. SCAN 명령어를 통해 로그인된 사용자의 일기 키만 검색
        do {
            const reply = await redisClient.scan(cursor, {
                MATCH: `user:${user.id}:diary:*`,
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
