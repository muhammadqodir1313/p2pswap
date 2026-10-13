import {
  HelpCircle,
  Repeat2,
  Coins,
  ShieldCheck,
  Video,
  Sparkles,
  Calendar,
  MessageSquare,
  ArrowRight,
} from "lucide-react";
import { Link } from "@tanstack/react-router";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

const FAQ_ITEMS = [
  {
    id: "item-1",
    question: "PeerSwap’da ko‘nikma almashish mexanizmi qanday ishlaydi?",
    badge: "Asosiy mexanizm",
    icon: Repeat2,
    answer:
      "PeerSwap ikki tomonlama tengdoshlararo (P2P) bilim almashish modeliga asoslangan. Siz o‘zingiz yaxshi biladigan sohani (masalan: React, Python, Ingliz tili yoki Figma) profilingizda «O‘rgataman» deb belgilaysiz, o‘rganmoqchi bo‘lgan fanlaringizni esa «O‘rganaman» ro‘yxatiga kiritasiz. Tizim sizga qarama-qarshi ehtiyojga ega bo‘lgan hamkorlarni avtomatik tavsiya qiladi yoki siz o‘zingiz katalogdan kerakli bilim egasini qidirib topasiz.",
  },
  {
    id: "item-2",
    question: "PeerPoint nima va u qanday hisoblanadi?",
    badge: "Iqtisodiy model",
    icon: Coins,
    answer:
      "PeerPoint — bu platforma ichidagi adolatli almashinuv birligi. Har bir a’zo haftalik bepul PeerPoint ajratmasiga ega bo‘ladi. Biror hamkorga bilim o‘rgatib dars o‘tsangiz, siz yangi PeerPoint ishlab olasiz. Ishlab olingan ballaringiz evaziga esa boshqa tajribali a’zolardan o‘zingiz xohlagan yangi sohani mutlaqo bepul o‘rganishingiz mumkin.",
  },
  {
    id: "item-3",
    question: "Bir vaqtda o‘zaro bir-birimizga o‘rgatishimiz shartmi?",
    badge: "Moslashuvchanlik",
    icon: Sparkles,
    answer:
      "Mutlaqo shart emas! PeerSwap asinxron almashinuvni qo‘llab-quvvatlaydi. Masalan, siz A foydalanuvchiga Python asoslarini o‘rgatib PeerPoint ishlaysiz, so‘ngra yig‘ilgan balingiz orqali butunlay boshqa B foydalanuvchidan Xitoy tilini o‘rganishingiz mumkin. Agar ikkalangiz ham bir-biringizning ko‘nikmangizga qiziqsangiz, o‘zaro to‘g‘ridan-to‘g‘ri darslar rejalashtirishingiz ham mumkin.",
  },
  {
    id: "item-4",
    question: "Darslar qayerda o‘tadi va video yozuv saqlanadimi?",
    badge: "Jonli sessiya",
    icon: Video,
    answer:
      "Barcha darslar to‘g‘ridan-to‘g‘ri PeerSwap veb-platformasi ichidagi maxsus video xonada o‘tkaziladi — hech qanday qo‘shimcha dastur o‘rnatish shart emas. Video qo‘ng‘iroq davomida ekranni ulashish, mikrofon/kamera boshqaruvi va eng muhimi — darsni video yozib olish (recording) funksiyasi mavjud. Yozib olingan videoni keyinchalik qayta tomosha qilish yoki kompyuteringizga yuklab olishingiz mumkin.",
  },
  {
    id: "item-5",
    question: "Agar hamkor darsga kelmasa, mening ballarim nima bo‘ladi?",
    badge: "Xavfsizlik & Kafolat",
    icon: ShieldCheck,
    answer:
      "Sizning PeerPointlaringiz 100% himoyalangan. Agar hamkor darsga qatnashmasa yoki sessiya bekor qilinsa, siz «Qatnashmadim / Hamkor kelmadi» tugmasini bosasiz va balansingizdan hech qanday ball yechilmaydi. Ballar faqat ikkala tomon video darsda to‘liq ishtirok etib, dars yakunida o‘zaro qoniqish hosil qilib tasdiqlagandagina o‘tkaziladi.",
  },
  {
    id: "item-6",
    question: "Dars vaqtini qanday kelishib olamiz?",
    badge: "Kalendar & Chat",
    icon: Calendar,
    answer:
      "Almashinuv so‘rovi qabul qilingach yoki kalendarda vaqt band qilingach, ikkala foydalanuvchi uchun avtomatik shaxsiy chat ochiladi. Chat orqali dars mavzusi va tayyorgarlik bo‘yicha suhbatlashasiz, vaqtni xohlagancha o‘zgartirishingiz (reschedule) va belgilangan vaqtda bir tugma bilan video xonaga kirishingiz mumkin.",
  },
  {
    id: "item-7",
    question: "Darsdan keyin baholash va sharh (review) qanday amalga oshiriladi?",
    badge: "Shaffof reyting",
    icon: MessageSquare,
    answer:
      "Video sessiya yakunlangach, ekranda darhol 5 yulduzli baholash va fikr-mulohaza qoldirish oynasi paydo bo‘ladi. Ikkala tomon bir-birining dars berish uslubi, vaqtga rioya qilganligi va bilimi bo‘yicha xolis baho beradi. Bu hamjamiyatda sifatli va mas’uliyatli hamkorlar muhitini mustahkamlaydi.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="mx-auto max-w-4xl px-4 py-20">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-secondary/60 px-3.5 py-1 text-xs text-muted-foreground backdrop-blur">
          <HelpCircle className="size-3.5 text-accent" />
          <span>Ko‘p beriladigan savollar</span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
          Ko‘nikma almashish qanday ishlaydi?
        </h2>
        <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          PeerSwap platformasining ishlash tartibi, PeerPoint tizimi, video darslar va xavfsizlik
          qoidalari haqidagi barcha muhim savollarga javoblar.
        </p>
      </div>

      {/* Accordion List */}
      <div className="mt-12 surface-card p-4 sm:p-8 rounded-2xl border border-border/60 shadow-sm">
        <Accordion type="single" collapsible defaultValue="item-1" className="w-full space-y-2">
          {FAQ_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <AccordionItem
                key={item.id}
                value={item.id}
                className="border border-border/50 rounded-xl px-4 py-1 data-[state=open]:bg-secondary/30 data-[state=open]:border-accent/30 transition-colors"
              >
                <AccordionTrigger className="hover:no-underline py-4 text-left gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-accent border border-border/60">
                      <Icon className="size-4" />
                    </span>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2.5">
                      <span className="text-sm sm:text-base font-semibold text-foreground">
                        {item.question}
                      </span>
                      <span className="inline-block w-fit text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/20">
                        {item.badge}
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-1 pb-4 text-sm text-muted-foreground leading-relaxed pl-11 pr-2">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      {/* Bottom Help CTA */}
      <div className="mt-8 rounded-xl border border-border/60 bg-secondary/40 p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Savolingizga javob topmadingizmi?
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ro‘yxatdan o‘tib, hamjamiyatdagi boshqa a’zolar bilan bevosita suhbatlashishingiz
            mumkin.
          </p>
        </div>
        <Button asChild size="sm" className="bg-primary hover:bg-primary/90 shrink-0 gap-1.5">
          <Link to="/signup">
            Ro‘yxatdan o‘tish
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
