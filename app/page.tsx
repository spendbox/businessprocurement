import { Shell } from "@/components/Shell";
import { SiteHeader } from "@/components/SiteHeader";
import { ScrollStage } from "@/components/ScrollStage";
import { DockBar } from "@/components/DockBar";
import {
  CategoryGallery,
  Closer,
  Faq,
  Footer,
  HowItWorks,
  VendorPitch,
} from "@/components/Sections";

export default function Page() {
  return (
    <Shell>
      <a
        href="#catalog"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink-900 focus:px-5 focus:py-3 focus:text-[14px] focus:font-bold focus:text-bone-50"
      >
        Skip to what we source
      </a>

      <SiteHeader />

      <main id="top">
        <ScrollStage />
        <CategoryGallery />
        <HowItWorks />
        <VendorPitch />
        <Faq />
        <Closer />
      </main>

      <Footer />
      <DockBar />
    </Shell>
  );
}
