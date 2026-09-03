import Benefits from "@/features/bokflyt/Benefits";
import BokflytTopBar from "@/features/bokflyt/BokflytTopBar";
import BookLifeStory from "@/features/bokflyt/BookLifeStory";
import classes from "@/features/bokflyt/bokflyt.module.css";
import Challenges from "@/features/bokflyt/Challenges";
import ContactSection from "@/features/bokflyt/ContactSection";
import Hero from "@/features/bokflyt/Hero";
import HowItWorks from "@/features/bokflyt/HowItWorks";
import Pricing from "@/features/bokflyt/Pricing";
import YearTimeline from "@/features/bokflyt/YearTimeline";
import PublicPageFooter from "@/features/layout/PublicPageFooter";

export default function BokflytPage() {
  return (
    <div className={classes.page}>
      <BokflytTopBar />
      <main>
        <Hero />
        <Challenges />
        <HowItWorks />
        <Benefits />
        <BookLifeStory />
        <YearTimeline />
        <Pricing />
        <ContactSection />
      </main>
      <PublicPageFooter />
    </div>
  );
}
