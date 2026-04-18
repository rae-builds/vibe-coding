export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. POST 방식만 허용됩니다.' });
    }

    const { text } = req.body;
    if (!text) {
        return res.status(400).json({ error: '분석할 텍스트(일기)가 필요합니다.' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === "여기에_발급받은_API_키를_붙여넣으세요") {
        return res.status(500).json({ error: '서버에 GEMINI_API_KEY 환경변수가 설정되지 않았습니다. .env 파일을 확인해주세요.' });
    }

    try {
        // 구글 Gemini API 호출 (최신 2.5-flash 모델 사용)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
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

        // 프론트엔드로 성공적인 분석 결과 반환
        return res.status(200).json({ result: aiResponse });
    } catch (error) {
        console.error("API 연동 에러:", error);
        return res.status(500).json({ error: 'AI 분석 중 오류가 발생했습니다: ' + error.message });
    }
}
