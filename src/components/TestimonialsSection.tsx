import { Link } from "@tanstack/react-router";
import { Star, Quote, Repeat2, CheckCircle2, ArrowRight } from "lucide-react";

import azizImg from "@/assets/images/testimonial_aziz_1791459706005.jpg";
import dilnozaImg from "@/assets/images/testimonial_dilnoza_1791459730375.jpg";
import jasurImg from "@/assets/images/testimonial_jasur_1791459767261.jpg";
import { Button } from "@/components/ui/button";

const testimonials = [
  {
    name: "Azizbek Rahimov",
    role: "Frontend Dasturchi",
    avatar: azizImg,
    taught: "React & TypeScript",
    learned: "Python & FastAPI",
    sessions: "4 ta mashg‘ulot",
    rating: 5,
    quote:
      "PeerSwap orqali orzu qilganimdek Python asoslarini o‘rgandim. Eng muhimi, bir tiyin ham sarflamadim — o‘zimning React bo‘yicha bilimlarimni hamkorimga o‘rgatdim. Jonli video darslar va real vaqtdagi muloqot qimmat kurslardan ancha samaraliroq bo‘ldi!",
  },
  {
    name: "Dilnoza Karimova",
    role: "UI/UX Dizayner",
    avatar: dilnozaImg,
    taught: "Figma & Dizayn tizimlari",
    learned: "HTML, CSS & Tailwind",
    sessions: "6 ta mashg‘ulot",
    rating: 5,
    quote:
      "Dizayner sifatida web dasturlash qanday ishlashini amalda tushunishim zarur edi. Hamkorim menga HTML va CSS qoidalarini amaliyotda tushuntirib berdi, men esa unga Figma va dizayn prinsiplarini o‘rgatdim. Video darslarni yozib olib keyinchalik qayta ko‘rish imkoniyati menga juda yoqdi!",
  },
  {
    name: "Jasur Mahmudov",
    role: "Backend Muhandis",
    avatar: jasurImg,
    taught: "PostgreSQL & Docker",
    learned: "Texnik Ingliz tili (Speaking)",
    sessions: "8 ta mashg‘ulot",
    rating: 5,
    quote:
      "Ingliz tilida gapirish darajamni oshirish uchun suhbatdosh qidirayotgan edim. Bu yerda ajoyib hamkor topdim: men unga ma’lumotlar bazasi optimallashtirishni o‘rgatdim, u esa men bilan haftada ikki marta inglizcha texnik suhbatlar o‘tkazdi. Ikkalamiz ham xursandmiz!",
  },
];

export function TestimonialsSection() {
  return (
    <section className="relative mx-auto max-w-6xl px-4 py-20 border-t border-border/40">
      {/* Background soft glow */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 h-[350px] w-full max-w-4xl opacity-20 blur-3xl"
        style={{ background: "var(--gradient-hero)" }}
        aria-hidden="true"
      />

      {/* Section Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-secondary/60 px-3.5 py-1 text-xs text-muted-foreground">
          <Quote className="size-3 text-accent" />
          <span>Haqiqiy tajribalar</span>
        </div>
        <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          Foydalanuvchilarimiz nima deydi?
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm sm:text-base text-muted-foreground leading-relaxed">
          PeerSwap orqali muvaffaqiyatli bilim almashgan, yangi kasb sirlarini o‘rgangan va o‘z
          tajribasini boshqalar bilan bo‘lishgan a’zolarimizning samimiy fikrlari.
        </p>
      </div>

      {/* Testimonials Grid */}
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {testimonials.map((item) => (
          <div
            key={item.name}
            className="surface-card flex flex-col justify-between p-6 transition-all duration-200 hover:border-accent/40 hover:shadow-lg"
          >
            <div>
              {/* Star Rating & Quote Icon */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {Array.from({ length: item.rating }).map((_, i) => (
                    <Star key={i} className="size-4 fill-accent text-accent" />
                  ))}
                </div>
                <Quote className="size-5 text-accent/40" />
              </div>

              {/* Quote text */}
              <p className="mt-4 text-sm text-foreground/90 leading-relaxed italic">
                "{item.quote}"
              </p>
            </div>

            {/* Exchange Summary Badge & User Info */}
            <div className="mt-6 border-t border-border/60 pt-4">
              {/* Exchange flow pill */}
              <div className="mb-4 rounded-lg bg-secondary/50 p-2 text-xs border border-border/40">
                <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  <span>O‘rgatdi: {item.taught}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sky-400 font-medium mt-1">
                  <span className="size-1.5 rounded-full bg-sky-400" />
                  <span>O‘rgandi: {item.learned}</span>
                </div>
              </div>

              {/* User Avatar + Details */}
              <div className="flex items-center gap-3">
                <img
                  src={item.avatar}
                  alt={item.name}
                  className="size-11 rounded-full object-cover border-2 border-accent/40 shadow-sm"
                />
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-1">
                    {item.name}
                    <CheckCircle2 className="size-3.5 text-accent shrink-0" />
                  </h3>
                  <p className="text-xs text-muted-foreground">{item.role}</p>
                  <p className="text-[11px] text-accent/80 font-medium mt-0.5">{item.sessions}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Callout underneath */}
      <div className="mt-12 text-center">
        <div className="inline-flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-border bg-card/60 px-6 py-4 shadow-sm backdrop-blur">
          <p className="text-sm text-muted-foreground">
            Siz ham o‘zingiz bilgan ko‘nikmani boshqalar bilan almashishga tayyormisiz?
          </p>
          <Button
            asChild
            size="sm"
            className="bg-primary hover:bg-primary/90 gap-1.5 text-xs font-semibold"
          >
            <Link to="/signup">
              Hamkor topish <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
