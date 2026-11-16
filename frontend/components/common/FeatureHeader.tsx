import SiteHeader from "@/components/common/SiteHeader";

// 기존 호출처 호환용 — 공통 헤더(SiteHeader)를 그대로 쓴다
export default function FeatureHeader() {
  return <SiteHeader maxWidth="max-w-5xl" />;
}
