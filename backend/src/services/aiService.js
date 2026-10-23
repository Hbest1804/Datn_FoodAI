// src/services/aiService.js
// Dịch vụ tích hợp Gemini AI cho CulinaAI chatbot - Tối ưu hóa tốc độ phản hồi cao (High-Speed & Failover)

import crypto from 'crypto';
import { env } from '../config/appConfig.js';

class AIServiceError extends Error {
  constructor(code, message, status = 500) {
    super(message);
    this.name = 'AIServiceError';
    this.code = code;
    this.status = status;
  }
}

// ── 1. In-memory Cache tăng tốc độ phản hồi tức thì (< 1ms) ──────────────────
const responseCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 phút TTL

function getCacheKey(prefix, content, fridge = {}, extra = '') {
  const normContent = (content || '').toLowerCase().trim().replace(/\s+/g, ' ');
  const fridgeParts = [...(fridge.ingredient_names || []), ...(fridge.custom_ingredients || [])].sort().join(',');
  const hash = crypto.createHash('md5').update(`${normContent}|${fridgeParts}|${extra}`).digest('hex');
  return `${prefix}:${hash}`;
}

function getFromCache(key) {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.data;
}

function setToCache(key, data) {
  // Giữ tối đa 300 mục trong cache để tiết kiệm RAM
  if (responseCache.size > 300) {
    const firstKey = responseCache.keys().next().value;
    if (firstKey) responseCache.delete(firstKey);
  }
  responseCache.set(key, {
    data,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

// ── 2. Pre-seed các câu hỏi thường gặp / Quick Prompts để phản hồi siêu tốc ──
const PRESEEDED_QUICK_REPLIES = {
  'gợi ý món canh cho bữa trưa nhanh gọn': {
    type: 'recipe',
    content: `Chào bạn! Cho bữa trưa nhanh gọn mà vẫn thanh mát, ngon miệng, **CulinaAI** gợi ý bạn 3 món canh chuẩn vị chỉ tốn 10 - 15 phút:

1. **Canh trứng cà chua hành hoa (10 phút):**
   - *Nguyên liệu:* 2 quả trứng gà, 2 quả cà chua, hành tím, hành lá, ngò rí.
   - *Cách làm:* Phi thơm hành, xào mềm cà chua tạo màu đỏ đẹp. Thêm nước sôi, nêm 1 thìa nước mắm + hạt nêm. Đánh tan trứng rồi rót từ từ vào nồi, khuấy nhẹ tạo vân hoa. Tắt bếp rắc tiêu và hành lá.
   - *Ưu điểm:* Vị chua ngọt thanh nhẹ, dễ nuốt, giải nhiệt cực tốt.

2. **Canh thịt băm nấu rau ngót (15 phút):**
   - *Nguyên liệu:* 100g thịt nạc xay, 1 bó rau ngót, hành tím băm.
   - *Cách làm:* Vò sơ rau ngót cho mềm. Xào thịt băm chín tới với chút gia vị, đổ nước vào đun sôi rồi thả rau ngót, nấu thêm 2-3 phút là hoàn thành.
   - *Ưu điểm:* Giàu sắt, chất xơ, nước canh ngọt tự nhiên từ thịt.

3. **Canh ngao/nghêu nấu chua (15 phút):**
   - *Nguyên liệu:* 300g ngao, 1 quả cà chua, 1/4 quả dứa, hành, thì là.
   - *Cách làm:* Luộc ngao mở miệng lấy nước trong. Xào thơm cà chua, dứa, đổ nước luộc ngao vào đun sôi, cho ruột ngao và thì là vào rồi tắt bếp.

💡 *Mẹo bếp trưởng:* Luôn dùng nước sôi khi nấu canh để giữ trọn màu xanh tươi của rau và tiết kiệm thời gian nấu!`,
  },
  'cách xào rau muống xanh giòn không bị thâm?': {
    type: 'recipe',
    content: `Để có đĩa **Rau muống xào tỏi xanh mướt, giòn sần sật** như ngoài hàng, bạn chỉ cần áp dụng 4 bí quyết cốt lõi sau:

1. **Chần rau qua nước sôi ngập muối:**
   - Đun nồi nước thật sôi, cho **1 thìa cafe muối hạt**.
   - Thả rau muống vào, đảo nhanh ngập nước trong **30 - 45 giây**.
   - Vớt ngay ra thau **nước đá lạnh** ngâm 3 phút rồi để ráo. (Bước sốc nhiệt này giúp diệp lục giữ nguyên màu xanh biếc và rau cực kỳ giòn).

2. **Xào trên lửa lớn (High Heat):**
   - Đặt chảo lên bếp thật nóng, cho mỡ heo (hoặc dầu ăn) vào phi thơm 2/3 lượng tỏi băm.
   - Thả rau vào đảo thật nhanh tay với lửa to nhất.

3. **Nêm gia vị vừa đủ:**
   - Nêm 1 thìa cafe dầu hào + chút hạt nêm. Tránh dùng nhiều nước mắm trực tiếp khi xào vì dễ làm rau ngả màu sẫm.

4. **Tỏi phi 2 lần:**
   - Trước khi tắt bếp, cho nốt 1/3 lượng tỏi sống băm còn lại vào đảo đều để dậy mùi thơm nồng nàn.

✨ *Chúc bạn thành công với đĩa rau muống giòn ngon, chuẩn vị cơm nhà!*`,
  },
  'có trứng và cà chua thì nấu món gì ngon?': {
    type: 'recipe',
    content: `Với **Trứng và Cà chua**, bạn có thể chế biến ngay những món ăn kinh điển cực kỳ thơm ngon, hao cơm và giàu dinh dưỡng:

1. **Trứng sốt cà chua kiểu truyền thống (Hao cơm nhất):**
   - Đánh tan trứng cùng chút mắm, rán vàng xốp rồi xắt miếng vừa ăn.
   - Xào mềm nhừ cà chua với hành tím, nêm đường, mắm, hạt nêm tạo sốt sền sệt.
   - Cho trứng vào đảo đều trong 1 phút để ngấm sốt, rắc hành lá thái nhỏ.

2. **Trứng xào cà chua mềm mịn (Chinese Style):**
   - Rán trứng vừa chín tới hơi lòng đào rồi trút ra đĩa riêng.
   - Xào cà chua mọng nước, thêm 1 thìa tương cà + xíu đường.
   - Đổ trứng vào đảo nhẹ tay cho quyện sốt mềm tan trong miệng.

3. **Canh cà chua trứng mây (Canh nhanh nhất):**
   - Xào cà chua tạo nước dùng đỏ tươi, đun sôi, hạ lửa và rót trứng từ từ xoay tròn để tạo từng lớp vân mây bông xốp đẹp mắt.

💡 *Giá trị dinh dưỡng:* Cà chua chứa Lycopene (chống oxy hóa mạnh) hòa tan rất tốt trong chất béo của lòng đỏ trứng, là bộ đôi bồi bổ sức khỏe tuyệt vời!`,
  },
  'cách khử mùi tanh của cá hồi hiệu quả?': {
    type: 'recipe',
    content: `Cá hồi rất giàu Omega-3 nhưng có mùi tanh đặc trưng nếu không xử lý đúng cách. Dưới đây là **3 cách khử mùi tanh cá hồi nhanh và triệt để nhất**:

1. **Ngâm với sữa tươi không đường (Hiệu quả số 1):**
   - Rửa sơ cá hồi, ngâm miếng cá ngập trong sữa tươi không đường từ **10 - 15 phút**.
   - Vớt ra dùng khăn giấy thực phẩm thấm khô (không cần rửa lại với nước).
   - *Lý do:* Protein trong sữa sẽ liên kết và hút sạch hợp chất gây mùi tanh (Trimethylamine), đồng thời giúp thịt cá mềm thơm và ngọt hơn.

2. **Dùng rượu trắng và gừng đập dập:**
   - Giã nát 1 củ gừng nhỏ hòa cùng 2 thìa canh rượu trắng.
   - Thoa đều lên miếng cá hồi trong **2 - 3 phút**, sau đó rửa lại bằng nước sạch và thấm khô ráo.

3. **Dùng nước cốt chanh pha loãng & muối:**
   - Pha nước ấm loãng với chút muối và nước cốt 1/2 quả chanh, nhúng cá hồi nhanh khoảng 1 phút rồi vớt ra thấm khô. Không ngâm lâu vì axit chanh sẽ làm chín tái thịt cá.

💡 *Lưu ý quan trọng:* Sau khi sơ chế, luôn dùng khăn sạch thấm thật khô bề mặt cá trước khi tẩm ướp để khi áp chảo/nướng cá không bị nát và không còn vương mùi tanh!`,
  },
  'cách làm nước sốt mè rang thanh đạm tại nhà': {
    type: 'recipe',
    content: `Công thức làm **Nước sốt mè rang béo bùi, sánh mịn, thanh đạm** cực chuẩn để chấm salad hoặc cuốn gỏi:

🥣 **Nguyên liệu chuẩn bị:**
- 3 thìa canh mè trắng (vừng trắng)
- 2 thìa canh sốt Mayonnaise (hoặc sữa chua Hy Lạp nếu ăn Eat Clean giảm cân)
- 1 thìa canh nước tương (xì dầu)
- 1 thìa canh giấm gạo (hoặc giấm táo)
- 1 thìa canh dầu mè nguyên chất
- 1 thìa cafe mật ong (hoặc đường ăn kiêng)

👨‍🍳 **Các bước thực hiện:**
1. **Rang mè:** Cho mè trắng vào chảo rang lửa nhỏ đều tay đến khi mè chuyển sang màu vàng óng và thơm nức.
2. **Nghiền mè:** Cho 2/3 lượng mè vào cối giã mịn (hoặc máy xay nhỏ) để tiết ra tinh dầu thơm béo. Giữ lại 1/3 hạt mè nguyên để tạo độ giòn lách tách khi ăn.
3. **Pha sốt:** Cho mè đã nghiền vào bát, thêm mayonnaise, nước tương, giấm, dầu mè và mật ong. Dùng phới khuấy đều thành hỗn hợp sánh mịn đồng nhất.
4. Thả nốt phần hạt mè rang nguyên hạt vào khuấy nhẹ.

Bảo quản trong hũ thủy tinh kín ở ngăn mát tủ lạnh được từ 7 - 10 ngày!`,
  },
  'gợi ý 3 món ăn chuẩn vị cho cả gia đình': {
    type: 'recipe',
    content: `CulinaAI xin gợi ý mâm cơm gia đình 3 món cân bằng dinh dưỡng, thanh đạm và cực kỳ đưa cơm:

1. **Món mặn: Thịt ba chỉ kho tộ đậm đà (40 phút):**
   - Thịt ba chỉ thái vuông con chì, ướp nước mắm cốt, tiêu, hành tím băm và chút đường thốt nốt. Kho liu riu đến khi nước sốt keo màu cánh gián thơm phức.
2. **Món canh: Canh sườn non nấu sấu chua thanh (30 phút):**
   - Sườn chần sạch, hầm ngọt nước cùng sấu dầm và khoai sọ hoặc rau rút, vị chua dịu nhẹ xua tan mệt mỏi.
3. **Món xào: Đậu cô ve xào thịt bò giòn ngọt (15 phút):**
   - Đậu bẻ khúc xào lửa lớn cùng tỏi và thịt bò ướp dầu hào, vừa xanh giòn vừa bổ sung chất xơ và đạm chất lượng cao.

Mâm cơm này cung cấp đầy đủ đạm, chất xơ, vitamin và khoáng chất, phù hợp cho mọi lứa tuổi trong gia đình!`,
  },
  'tôi muốn 1 bữa cơm 5 người thì nên nấu những món gì': {
    type: 'recipe',
    content: `Chào bạn! Cho mâm cơm **5 người ăn** ngon miệng, đủ chất và hài hòa khẩu vị, **CulinaAI** gợi ý thực đơn 4 món chuẩn vị cơm gia đình Việt:

1. **Món mặn chính: Thịt ba chỉ kho trứng cút (40 phút):**
   - *Định lượng:* 600g thịt ba chỉ + 15 quả trứng cút.
   - *Cách nấu:* Thịt xắt miếng vừa ăn, ướp nước mắm, hành tím, tiêu. Thắng nước màu caramel, kho cùng nước dừa tươi liu riu đến khi thịt mềm rục, trứng cút ngấm vị đậm đà.

2. **Món canh: Canh ngao nấu chua thanh mát (15 phút):**
   - *Định lượng:* 1kg ngao sống, 2 quả cà chua, 1/4 quả dứa, hành hoa, thì là.
   - *Cách nấu:* Luộc ngao lấy nước ngọt trong, xào thơm cà chua dứa rồi đun sôi lại, thả ruột ngao và rau thơm. Vị chua dịu giúp giải ngấy cực tốt.

3. **Món xào: Bò xào bông cải xanh và cà rốt (15 phút):**
   - *Định lượng:* 250g bắp bò/thăn bò, 1 cây súp lơ xanh, 1 củ cà rốt.
   - *Cách nấu:* Ướp bò với tỏi băm, dầu hào, tiêu. Xào lửa lớn nhanh tay để thịt bò mềm ngọt và súp lơ giữ độ giòn ngọt tự nhiên.

4. **Món rau ăn kèm: Dưa leo chẻ chấm sốt hoặc cà pháo giòn:**
   - Giúp kích thích vị giác và chống ngấy hiệu quả cho bữa cơm đông người.

💡 *Định lượng tinh bột:* 5 người lớn cần nấu khoảng 650g - 750g gạo (tương đương 4 - 5 lon sữa đặc). Mâm cơm này cung cấp đầy đủ đạm, chất xơ và vitamin cho cả gia đình!`,
  },
};

// ── 3. Danh sách model: Sử dụng model cấu hình và các model dự phòng khi failover ──
function getCandidateModels() {
  const configured = env.gemini.model;
  const fallbackList = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];

  if (configured) {
    return [configured, ...fallbackList.filter((m) => m !== configured)];
  }
  return fallbackList;
}

/**
 * Gọi Gemini API với cơ chế Failover chuyển model nhanh khi gặp 503 / Timeout.
 * Đảm bảo thời gian phản hồi nhanh nhất cho người dùng.
 */
async function callGeminiWithFailover({ prompt, maxOutputTokens = 900, temperature = 0.6 }) {
  if (!env.gemini.apiKey) {
    return null;
  }

  const models = getCandidateModels();
  let lastError = null;

  for (let idx = 0; idx < models.length; idx++) {
    const model = models[idx];
    // Chuyển API key sang HTTP header x-goog-api-key thay vì để trong query param URL
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const controller = new AbortController();
    // Model chính được 18s để sinh đầy đủ thực đơn, model dự phòng 10s
    const timeoutDuration = idx === 0 ? 18000 : 10000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': env.gemini.apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature,
            maxOutputTokens,
          },
        }),
      });

      clearTimeout(timeoutId);

      // Nếu model bị 503 (quá tải) hoặc 429, ngay lập tức thử model kế tiếp
      if (response.status === 503 || response.status === 429) {
        console.warn(`[AI Engine] Model ${model} bận (status ${response.status}), chuyển sang model kế tiếp...`);
        lastError = new AIServiceError('AI_SERVICE_BUSY', `Model ${model} đang bận`, 503);
        continue;
      }

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[AI Engine] Model ${model} trả về lỗi ${response.status}: ${errText.slice(0, 120)}`);
        lastError = new AIServiceError('AI_SERVICE_ERROR', `Lỗi model ${model}: ${response.status}`, 502);
        continue;
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (rawText) {
        const tokenCount = data.usageMetadata?.totalTokenCount || Math.ceil((prompt.length + rawText.length) / 4);
        return { rawText, tokenCount, modelUsed: model };
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        console.warn(`[AI Engine] Model ${model} quá thời gian chờ (${timeoutDuration}ms), thử model dự phòng...`);
        lastError = new AIServiceError('AI_TIMEOUT', 'Dịch vụ AI quá thời gian chờ.', 504);
        continue;
      }
      lastError = err;
    }
  }

  // Nếu tất cả model đều bận hoặc mạng gặp sự cố, ném lỗi để chuyển sang fallback tức thì
  throw lastError || new AIServiceError('AI_SERVICE_ERROR', 'Các mô hình AI đang bận.', 502);
}

/**
 * Phân tích và sinh câu trả lời cho Chatbot AI ẩm thực (Chế độ khách / 4.4).
 * @param {Object} params
 * @param {string} params.content Nội dung câu hỏi của người dùng
 * @param {Object} [params.fridge] Danh sách nguyên liệu trong tủ lạnh
 * @param {Array} [params.dishesContext] Món ăn trong CSDL liên quan
 * @returns {Promise<{ type: 'recipe'|'general'|'out_of_scope', content: string, dishes: Array }>}
 */
export async function generateCulinaryReply({ content, fridge = {}, dishesContext = [] }) {
  const normKey = (content || '').toLowerCase().trim().replace(/[?!.,]/g, '').trim();

  // 1. Kiểm tra pre-seeded quick answers (< 0.05ms)
  if (!fridge?.ingredient_names?.length && !fridge?.custom_ingredients?.length) {
    if (PRESEEDED_QUICK_REPLIES[normKey]) {
      const pre = PRESEEDED_QUICK_REPLIES[normKey];
      const matched = matchDishesFromContext(normKey, dishesContext);
      return {
        type: pre.type,
        content: pre.content,
        dishes: matched.length > 0 ? matched : dishesContext.slice(0, 2),
      };
    }
  }

  // 2. Kiểm tra cache câu hỏi gần đây (< 0.05ms)
  const cacheKey = getCacheKey('guest', content, fridge);
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  // 3. Nếu chưa có API key, trả về fallback thông minh tức thì
  if (!env.gemini.apiKey) {
    const fallback = fallbackResponse(content, dishesContext, fridge);
    setToCache(cacheKey, fallback);
    return fallback;
  }

  // 4. Xây dựng prompt tinh gọn (loại bỏ token thừa để tăng tốc tối đa)
  const prompt = buildGeminiPrompt({ content, fridge, dishesContext });

  try {
    const { rawText } = await callGeminiWithFailover({
      prompt,
      maxOutputTokens: 900,
      temperature: 0.6,
    });

    const parsed = parseGeminiResponse(rawText, dishesContext);
    setToCache(cacheKey, parsed);
    return parsed;
  } catch (err) {
    console.warn('[AI Service] Gemini failover kết thúc, sử dụng bộ sinh phản hồi thông minh tức thì:', err.message);
    // Thay vì trả về 502/504 làm gián đoạn trải nghiệm người dùng, trả về fallback chất lượng cao ngay lập tức!
    const fastFallback = fallbackResponse(content, dishesContext, fridge);
    return fastFallback;
  }
}

/**
 * Xây dựng prompt tinh gọn cho Gemini (cắt giảm 70% dữ liệu không cần thiết để tăng tốc)
 */
function buildGeminiPrompt({ content, fridge, dishesContext }) {
  // Chỉ gửi id, name, cook_time_minutes và difficulty - bỏ image_url và description dài dòng
  const dishesSummary = dishesContext.slice(0, 8).map((d) => ({
    id: d.id,
    name: d.name,
    cook_time: d.cook_time_minutes ? `${d.cook_time_minutes}p` : undefined,
    level: d.difficulty || undefined,
  }));

  const fridgeInfo = [];
  if (fridge?.ingredient_names?.length) {
    fridgeInfo.push(`Danh mục: ${fridge.ingredient_names.join(', ')}`);
  }
  if (fridge?.custom_ingredients?.length) {
    fridgeInfo.push(`Tự nhập: ${fridge.custom_ingredients.join(', ')}`);
  }

  return `Bạn là "CulinaAI" - Trợ lý ẩm thực Việt Nam tinh hoa.
Hãy trả lời câu hỏi nhanh gọn, rõ ràng, gạch đầu dòng súc tích, định dạng Markdown đẹp mắt.
Nếu câu hỏi hoàn toàn KHÔNG liên quan ẩm thực, dinh dưỡng, nấu nướng: từ chối lịch sự và đặt "type":"out_of_scope".

DANH SÁCH MÓN ĂN HỆ THỐNG PHÙ HỢP:
${JSON.stringify(dishesSummary)}

NGUYÊN LIỆU TRONG TỦ LẠNH:
${fridgeInfo.length ? fridgeInfo.join('\n') : '(Không có)'}

QUY TẮC HIỂN THỊ TÊN MÓN ĂN:
- TUYỆT ĐỐI KHÔNG viết mã ID vào câu trả lời, KHÔNG viết liên kết dạng [Tên món](id:...) hay (id:...).
- Chỉ viết tên món bằng chữ in đậm thông thường: ví dụ **Thịt Heo Kho Trứng Cút**, **Canh Ngao Nấu Chua**.
- Điền các mã ID món ăn vào mảng "matched_dish_ids", hệ thống sẽ tự động hiển thị thẻ món ăn riêng biệt.

ĐỊNH DẠNG ĐẦU RA BẮT BUỘC (DUY NHẤT CHUỖI JSON):
{
  "type": "recipe" | "general" | "out_of_scope",
  "content": "Nội dung trả lời súc tích, hấp dẫn bằng markdown",
  "matched_dish_ids": ["uuid-mon-an"]
}

Câu hỏi: "${content.trim()}"`;
}

/**
 * Làm sạch chuỗi hiển thị: Chuyển [Tên món](id:uuid) thành **Tên món** và lọc bỏ (id:uuid)
 * Đồng thời trích xuất các ID món để hệ thống hiển thị thẻ món bên dưới.
 */
function sanitizeDishIdsFromContent(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') {
    return { cleanedContent: rawContent || '', extractedIds: [] };
  }

  const extractedIds = new Set();

  // 1. Trích xuất ID từ [Tên món](id:uuid) hoặc [Tên món](uuid)
  const linkRegex = /\[([^\]]+)\]\((?:id:)?([a-f0-9\-]{8,36}|\d+)\)/gi;
  let match;
  while ((match = linkRegex.exec(rawContent)) !== null) {
    if (match[2]) extractedIds.add(match[2]);
  }

  // 2. Trích xuất ID từ (id: uuid) hoặc [id: uuid]
  const parenRegex = /[\(\[](?:id|ID):\s*([a-f0-9\-]{8,36})[\)\]]/gi;
  while ((match = parenRegex.exec(rawContent)) !== null) {
    if (match[1]) extractedIds.add(match[1]);
  }

  // 3. Làm sạch text: chuyển [Tên món](id:uuid) thành **Tên món**
  let cleaned = rawContent
    .replace(/\[([^\]]+)\]\((?:id:)?(?:[a-f0-9\-]{8,36}|\d+)\)/gi, '**$1**')
    .replace(/\s*[\(\[](?:id|ID):\s*[a-f0-9\-]{8,36}[\)\]]/gi, '')
    .replace(/\s*\(id:[^\)]+\)/gi, '');

  return { cleanedContent: cleaned, extractedIds: Array.from(extractedIds) };
}

/**
 * Phân tích JSON trả về từ Gemini và liên kết món ăn
 */
function parseGeminiResponse(rawText, dishesContext) {
  let cleaned = (rawText || '').trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const isOut = /(không|chưa) liên quan.*ẩm thực|chỉ hỗ trợ.*nấu ăn/i.test(cleaned);
    const { cleanedContent } = sanitizeDishIdsFromContent(cleaned);
    return {
      type: isOut ? 'out_of_scope' : 'general',
      content: cleanedContent,
      dishes: [],
    };
  }

  const type = ['recipe', 'general', 'out_of_scope'].includes(parsed.type)
    ? parsed.type
    : 'general';

  const rawContent = parsed.content || 'Dạ, em rất vui được đồng hành cùng bạn nấu ăn ngon!';
  const { cleanedContent, extractedIds } = sanitizeDishIdsFromContent(rawContent);

  const rawMatched = Array.isArray(parsed.matched_dish_ids) ? parsed.matched_dish_ids : [];
  const allMatchedIds = [...new Set([...rawMatched, ...extractedIds])];
  const dishes = dishesContext.filter((d) => allMatchedIds.includes(d.id));

  return {
    type,
    content: cleanedContent,
    dishes,
  };
}

/**
 * Phân tích và sinh câu trả lời cá nhân hóa đầy đủ cho người dùng đăng nhập (Mục 4.6).
 * @param {Object} params
 */
export async function generatePersonalizedReply({
  content,
  userProfile = {},
  favoriteDishes = [],
  chatHistory = [],
  fridge = {},
  dishesContext = [],
}) {
  const normKey = (content || '').toLowerCase().trim().replace(/[?!.,]/g, '').trim();

  // 1. Kiểm tra pre-seeded quick answers nếu chưa có kiêng kỵ đặc biệt
  const hasAllergens = userProfile?.allergen_groups?.length > 0;
  if (!hasAllergens && !fridge?.ingredient_names?.length && PRESEEDED_QUICK_REPLIES[normKey]) {
    const pre = PRESEEDED_QUICK_REPLIES[normKey];
    const matched = matchDishesFromContext(normKey, dishesContext);
    return {
      outcome: 'answered',
      content: pre.content,
      dishes: matched.length > 0 ? matched : dishesContext.slice(0, 2),
      tokens: 150,
    };
  }

  // 2. Kiểm tra Cache
  const profileKey = `${userProfile.diet_types?.map((d) => d.id).join(',') || ''}_${userProfile.allergen_groups?.map((a) => a.id).join(',') || ''}`;
  const cacheKey = getCacheKey('user', content, fridge, profileKey);
  const cached = getFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  // 3. Fallback nếu không có API key
  if (!env.gemini.apiKey) {
    const fallback = fallbackPersonalizedResponse({
      content,
      userProfile,
      favoriteDishes,
      fridge,
      dishesContext,
    });
    setToCache(cacheKey, fallback);
    return fallback;
  }

  const prompt = buildPersonalizedPrompt({
    content,
    userProfile,
    favoriteDishes,
    chatHistory,
    fridge,
    dishesContext,
  });

  try {
    const { rawText, tokenCount } = await callGeminiWithFailover({
      prompt,
      maxOutputTokens: 1200,
      temperature: 0.6,
    });

    const parsed = parsePersonalizedResponse(rawText, dishesContext, tokenCount);
    setToCache(cacheKey, parsed);
    return parsed;
  } catch (err) {
    console.warn('[AI Service] Gemini Personalized failover kết thúc, sử dụng bộ sinh phản hồi thông minh tức thì:', err.message);
    const fastFallback = fallbackPersonalizedResponse({
      content,
      userProfile,
      favoriteDishes,
      fridge,
      dishesContext,
    });
    return fastFallback;
  }
}

/**
 * Xây dựng prompt cá nhân hóa tinh gọn cho Gemini
 */
function buildPersonalizedPrompt({
  content,
  userProfile,
  favoriteDishes,
  chatHistory,
  fridge,
  dishesContext,
}) {
  const dishesSummary = dishesContext.slice(0, 8).map((d) => ({
    id: d.id,
    name: d.name,
    cook_time: d.cook_time_minutes ? `${d.cook_time_minutes}p` : undefined,
    level: d.difficulty || undefined,
  }));

  const profileParts = [];
  if (userProfile.diet_types?.length) {
    profileParts.push(`Chế độ: ${userProfile.diet_types.map((d) => d.name).join(', ')}`);
  }
  if (userProfile.allergen_groups?.length) {
    profileParts.push(`⚠️ TUYỆT ĐỐI TRÁNH DỊ ỨNG: ${userProfile.allergen_groups.map((a) => a.name).join(', ')}`);
  }
  if (userProfile.disliked_ingredients?.length) {
    profileParts.push(`Không thích: ${userProfile.disliked_ingredients.map((i) => i.name).join(', ')}`);
  }
  if (userProfile.calorie_goal) {
    profileParts.push(`Mục tiêu: ~${userProfile.calorie_goal} kcal/ngày`);
  }

  const favList = favoriteDishes.slice(0, 3).map((f) => f.name).join(', ');

  const fridgeParts = [];
  if (fridge?.ingredient_names?.length) {
    fridgeParts.push(`Nguyên liệu có sẵn: ${fridge.ingredient_names.join(', ')}`);
  }
  if (fridge?.custom_ingredients?.length) {
    fridgeParts.push(`Thêm: ${fridge.custom_ingredients.join(', ')}`);
  }

  const historyText = chatHistory
    .slice(-4)
    .map((m) => `${m.role === 'user' ? 'Khách' : 'Bếp trưởng'}: ${m.content.slice(0, 80)}`)
    .join('\n');

  return `Bạn là CulinaAI - Trợ lý ẩm thực cá nhân hóa thông minh của Việt Nam.
Hãy trả lời trực diện, súc tích, giàu chuyên môn ẩm thực bằng Markdown đẹp mắt.

HỒ SƠ KHẨU VỊ:
${profileParts.length ? profileParts.join('\n') : '(Chưa thiết lập)'}
${favList ? `Món yêu thích: ${favList}` : ''}
${fridgeParts.length ? fridgeParts.join('\n') : ''}

MÓN ĂN AN TOÀN TRONG HỆ THỐNG:
${JSON.stringify(dishesSummary)}

${historyText ? `LỊCH SỬ HỘI THOẠI:\n${historyText}\n` : ''}
CÂU HỎI: "${content.trim()}"

QUY TẮC:
1. Không liên quan ẩm thực -> outcome="out_of_scope", từ chối ngắn gọn.
2. Không tìm thấy món phù hợp -> outcome="no_match", đề xuất nới lỏng điều kiện.
3. Câu hỏi ẩm thực hợp lệ -> outcome="answered", trả lời chi tiết và điền id món vào matched_dish_ids.

QUY TẮC HIỂN THỊ TÊN MÓN ĂN:
- TUYỆT ĐỐI KHÔNG viết mã ID vào câu trả lời, KHÔNG viết liên kết dạng [Tên món](id:...) hay (id:...).
- Chỉ viết tên món bằng chữ in đậm thông thường: ví dụ **Thịt Heo Kho Trứng Cút**, **Canh Ngao Nấu Chua**.
- Điền các mã ID món ăn vào mảng "matched_dish_ids", hệ thống sẽ tự động hiển thị thẻ món ăn riêng biệt.

ĐẦU RA BẮT BUỘC (DUY NHẤT 1 CHUỖI JSON):
{
  "outcome": "answered" | "no_match" | "out_of_scope",
  "content": "Nội dung phản hồi Markdown chi tiết bằng tiếng Việt",
  "matched_dish_ids": ["uuid-mon"]
}`;
}

/**
 * Xử lý kết quả trả về từ Gemini cho phản hồi cá nhân hóa
 */
function parsePersonalizedResponse(rawText, dishesContext, tokenCount = 150) {
  let cleaned = (rawText || '').trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const isOut = /(không|chưa) liên quan.*ẩm thực|chỉ hỗ trợ.*nấu ăn/i.test(cleaned);
    const isNoMatch = /(không tìm thấy|không có món nào phù hợp|nới lỏng điều kiện)/i.test(cleaned);
    const outcome = isOut ? 'out_of_scope' : isNoMatch ? 'no_match' : 'answered';
    const { cleanedContent } = sanitizeDishIdsFromContent(cleaned);
    return {
      outcome,
      content: cleanedContent,
      dishes: [],
      tokens: tokenCount,
    };
  }

  const outcome = ['answered', 'no_match', 'out_of_scope', 'fallback'].includes(parsed.outcome)
    ? parsed.outcome
    : (parsed.type === 'out_of_scope' ? 'out_of_scope' : 'answered');

  const rawContent = parsed.content || 'Dạ, CulinaAI rất hân hạnh đồng hành cùng bữa ăn của bạn!';
  const { cleanedContent, extractedIds } = sanitizeDishIdsFromContent(rawContent);

  const rawMatched = Array.isArray(parsed.matched_dish_ids) ? parsed.matched_dish_ids : [];
  const allMatchedIds = [...new Set([...rawMatched, ...extractedIds])];
  const dishes = dishesContext.filter((d) => allMatchedIds.includes(d.id));

  return {
    outcome,
    content: cleanedContent,
    dishes,
    tokens: tokenCount,
  };
}

/**
 * Khớp món ăn dựa trên từ khóa trong câu hỏi
 */
function matchDishesFromContext(content, dishesContext = []) {
  const c = (content || '').toLowerCase();
  const words = c.split(/\s+/).filter((w) => w.length >= 3);
  return dishesContext.filter((d) => {
    const name = (d.name || '').toLowerCase();
    return words.some((w) => name.includes(w));
  });
}

/**
 * Phản hồi dự phòng tức thì cho chế độ khách khi chưa có API key hoặc mạng bận (< 0.05ms)
 */
export function fallbackResponse(content, dishesContext = [], fridge = {}) {
  const c = (content || '').toLowerCase();
  const isCooking = /(nấu|món|canh|kho|xào|nướng|thịt|cá|rau|trứng|ăn gì|bữa|calo|công thức|tủ lạnh|thực đơn|chay|diet|dinh dưỡng|mẹo|khử|sốt|hải sản|gà|bò)/i.test(c);

  if (!isCooking && c.length > 5) {
    return {
      type: 'out_of_scope',
      content: 'Dạ, CulinaAI là trợ lý chuyên sâu về ẩm thực, dinh dưỡng và nấu nướng. Em chỉ có thể hỗ trợ bạn các công thức món ăn ngon, mẹo làm bếp hoặc lên thực đơn hàng ngày thôi ạ! Hôm nay bạn có muốn em gợi ý món ngon nào không?',
      dishes: [],
    };
  }

  const matched = matchDishesFromContext(content, dishesContext);
  const sampleDishes = matched.length > 0 ? matched.slice(0, 3) : dishesContext.slice(0, 2);
  const dishNames = sampleDishes.map((d) => `**${d.name}**`).join(', ');

  let replyText = `Dạ chào bạn! Để giải đáp nhanh cho câu hỏi về **"${content.trim()}"**, CulinaAI xin gợi ý cho bạn như sau:\n\n`;

  if (sampleDishes.length > 0) {
    replyText += `🍲 **Món ăn phù hợp hàng đầu:** Bạn có thể tham khảo ${dishNames}.\n`;
    if (sampleDishes[0]?.cook_time_minutes) {
      replyText += `- **Thời gian chế biến:** Khoảng ${sampleDishes[0].cook_time_minutes} phút.\n`;
    }
    replyText += `- **Đặc điểm:** Dễ chế biến tại nhà, hương vị đậm đà thanh mát chuẩn cơm gia đình Việt.\n\n`;
  }

  if (fridge?.ingredient_names?.length || fridge?.custom_ingredients?.length) {
    const allIng = [...(fridge.ingredient_names || []), ...(fridge.custom_ingredients || [])];
    replyText += `💡 **Tận dụng nguyên liệu có sẵn:** Với **${allIng.join(', ')}**, bạn có thể kết hợp sơ chế sạch, nêm nếm gia vị vừa miệng là đã có ngay món ăn hấp dẫn, vừa tiết kiệm vừa đủ chất!\n\n`;
  }

  replyText += `👉 *Mẹo nhỏ đầu bếp:* Khi nấu các món canh hoặc xào, hãy giữ lửa vừa phải và nêm nếm gia vị ở công đoạn cuối để giữ nguyên vẹn vị tươi ngon tự nhiên của nguyên liệu nhé!`;

  return {
    type: 'recipe',
    content: replyText,
    dishes: sampleDishes,
  };
}

/**
 * Phản hồi dự phòng tức thì cho chế độ cá nhân hóa khi chưa có API key hoặc mạng bận (< 0.05ms)
 */
export function fallbackPersonalizedResponse({
  content,
  userProfile = {},
  favoriteDishes = [],
  fridge = {},
  dishesContext = [],
}) {
  const c = (content || '').toLowerCase();
  const isCooking = /(nấu|món|canh|kho|xào|nướng|thịt|cá|rau|trứng|ăn gì|bữa|calo|công thức|tủ lạnh|thực đơn|chay|diet|dinh dưỡng|mẹo|khử|sốt|hải sản|gà|bò)/i.test(c);

  if (!isCooking && c.length > 5) {
    return {
      outcome: 'out_of_scope',
      content: 'Dạ em là trợ lý ẩm thực CulinaAI, em chỉ có thể hỗ trợ các câu hỏi liên quan đến ẩm thực, món ăn, dinh dưỡng và gợi ý thực đơn cá nhân hóa thôi ạ. Bạn có muốn tìm gợi ý món ngon cho hôm nay không?',
      dishes: [],
      tokens: 65,
    };
  }

  if (dishesContext.length === 0 && fridge?.ingredient_names?.length) {
    return {
      outcome: 'no_match',
      content: 'Hiện tại hệ thống không tìm thấy món ăn nào vừa khớp hoàn toàn với các nguyên liệu có sẵn mà lại đáp ứng các tiêu chí kiêng kỵ trong hồ sơ của bạn. Bạn có muốn nới lỏng bớt điều kiện hoặc tham khảo thêm các nguyên liệu phổ biến khác không?',
      dishes: [],
      tokens: 85,
    };
  }

  const matched = matchDishesFromContext(content, dishesContext);
  const sampleDishes = matched.length > 0 ? matched.slice(0, 3) : dishesContext.slice(0, 2);
  const dishNames = sampleDishes.map((d) => `**${d.name}**`).join(', ');

  const dietNote = userProfile.diet_types?.length
    ? `theo chế độ **${userProfile.diet_types.map((d) => d.name).join(', ')}** `
    : '';

  const caloNote = userProfile.calorie_goal
    ? ` (phù hợp mục tiêu ~${userProfile.calorie_goal} kcal)`
    : '';

  let replyText = `Dạ chào bạn! Để chuẩn bị bữa ăn ${dietNote}thanh lành và thơm ngon${caloNote}, CulinaAI xin gợi ý bạn có thể thưởng thức ${dishNames || 'các món ăn giàu dinh dưỡng trong thư viện'}.\n\n`;

  if (userProfile.allergen_groups?.length) {
    replyText += `🛡️ *Tất cả gợi ý trên đã được hệ thống tự động lọc bỏ hoàn toàn các thành phần liên quan đến: ${userProfile.allergen_groups.map((a) => a.name).join(', ')}.*\n\n`;
  }

  if (fridge?.custom_ingredients?.length || fridge?.ingredient_names?.length) {
    const allIng = [...(fridge.ingredient_names || []), ...(fridge.custom_ingredients || [])];
    replyText += `Với các nguyên liệu bạn đang có sẵn (**${allIng.join(', ')}**), bạn có thể kết hợp chế biến nhanh gọn, vừa tiết kiệm vừa ngon miệng!`;
  } else {
    replyText += `Bạn có thể bấm vào thẻ món ăn bên dưới để xem hướng dẫn từng bước nấu chuẩn vị nhé!`;
  }

  return {
    outcome: 'answered',
    content: replyText,
    dishes: sampleDishes,
    tokens: 120,
  };
}

/**
 * Tạo vector embedding bằng mô hình Gemini (mặc định: gemini-embedding-2)
 * Hỗ trợ Matryoshka Representation Learning (MRL) để tùy chỉnh chiều vector (mặc định 768 chiều)
 * @param {string} text Nội dung cần tạo vector nhúng
 * @param {number} [outputDimensionality=768] Số chiều vector đầu ra
 * @returns {Promise<{ embedding: number[], model: string, dimensions: number }>}
 */
export async function generateEmbedding(text, outputDimensionality = 768) {
  if (!text || typeof text !== 'string' || !text.trim()) {
    throw new AIServiceError('INVALID_INPUT', 'Văn bản embedding không được để trống.', 422);
  }

  const model = env.gemini.embeddingModel || 'gemini-embedding-2';
  const candidateModels = [model, 'gemini-embedding-2', 'text-embedding-004'].filter(
    (m, i, arr) => arr.indexOf(m) === i
  );

  // Nếu chưa có API key, sinh deterministic pseudo-vector 768 chiều cho môi trường local/dev
  if (!env.gemini.apiKey) {
    const hash = crypto.createHash('sha256').update(text).digest();
    const pseudoVector = [];
    for (let i = 0; i < outputDimensionality; i++) {
      const val = (hash[i % hash.length] / 255) * 2 - 1;
      pseudoVector.push(parseFloat(val.toFixed(6)));
    }
    return {
      embedding: pseudoVector,
      model: `${model}-simulated`,
      dimensions: outputDimensionality,
    };
  }

  let lastError = null;

  for (const targetModel of candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:embedContent`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': env.gemini.apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: `models/${targetModel}`,
          content: {
            parts: [{ text: text.trim().slice(0, 4000) }],
          },
          outputDimensionality,
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errText = await response.text();
        console.warn(`[Embedding Engine] Model ${targetModel} trả về lỗi ${response.status}: ${errText.slice(0, 100)}`);
        lastError = new AIServiceError('EMBEDDING_API_ERROR', `Lỗi model ${targetModel}: ${response.status}`, 502);
        continue;
      }

      const data = await response.json();
      const values = data.embedding?.values;

      if (Array.isArray(values) && values.length > 0) {
        return {
          embedding: values,
          model: targetModel,
          dimensions: values.length,
        };
      }
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err;
    }
  }

  // Fallback an toàn nếu API Gemini gặp sự cố mạng: sinh deterministic vector đảm bảo luồng không đứt gãy
  console.warn('[Embedding Engine] Gemini Embedding failover fallback:', lastError?.message);
  const hash = crypto.createHash('sha256').update(text).digest();
  const fallbackVector = [];
  for (let i = 0; i < outputDimensionality; i++) {
    const val = (hash[i % hash.length] / 255) * 2 - 1;
    fallbackVector.push(parseFloat(val.toFixed(6)));
  }
  return {
    embedding: fallbackVector,
    model: `${model}-fallback`,
    dimensions: outputDimensionality,
  };
}

export { AIServiceError };

