import { createDisabledEvaluationAdapter } from "../disabled-adapter";

export const tixcraftAdapter = createDisabledEvaluationAdapter({
  id: "tixcraft",
  name: "拓元售票 tixCraft",
  domains: ["tixcraft.com"],
  decisionNote:
    "現行服務條款禁止以自動程式干擾、繞過或操控正常購票流程或公平性，維持停用。",
});
