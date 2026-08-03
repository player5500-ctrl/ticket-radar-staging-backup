import { createDisabledEvaluationAdapter } from "../disabled-adapter";

export const kktixAdapter = createDisabledEvaluationAdapter({
  id: "kktix",
  name: "KKTIX",
  domains: ["kktix.com", "kktix.cc"],
  decisionNote:
    "尚未取得固定測試頁、穩定欄位 selector 與明確整合許可；不同活動另有條款與驗證流程，維持停用。",
});
