import { createClient } from 'redis';
import { supabaseAdmin } from '../lib/supabase.js';

// Serverless 환경에서 재사용하기 위해 밖에서 선언
let redisClient = null;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. POST 방식만 허용됩니다.' });
    }

    const { text } = req.body;
    if (!text) {
        return res.status(400).json({ error: '분석할 텍스트(일기)가 필요합니다.' });
    }

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

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "여기에_발급받은_API_키를_붙여넣으세요") {
        return res.status(500).json({ error: '서버에 GEMINI_API_KEY 환경변수가 설정되지 않았습니다. .env 파일을 확인해주세요.' });
    }

    try {
        // 구글 Gemini API 호출 (최신 1.5-flash-latest 모델 사용)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            { text: `너는 심리상담가야. 사용자가 작성한 일기 내용을 읽고, 사용자의 감정을 한 단어(예:기쁨, 슬픔, 분노, 불안, 평온)로 요약해줘. 그리고 그 감정에 공감해주고, 따뜻한 응원의 메세지를 2-3문장으로 작성해줘. 답변 형식은 반드시 '감정:[요약된 감정]\\n\\n[응원메세지]'와 같이 줄바꿈을 포함해서 보내줘.\n\n사용자 일기:\n${text}` }
                        ]
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Gemini API 호출 중 에러 발생');
        }

        const data = await response.json();
        const aiResponse = data.candidates[0].content.parts[0].text;

        // Redis에 저장할 데이터 준비
        const now = new Date();
        const timeString = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14); // YYYYMMDDHHMMSS
        
        // 사용자 고유 ID를 포함한 키 구조로 변경
        const diaryKey = `user:${user.id}:diary:${timeString}`;
        
        const diaryEntry = {
            text: text,
            aiResponse: aiResponse,
            timestamp: now.toISOString()
        };

        try {
            if (!redisClient) {
                // REDIS_URL 환경변수 존재 여부 먼저 체크
                if (!process.env.REDIS_URL) {
                    throw new Error("REDIS_URL 환경변수가 로드되지 않았습니다. .env 파일을 확인하거나 터미널을 재시작하세요.");
                }
                const isRediss = process.env.REDIS_URL.startsWith('rediss://');
                redisClient = createClient({
                    url: process.env.REDIS_URL,
                    // redis:// 일 때는 tls 속성을 아예 주지 않고, rediss:// 일 때만 적용 또는 생략(라이브러리가 알아서 처리)
                    ...(isRediss ? { socket: { tls: true } } : {})
                });
                redisClient.on('error', (err) => console.error('Redis Client Error', err));
                await redisClient.connect();
            }
            
            // Redis에 데이터 저장
            await redisClient.set(diaryKey, JSON.stringify(diaryEntry));
            console.log(`[Redis 저장 완료] Key: ${diaryKey}`);
        } catch (redisError) {
            console.error('Redis 저장 실패:', redisError);
            // 저장이 실패해도 사용자에게 응답은 주어야 하므로 진행
        }

        // 프론트엔드로 성공적인 분석 결과 반환
        return res.status(200).json({ result: aiResponse });
    } catch (error) {
        console.error("API 연동 에러:", error);
        return res.status(500).json({ error: 'AI 분석 중 오류가 발생했습니다: ' + error.message });
    }
}
