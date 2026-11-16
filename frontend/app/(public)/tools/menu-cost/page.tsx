import type { Metadata } from "next";
import ToolShell from "../_components/ToolShell";
import { pageOpenGraph } from "@/lib/seoMeta";
import MenuCostCalculator from "./MenuCostCalculator";

const TITLE = "메뉴 원가·원가율 계산기 | AEOlab 사장님 계산기";
const DESCRIPTION =
  "재료별 산 금액·양·1인분 사용량(손실률 포함)을 넣으면 메뉴 1인분 원가와 원가율, 남는 돈, 목표 원가율을 맞추는 판매가를 계산합니다. 입력한 값은 저장하지 않습니다.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/tools/menu-cost" },
  openGraph: pageOpenGraph({ title: TITLE, description: DESCRIPTION, path: "/tools/menu-cost" }),
};

export default function MenuCostPage() {
  return (
    <ToolShell
      path="/tools/menu-cost"
      title="메뉴 원가·원가율 계산기"
      intro="재료마다 산 금액과 양, 1인분에 쓰는 양을 넣으면 메뉴 1인분 원가와 원가율을 계산해요. 판매가를 넣으면 남는 돈을, 목표 원가율을 넣으면 맞춰야 할 판매가를 알려 드려요."
    >
      <MenuCostCalculator />
      <section className="max-w-3xl rounded-xl border border-gray-200 bg-white p-4 md:p-5">
        <h2 className="text-base font-bold text-gray-900">계산 방법</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed text-gray-700 break-keep">
          <li>재료 원가 = 산 금액 ÷ 산 양 × 1인분에 쓰는 양 ÷ (1 − 손실률). 손실률이 있으면 버리는 만큼 더 사야 하므로 원가가 늘어나요.</li>
          <li>1인분 원가 = 재료 원가의 합 + 포장·소스 같은 그 밖의 비용</li>
          <li>원가율 = 1인분 원가 ÷ 판매가, 남는 돈 = 판매가 − 1인분 원가, 마진율 = 남는 돈 ÷ 판매가</li>
          <li>목표 원가율을 맞추는 판매가 = 1인분 원가 ÷ 목표 원가율. 판매가에 부가세가 포함된다면 부가세를 뺀 금액 기준으로 계산하고 결과에 부가세 10%를 더해 보여 드려요.</li>
          <li>적정 원가율에 정해진 기준은 없어요. 업종·매장 사정마다 다르므로 직접 정한 목표를 넣어 주세요. 인건비·임대료 등 고정비는 원가에 포함하지 않아요.</li>
        </ul>
      </section>
    </ToolShell>
  );
}
