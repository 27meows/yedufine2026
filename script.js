const STORAGE_KEY = "yedufine_openai_api_key";
const MODEL = "gpt-4o-mini";

const apiKeyInput = document.getElementById("apiKey");
const toggleKeyBtn = document.getElementById("toggleKeyBtn");
const originalText = document.getElementById("originalText");
const situation = document.getElementById("situation");
const audience = document.getElementById("audience");
const tone = document.getElementById("tone");
const submitBtn = document.getElementById("submitBtn");
const resultCard = document.getElementById("resultCard");
const diagnosisText = document.getElementById("diagnosisText");
const changesList = document.getElementById("changesList");
const optionsContainer = document.getElementById("optionsContainer");
const loadingCard = document.getElementById("loadingCard");
const emptyState = document.getElementById("emptyState");
const charCount = document.getElementById("charCount");
const sendPanel = document.getElementById("sendPanel");
const lockedPanel = document.getElementById("lockedPanel");
const lockedTitle = document.getElementById("lockedTitle");
const lockedDescription = document.getElementById("lockedDescription");

let errorBanner = null;
let loadingTimer = null;

const tabDescriptions = {
  video: {
    title: "▶️ 보여줘도...?",
    description: "수업 영상을 보여주기 전, 영상 요약과 함께 비속어·욕설·부적절한 표현 여부를 점검하는 기능입니다."
  },
  leave: {
    title: "🏃 조퇴 더 해도...?",
    description: "월과 휴업일을 입력하면 수당 기준에 영향을 주지 않는 조퇴 가능 일수를 계산하는 기능입니다."
  },
  document: {
    title: "📄 공문 이대로...?",
    description: "작성한 공문이나 스크린샷을 업로드하면 문서 표현, 오탈자, 누락 요소를 점검하는 기능입니다."
  }
};

loadApiKey();
updateCharCount();

apiKeyInput.addEventListener("input", () => {
  localStorage.setItem(STORAGE_KEY, apiKeyInput.value.trim());
});

toggleKeyBtn.addEventListener("click", () => {
  const isHidden = apiKeyInput.type === "password";
  apiKeyInput.type = isHidden ? "text" : "password";
  toggleKeyBtn.textContent = isHidden ? "숨기기" : "보기";
});

originalText.addEventListener("input", updateCharCount);

document.querySelectorAll(".sample").forEach((button) => {
  button.addEventListener("click", () => {
    originalText.value = button.dataset.text;
    updateCharCount();
    originalText.focus();
  });
});

document.querySelectorAll(".tab").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((tab) => tab.classList.remove("active"));
    button.classList.add("active");

    const tab = button.dataset.tab;
    if (tab === "send") {
      sendPanel.classList.remove("hidden");
      lockedPanel.classList.add("hidden");
      return;
    }

    const info = tabDescriptions[tab];
    lockedTitle.textContent = info.title;
    lockedDescription.textContent = info.description;
    sendPanel.classList.add("hidden");
    lockedPanel.classList.remove("hidden");
  });
});

submitBtn.addEventListener("click", handleSubmit);

function updateCharCount() {
  charCount.textContent = `${originalText.value.length} / 1000`;
}

function loadApiKey() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) apiKeyInput.value = saved;
}

function showError(message) {
  if (!errorBanner) {
    errorBanner = document.createElement("p");
    errorBanner.className = "error-banner";
    submitBtn.insertAdjacentElement("afterend", errorBanner);
  }
  errorBanner.textContent = message;
}

function clearError() {
  if (errorBanner) {
    errorBanner.remove();
    errorBanner = null;
  }
}

async function handleSubmit() {
  const text = originalText.value.trim();
  const apiKey = apiKeyInput.value.trim();

  clearError();

  if (!apiKey) {
    showError("OpenAI API Key를 입력해 주세요.");
    apiKeyInput.focus();
    return;
  }

  if (!text) {
    showError("다듬을 원문을 입력해 주세요.");
    originalText.focus();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "얘두파인이 고민 중...";
  showLoading();

  try {
    const result = await callOpenAI({
      apiKey,
      text,
      situation: situation.value,
      audience: audience.value,
      tone: tone.value
    });
    renderResult(result);
  } catch (error) {
    hideLoading();
    showError(error.message || "요청 중 오류가 발생했습니다.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "✨ 얘두파인?";
  }
}

function showLoading() {
  emptyState.classList.add("hidden");
  resultCard.classList.add("hidden");
  loadingCard.classList.remove("hidden");

  const steps = [
    document.getElementById("loadStep0"),
    document.getElementById("loadStep1"),
    document.getElementById("loadStep2"),
    document.getElementById("loadStep3")
  ];
  const labels = ["상황 분석 중...", "대상 분석 중...", "학교 말투로 변환 중...", "가장 자연스러운 표현 생성 중..."];

  steps.forEach((step, index) => {
    step.textContent = `⏳ ${labels[index]}`;
  });

  let index = 0;
  clearInterval(loadingTimer);
  loadingTimer = setInterval(() => {
    if (index < steps.length) {
      steps[index].textContent = `✅ ${labels[index].replace("중...", "완료")}`;
      index += 1;
    } else {
      clearInterval(loadingTimer);
    }
  }, 500);
}

function hideLoading() {
  clearInterval(loadingTimer);
  loadingCard.classList.add("hidden");
}

async function callOpenAI({ apiKey, text, situation, audience, tone }) {
  const systemPrompt = `
너는 대한민국 공립 초등학교에서 15년 이상 근무한 베테랑 교사이자 교무부장이다.

목표는 예쁜 문장이 아니라, 실제 교사가 그대로 복사해서 사용할 수 있는 문장을 만드는 것이다.

반드시 지킬 규칙:
1. 번역투를 절대 쓰지 않는다.
2. "당신", "귀하", "귀 기관", "업무 마무리에 어려움을 겪고 있습니다", "귀중한 시간을 내어", "진심으로 감사드립니다", "미리 감사드립니다"는 사용하지 않는다.
3. 같은 의미의 감사 표현이나 부탁 표현을 반복하지 않는다.
4. 불필요하게 길게 쓰지 않는다.
5. 실제 학교 메신저, 카카오톡, 공문에서 쓸 법한 표현을 사용한다.
6. 동료교사에게는 "선생님", "자료 취합", "확인 부탁드립니다", "제출 부탁드립니다", "혹시 가능하시면", "번거로우시겠지만" 같은 자연스러운 표현을 우선 사용한다.
7. 학부모에게는 공손하되 과하게 딱딱하지 않게 쓴다.
8. 학생에게는 쉽고 따뜻하게 쓴다.
9. 관리자에게는 간결하고 예의 있게 보고체로 쓴다.
10. "감사합니다", "고맙습니다"를 한 문장 안에서 반복하지 않는다.
11. 동료교사에게 "당신의 자료" 같은 표현을 절대 사용하지 않는다.
12. 원문의 강한 감정은 줄이되, 필요한 요청 내용과 마감 시간은 명확히 남긴다.

판정 기준:
- 80점 이상: 🟢 얘는 파인!
- 50점 이상 79점 이하: 🟡 조금만 다듬으면 파인!
- 49점 이하: 🔴 얘는 낫파인!

ratings 기준:
- kindness: 친절도, 1~5
- politeness: 공손함, 1~5
- clarity: 명확성, 1~5
- burden: 상대가 느낄 부담감, 1~5. 낮을수록 좋다.

반드시 아래 JSON 형식만 출력한다. 다른 텍스트나 마크다운 코드블록은 포함하지 않는다.

{
  "diagnosis": "원문의 느낌과 잠재적 오해 포인트를 자연스럽게 2~3문장으로 분석",
  "score": 0,
  "verdict": "🟢 얘는 파인! / 🟡 조금만 다듬으면 파인! / 🔴 얘는 낫파인! 중 하나",
  "ratings": {
    "kindness": 0,
    "politeness": 0,
    "clarity": 0,
    "burden": 0
  },
  "options": [
    {
      "title": "추천 1",
      "text": "가장 추천하는 문장"
    },
    {
      "title": "추천 2",
      "text": "조금 더 부드러운 문장"
    },
    {
      "title": "추천 3",
      "text": "조금 더 간결한 문장"
    }
  ],
  "changes": ["수정 이유 1", "수정 이유 2", "수정 이유 3"]
}
`;

  const userPrompt = `원문:
${text}

상황: ${situation}
대상: ${audience}
말투: ${tone}

위 조건에 맞게 실제 한국 초등학교 교사가 사용할 법한 문장으로 다듬어 주세요.
특히 번역투, 과한 감사 표현, "당신" 같은 어색한 호칭은 절대 사용하지 마세요.
추천 문장 3개를 만들어 주세요.`;

  return requestOpenAI({ apiKey, systemPrompt, userPrompt });
}

async function reviseOption({ currentText, request }) {
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) throw new Error("OpenAI API Key를 입력해 주세요.");

  const systemPrompt = `
너는 대한민국 초등학교 교사의 문장을 자연스럽게 수정하는 AI 어시스턴트다.
현재 문장을 사용자의 추가 요청에 맞게 다시 다듬어라.

규칙:
1. 번역투를 쓰지 않는다.
2. "당신", "귀하", "미리 감사드립니다", "진심으로 감사드립니다"는 쓰지 않는다.
3. 실제 학교 현장에서 바로 보낼 수 있는 문장으로 작성한다.
4. 수정된 문장만 JSON으로 반환한다.

{
  "revised": "수정된 문장"
}
`;

  const userPrompt = `현재 문장:
${currentText}

수정 요청:
${request}

위 요청에 맞게 자연스럽게 다시 수정해 주세요.`;

  const result = await requestOpenAI({ apiKey, systemPrompt, userPrompt });
  return result.revised || currentText;
}

async function requestOpenAI({ apiKey, systemPrompt, userPrompt }) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.45,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data?.error?.message || `API 오류 (${response.status})`;
    throw new Error(message);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI 응답을 받지 못했습니다.");

  try {
    return JSON.parse(content);
  } catch {
    throw new Error("AI 응답 형식을 해석하지 못했습니다. 다시 시도해 주세요.");
  }
}

function parseAIResponse(parsed) {
  const diagnosis = String(parsed.diagnosis || "").trim();
  const score = Number(parsed.score || 0);
  const verdict = String(parsed.verdict || "").trim();
  const ratings = parsed.ratings || {};

  const options = Array.isArray(parsed.options)
    ? parsed.options
        .map((item, index) => ({
          title: String(item.title || `추천 ${index + 1}`).trim(),
          text: String(item.text || "").trim()
        }))
        .filter((item) => item.text)
    : [];

  const changes = Array.isArray(parsed.changes)
    ? parsed.changes.map((item) => String(item).trim()).filter(Boolean)
    : [];

  return { diagnosis, score, verdict, ratings, options, changes };
}

function renderResult(rawResult) {
  hideLoading();
  const { diagnosis, score, verdict, ratings, options, changes } = parseAIResponse(rawResult);

  const ratingText = `
얘두 점수: ${score || "-"}점
판정: ${verdict || "-"}

친절도 ${toStars(ratings.kindness)}
공손함 ${toStars(ratings.politeness)}
명확성 ${toStars(ratings.clarity)}
부담감 ${toStars(ratings.burden)}`;

  diagnosisText.textContent = `${diagnosis || "원문 분석 결과가 없습니다."}\n${ratingText}`;
  renderOptions(options);

  changesList.innerHTML = "";
  if (changes.length > 0) {
    changes.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      changesList.appendChild(li);
    });
  } else {
    const li = document.createElement("li");
    li.textContent = "수정 포인트가 제공되지 않았습니다.";
    changesList.appendChild(li);
  }

  resultCard.classList.remove("hidden");
}

function renderOptions(options) {
  optionsContainer.innerHTML = "";

  if (!options.length) {
    optionsContainer.innerHTML = `<p class="empty-message">추천 문장을 생성하지 못했습니다.</p>`;
    return;
  }

  options.forEach((option, index) => {
    const card = document.createElement("div");
    card.className = "option-card";

    const title = document.createElement("div");
    title.className = "option-title";
    title.innerHTML = `<span>${option.title || `추천 ${index + 1}`}</span><span class="option-badge">편집 가능</span>`;

    const textarea = document.createElement("textarea");
    textarea.className = "option-textarea";
    textarea.value = option.text;

    const requestInput = document.createElement("input");
    requestInput.className = "revision-input";
    requestInput.type = "text";
    requestInput.placeholder = "예: 더 짧게 / 더 공손하게 / 마지막 문장만 부드럽게";

    const buttonRow = document.createElement("div");
    buttonRow.className = "option-actions";

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.textContent = "복사";

    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(textarea.value.trim());
        copyButton.textContent = "복사 완료";
        setTimeout(() => {
          copyButton.textContent = "복사";
        }, 1200);
      } catch {
        alert("복사에 실패했습니다. 직접 선택해 복사해 주세요.");
      }
    });

    const reviseButton = document.createElement("button");
    reviseButton.type = "button";
    reviseButton.className = "btn-revise";
    reviseButton.textContent = "다시 얘두파인?";

    reviseButton.addEventListener("click", async () => {
      const request = requestInput.value.trim();

      if (!request) {
        alert("어떻게 수정할지 입력해 주세요.");
        requestInput.focus();
        return;
      }

      reviseButton.disabled = true;
      reviseButton.textContent = "수정 중...";

      try {
        const revised = await reviseOption({
          currentText: textarea.value.trim(),
          request
        });
        textarea.value = revised;
      } catch (error) {
        alert(error.message || "수정 중 오류가 발생했습니다.");
      } finally {
        reviseButton.disabled = false;
        reviseButton.textContent = "다시 얘두파인?";
      }
    });

    buttonRow.appendChild(copyButton);
    buttonRow.appendChild(reviseButton);
    card.appendChild(title);
    card.appendChild(textarea);
    card.appendChild(requestInput);
    card.appendChild(buttonRow);
    optionsContainer.appendChild(card);
  });
}

function toStars(value) {
  const number = Math.max(0, Math.min(5, Number(value || 0)));
  return "★".repeat(number) + "☆".repeat(5 - number);
}
